import Vue from 'vue'
import type { ActionTree } from 'vuex'
import type { AchievementsState } from './types'
import type { RootState } from '../types'
import type { HistoryItem } from '../history/types'
import type { CalibrationGuideUserConfig } from '@/types/achievement'
import {
  calibrationGuideConfigsEqual,
  DEFAULT_CALIBRATION_GUIDE_CONFIG,
  getActiveCalibrationSteps,
  migrateAchievementsDbPayload,
  normalizeCalibrationStepsComplete
} from '@/util/calibrationGuideRuntime'
import { CALIBRATION_GUIDE_ACHIEVEMENT_ID } from '@/components/widgets/achievements/calibrationGuideAchievement'
import { SocketActions } from '@/api/socketActions'
import { EventBus } from '@/eventBus'
import { consola } from 'consola'
import { achievementDefinitions } from '@/components/widgets/achievements/definitions'
import {
  countDistinctMonthsWithPrint,
  countDistinctSeasonsWithPrint,
  countQueueCompletedJobs,
  deriveAchievementStatsFromHistory,
  getDateKeyFromSeconds,
  getWeekAnchorDateKey,
  parseJobEndTime
} from '@/util/achievementHistoryDerived'
import { formatAchievementAnnouncement } from '@/util/achievementDisplay'
import { resolveUserVisibleMacroName } from '@/store/achievements/gcodeMacros'
import type { Role } from '@/types/auth'

/**
 * Spectators and trusted pre-login clients may view achievements but must not earn progress,
 * persist changes, or toggle settings. Requires a Fluidd JWT session (operator or owner).
 */
function canEarnAchievements (rootGetters: { (key: string): unknown }): boolean {
  if (rootGetters['auth/uiSessionActive'] !== true) return false
  const hasMinRole = rootGetters['auth/hasMinRole'] as ((minRole: Role) => boolean) | undefined
  return hasMinRole?.('user') === true
}

const rarityPoints: Record<string, number> = {
  common: 10,
  uncommon: 25,
  rare: 50,
  epic: 100,
  legendary: 250
}

function isPalindrome (s: string): boolean {
  const cleaned = s.replace(/\D/g, '')
  return cleaned.length > 1 && cleaned === cleaned.split('').reverse().join('')
}

function formatDuration (seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${h}${String(m).padStart(2, '0')}${String(s).padStart(2, '0')}`
}

/** First executable line (skip blanks and ; comments) for multi-line console scripts. */
function firstExecutableGcodeLine (script: string): string {
  const lines = script.split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (line.length === 0) continue
    if (line.startsWith(';')) continue
    return line
  }
  return ''
}

function countPrintsOnDay (jobs: Array<{ status: string, end_time?: number | string | null }>, dateKey: string): number {
  return jobs.filter(j =>
    j.status === 'completed' &&
    j.end_time != null &&
    getDateKeyFromSeconds(typeof j.end_time === 'string' ? parseFloat(j.end_time) : j.end_time) === dateKey
  ).length
}

/** @returns null if fewer than 50 finished jobs (completed / cancelled / error) */
function computeSuccessRatePercent (jobs: Array<{ status: string }>): number | null {
  const finished = jobs.filter(j =>
    j.status === 'completed' ||
    j.status === 'cancelled' ||
    j.status === 'error'
  )
  if (finished.length < 50) return null
  const completed = finished.filter(j => j.status === 'completed').length
  return (completed / finished.length) * 100
}

function thanksgivingUs (year: number): { month: number, day: number } {
  const nov1 = new Date(year, 10, 1)
  const dow = nov1.getDay()
  const firstThuOffset = (4 - dow + 7) % 7
  const day = 1 + firstThuOffset + 21
  return { month: 10, day }
}

function isMajorHoliday (tsSec: number): boolean {
  const d = new Date(tsSec * 1000)
  const m = d.getMonth()
  const day = d.getDate()
  const y = d.getFullYear()
  if (m === 0 && day === 1) return true
  if (m === 6 && day === 4) return true
  if (m === 11 && day === 25) return true
  if (m === 9 && day === 31) return true
  if (m === 1 && day === 14) return true
  if (m === 2 && day === 17) return true
  const tg = thanksgivingUs(y)
  if (m === tg.month && day === tg.day) return true
  return false
}

/** Print spans local 11:00 PM through 6:00 AM the next calendar day */
function coversGraveyardWindow (startSec: number, endSec: number): boolean {
  const s = new Date(startSec * 1000)
  const y = s.getFullYear()
  const m = s.getMonth()
  const d = s.getDate()
  const slotStart = new Date(y, m, d, 23, 0, 0).getTime() / 1000
  const slotEnd = new Date(y, m, d + 1, 6, 0, 0).getTime() / 1000
  if (startSec <= slotStart && endSec >= slotEnd) return true
  const prevStart = new Date(y, m, d - 1, 23, 0, 0).getTime() / 1000
  const prevEnd = new Date(y, m, d, 6, 0, 0).getTime() / 1000
  return startSec <= prevStart && endSec >= prevEnd
}

const KONAMI_EXPECTED = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'
] as const

function normalizeKonamiKey (key: string): string {
  return key.length === 1 ? key.toLowerCase() : key
}

type HeaterForAchievement = { type: string, temperature: number, target: number }

export const actions = {
  async reset ({ commit }) {
    commit('setReset')
  },

  async initAchievements ({ commit }, payload: Partial<AchievementsState> | undefined) {
    try {
      if (payload != null && Object.keys(payload).length > 0) {
        commit('initFromDb', migrateAchievementsDbPayload(payload))
      }
    } finally {
      // Always mark hydrated so we never persist pre-sync defaults over Moonraker; empty payload = no row yet.
      commit('setHydratedFromMoonraker', true)
    }
  },

  /**
   * Persist achievements to Moonraker DB. Skips when role is guest or session cannot
   * use server.database.post_item (user+). Avoids errors on first paint before JWT/roles hydrate.
   */
  async saveToDb (
    { state, rootGetters },
    opts?: { force?: boolean }
  ) {
    if (!opts?.force && !state.hydratedFromMoonraker) {
      return
    }
    if (!canEarnAchievements(rootGetters)) {
      return
    }
    if (!Vue.$socket) {
      return
    }
    try {
      await SocketActions.serverDatabasePostItem('achievements', {
        progress: state.progress,
        stats: state.stats,
        totalPoints: state.totalPoints,
        enabled: state.enabled,
        notificationsEnabled: state.notificationsEnabled
      })
    } catch (e) {
      consola.debug('[achievements] saveToDb failed or skipped', e)
    }
  },

  async setEnabled ({ commit, dispatch, rootGetters }, enabled: boolean) {
    if (!canEarnAchievements(rootGetters)) return
    commit('setEnabled', enabled)
    await dispatch('saveToDb')
  },

  async setNotificationsEnabled ({ commit, dispatch, rootGetters }, enabled: boolean) {
    if (!canEarnAchievements(rootGetters)) return
    commit('setNotificationsEnabled', enabled)
    await dispatch('saveToDb')
  },

  async unlockAchievement ({ state, commit, dispatch, rootGetters }, payload: { id: string, value?: number }) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return

    const def = achievementDefinitions.find(d => d.id === payload.id)
    if (!def) return

    const progress = state.progress[payload.id] ?? { current: 0, tierReached: 0 }
    const currentValue = payload.value ?? progress.current + 1
    const now = Date.now()
    let unlocked = false
    let newTier = progress.tierReached
    const startTier = progress.tierReached

    if (def.tiers) {
      const currentTier = progress.tierReached
      newTier = currentTier
      const tierTimestamps = { ...progress.tierUnlockedAt }
      for (let i = currentTier; i < def.tiers.length; i++) {
        if (currentValue >= def.tiers[i]) {
          newTier = i + 1
          tierTimestamps[i] = now
          unlocked = true
        } else {
          break
        }
      }
      if (currentValue !== progress.current || newTier !== currentTier) {
        commit('setProgress', {
          id: payload.id,
          progress: {
            ...progress,
            current: currentValue,
            tierReached: newTier,
            unlockedAt: progress.unlockedAt ?? (unlocked ? now : undefined),
            tierUnlockedAt: tierTimestamps
          }
        })
      }
    } else {
      if (progress.unlockedAt) return
      commit('setProgress', {
        id: payload.id,
        progress: {
          ...progress,
          current: 1,
          tierReached: 1,
          unlockedAt: now
        }
      })
      unlocked = true
    }

    if (unlocked) {
      const pointsPerTier = rarityPoints[def.rarity] ?? def.points
      const tiersGained = def.tiers ? newTier - startTier : 1
      const pointsAwarded = def.tiers ? pointsPerTier * tiersGained : pointsPerTier
      commit('setTotalPoints', state.totalPoints + pointsAwarded)
      if (state.notificationsEnabled) {
        const tierLabel = def.tiers && def.tiers.length > 0
          ? `Tier ${newTier} / ${def.tiers.length}`
          : undefined
        const progressForText = state.progress[payload.id]
        EventBus.$emit(undefined, {
          type: 'success',
          timeout: 8000,
          achievement: {
            id: def.id,
            name: def.name,
            description: formatAchievementAnnouncement(def, progressForText),
            rarity: def.rarity,
            points: pointsAwarded,
            tierLabel,
            icon: def.icon
          }
        })
      }
    }

    await dispatch('saveToDb')
  },

  /**
   * Persist calibration guide machine setup. Changing options after a prior save resets
   * this achievement’s step progress and unlock (and total points).
   */
  async saveCalibrationGuideConfig (
    { state, commit, dispatch, rootGetters },
    payload: { id: string, config: CalibrationGuideUserConfig }
  ) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return
    const def = achievementDefinitions.find(d => d.id === payload.id)
    if (def?.calibrationGuide == null) return

    const prev = state.progress[payload.id] ?? { current: 0, tierReached: 0 }
    const oldCommitted = prev.calibrationGuideConfig
    const hadSaved = prev.calibrationGuideConfigSaved === true
    const configChanged =
      hadSaved &&
      oldCommitted != null &&
      !calibrationGuideConfigsEqual(oldCommitted, payload.config)

    let nextPoints = state.totalPoints
    let next: typeof prev = {
      ...prev,
      calibrationGuideConfig: payload.config,
      calibrationGuideConfigSaved: true
    }

    if (configChanged) {
      if (prev.unlockedAt != null) {
        const pts = rarityPoints[def.rarity] ?? def.points
        nextPoints = Math.max(0, nextPoints - pts)
        commit('setTotalPoints', nextPoints)
      }
      next = {
        ...next,
        current: 0,
        tierReached: 0,
        unlockedAt: undefined,
        calibrationStepsComplete: []
      }
    }

    commit('setProgress', { id: payload.id, progress: next })
    await dispatch('saveToDb')
  },

  /**
   * Advance the calibration guide only on the current step and in order (G-code accepted by Klipper).
   */
  async onCalibrationGuideGcode ({ state, commit, dispatch, rootGetters }, baseName: string) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return
    const def = achievementDefinitions.find(d => d.id === CALIBRATION_GUIDE_ACHIEVEMENT_ID)
    if (def?.calibrationGuide == null) return

    const progress = state.progress[CALIBRATION_GUIDE_ACHIEVEMENT_ID] ?? { current: 0, tierReached: 0 }
    if (progress.unlockedAt != null) return
    if (progress.calibrationGuideConfigSaved !== true) return

    const config = progress.calibrationGuideConfig ?? DEFAULT_CALIBRATION_GUIDE_CONFIG
    const active = getActiveCalibrationSteps(def.calibrationGuide.steps, config)
    const doneKeys = new Set(normalizeCalibrationStepsComplete(progress.calibrationStepsComplete ?? []))
    const firstIncomplete = active.find(s => !doneKeys.has(s.key))
    if (firstIncomplete == null || !firstIncomplete.triggerCommands.includes(baseName)) return

    doneKeys.add(firstIncomplete.key)
    const sortedKeys = active.filter(s => doneKeys.has(s.key)).map(s => s.key)
    commit('setProgress', {
      id: CALIBRATION_GUIDE_ACHIEVEMENT_ID,
      progress: {
        ...progress,
        calibrationStepsComplete: sortedKeys,
        current: sortedKeys.length
      }
    })

    if (sortedKeys.length === active.length) {
      await dispatch('unlockAchievement', { id: CALIBRATION_GUIDE_ACHIEVEMENT_ID })
    }
  },

  async onPrintComplete ({ state, commit, dispatch, rootState, rootGetters }, job: HistoryItem) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return

    const jobs = rootState.history?.jobs ?? []
    const derived = deriveAchievementStatsFromHistory(jobs)
    commit('updateStat', { key: 'consecutiveSuccesses', value: derived.consecutiveSuccesses })
    commit('updateStat', { key: 'totalPrintWeightGrams', value: derived.totalPrintWeightGrams })
    commit('updateStat', { key: 'distinctDaysPrinted', value: derived.distinctDaysPrinted })
    commit('updateStat', { key: 'weekendsPrinted', value: derived.weekendsPrinted })
    commit('updateStat', { key: 'weeksWithPrint', value: derived.weeksWithPrint })
    commit('updateStat', { key: 'dailyStreak', value: derived.dailyStreak })
    commit('updateStat', { key: 'failedPrintCount', value: derived.failedPrintCount })
    commit('updateStat', { key: 'lastPrintEndTime', value: derived.lastPrintEndTime })
    commit('updateStat', { key: 'lastPrintDate', value: derived.lastPrintDate })

    const totals = rootState.history?.job_totals
    const isCompleted = job.status === 'completed'
    const isFailed = job.status === 'cancelled' || job.status === 'error'
    const duration = job.print_duration ?? 0
    const filamentMm = job.filament_used ?? 0
    const startTime = job.start_time ?? 0
    const endTime = job.end_time != null
      ? (typeof job.end_time === 'string' ? parseFloat(job.end_time) : job.end_time)
      : 0

    if (isCompleted && totals) {
      await dispatch('unlockAchievement', {
        id: 'prints_completed',
        value: totals.total_jobs
      })
      await dispatch('unlockAchievement', {
        id: 'print_hours',
        value: totals.total_print_time / 3600
      })
      await dispatch('unlockAchievement', {
        id: 'filament_used',
        value: totals.total_filament_used / 1000
      })
    }

    if (isCompleted && state.stats.totalPrintWeightGrams > 0) {
      await dispatch('unlockAchievement', {
        id: 'print_weight',
        value: state.stats.totalPrintWeightGrams
      })
    }

    if (isCompleted) {
      await dispatch('unlockAchievement', {
        id: 'queue_completed',
        value: countQueueCompletedJobs(jobs)
      })
      await dispatch('unlockAchievement', {
        id: 'months_active',
        value: countDistinctMonthsWithPrint(jobs)
      })
      await dispatch('unlockAchievement', {
        id: 'seasons_touched',
        value: countDistinctSeasonsWithPrint(jobs)
      })
    }

    if (isCompleted) {
      await dispatch('unlockAchievement', { id: 'first_print' })

      const extruders = rootGetters['printer/getExtruders'] as Array<{ name?: string }>
      if (extruders.length >= 2) {
        await dispatch('unlockAchievement', { id: 'multi_extruder' })
      }

      if (duration < 300) {
        await dispatch('unlockAchievement', { id: 'speed_demon' })
      }
      if (duration < 60) {
        await dispatch('unlockAchievement', { id: 'quick_job' })
      }
      if (duration >= 4 * 3600) {
        await dispatch('unlockAchievement', { id: 'marathon_4h' })
      }
      if (duration >= 12 * 3600) {
        await dispatch('unlockAchievement', { id: 'marathon_12h' })
      }
      if (duration >= 24 * 3600) {
        await dispatch('unlockAchievement', { id: 'marathon_24h' })
      }
      if (duration >= 48 * 3600) {
        await dispatch('unlockAchievement', { id: 'marathon_48h' })
      }

      if (filamentMm >= 50000) {
        await dispatch('unlockAchievement', { id: 'big_print_50m' })
      }
      if (filamentMm >= 100000) {
        await dispatch('unlockAchievement', { id: 'big_print_100m' })
      }
      if (filamentMm >= 250000) {
        await dispatch('unlockAchievement', { id: 'big_print_250m' })
      }
      if (filamentMm < 500) {
        await dispatch('unlockAchievement', { id: 'tiny_print' })
      }

      const sortedByEnd = [...jobs]
        .filter(j => parseJobEndTime(j) > 0)
        .sort((a, b) => parseJobEndTime(a) - parseJobEndTime(b))
      const idx = sortedByEnd.findIndex(j => j.job_id === job.job_id)
      if (idx > 0) {
        const prevEnd = parseJobEndTime(sortedByEnd[idx - 1])
        if (startTime > 0 && startTime - prevEnd < 300) {
          await dispatch('unlockAchievement', { id: 'back_to_back' })
        }
      }

      const endDateKey = endTime > 0 ? getDateKeyFromSeconds(endTime) : getDateKeyFromSeconds(Date.now() / 1000)
      const todayCount = countPrintsOnDay(jobs, endDateKey)
      if (todayCount >= 3) {
        await dispatch('unlockAchievement', { id: 'triple_play' })
      }
      if (todayCount >= 5) {
        await dispatch('unlockAchievement', { id: 'production_day' })
      }
      if (todayCount >= 10) {
        await dispatch('unlockAchievement', { id: 'factory_floor' })
      }
    }

    if (job.status === 'cancelled') {
      await dispatch('unlockAchievement', { id: 'first_cancel' })
    }

    if (startTime > 0) {
      const startDate = new Date(startTime * 1000)
      const startHour = startDate.getHours()

      if (startHour >= 0 && startHour <= 3) {
        await dispatch('unlockAchievement', { id: 'night_owl' })
      }
      if (startHour >= 5 && startHour <= 6) {
        await dispatch('unlockAchievement', { id: 'early_bird' })
      }
      if (startHour === 12) {
        await dispatch('unlockAchievement', { id: 'lunch_break' })
      }

      const startDay = startDate.getDay()
      if (startDay === 0 || startDay === 6) {
        await dispatch('unlockAchievement', {
          id: 'weekend_warrior',
          value: state.stats.weekendsPrinted.length
        })
      }

      if (startDate.getMonth() === 0 && startDate.getDate() === 1) {
        await dispatch('unlockAchievement', { id: 'new_years_print' })
      }
      if (startDate.getDay() === 5 && startDate.getDate() === 13) {
        await dispatch('unlockAchievement', { id: 'friday_13th' })
      }
    }

    if (endTime > 0) {
      const endDate = new Date(endTime * 1000)
      const endMinutes = endDate.getHours() * 60 + endDate.getMinutes()
      if (endMinutes >= 23 * 60 + 55 || endMinutes <= 5) {
        await dispatch('unlockAchievement', { id: 'midnight_finish' })
      }

      if (endDate.getMonth() === 0 && endDate.getDate() === 1) {
        await dispatch('unlockAchievement', { id: 'new_years_print' })
      }
    }

    if (isCompleted) {
      await dispatch('unlockAchievement', {
        id: 'consecutive_success',
        value: state.stats.consecutiveSuccesses
      })

      if (state.stats.consecutiveSuccesses === 1 && state.stats.failedPrintCount > 0) {
        await dispatch('unlockAchievement', { id: 'bounced_back' })
      }
    } else if (isFailed) {
      if (state.stats.failedPrintCount >= 50) {
        await dispatch('unlockAchievement', { id: 'five_hundred_errors' })
      }
    }

    await dispatch('unlockAchievement', {
      id: 'daily_streak',
      value: state.stats.dailyStreak
    })

    await dispatch('unlockAchievement', {
      id: 'days_active',
      value: state.stats.distinctDaysPrinted.length
    })

    if (isCompleted && totals) {
      const totalCompleted = totals.total_jobs
      if ([100, 500, 1000].includes(totalCompleted)) {
        await dispatch('unlockAchievement', { id: 'round_number' })
      }
    }

    if (isCompleted) {
      const durStr = formatDuration(duration)
      if (isPalindrome(durStr)) {
        await dispatch('unlockAchievement', { id: 'palindrome_print' })
      }
    }

    if (isCompleted && totals?.total_jobs === 7 && Math.round(duration) === 420) {
      await dispatch('unlockAchievement', { id: 'lucky_seven' })
    }

    if (isCompleted && startTime > 0 && endTime > 0 && coversGraveyardWindow(startTime, endTime)) {
      await dispatch('unlockAchievement', { id: 'night_shift' })
    }

    if (isCompleted && endTime > 0) {
      await dispatch('unlockAchievement', {
        id: 'weekly_active',
        value: state.stats.weeksWithPrint.length
      })
    }

    if (isCompleted || isFailed) {
      const rate = computeSuccessRatePercent(rootState.history?.jobs ?? [])
      if (rate != null) {
        await dispatch('unlockAchievement', {
          id: 'success_rate',
          value: rate
        })
      }
    }

    const holidayTs = endTime > 0 ? endTime : startTime
    if (isCompleted && holidayTs > 0 && isMajorHoliday(holidayTs)) {
      await dispatch('unlockAchievement', { id: 'holiday_printer' })
    }

    if (isCompleted) {
      const heaters = rootGetters['printer/getHeaters'] as HeaterForAchievement[]
      const bed = heaters.find(h => h.type === 'heater_bed')
      if (
        bed != null &&
        bed.temperature < 30 &&
        state.stats.sawHotBedThisPrint
      ) {
        await dispatch('unlockAchievement', { id: 'cool_down_patience' })
      }
    }

    if (isCompleted || isFailed) {
      commit('updateStat', { key: 'sawHotBedThisPrint', value: false })
    }

    await dispatch('recomputeUptimeAchievement')

    await dispatch('saveToDb')
  },

  /**
   * Klipper “ready” connection time toward `uptime_champion`. Call after prints too so
   * long sessions advance tiers without waiting for disconnect.
   */
  async recomputeUptimeAchievement ({ state, dispatch, rootGetters }) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return
    const live = state.stats.uptimeSessionStartMs != null
      ? Date.now() - state.stats.uptimeSessionStartMs
      : 0
    const hours = (state.stats.uptimeMs + live) / 3600000
    await dispatch('unlockAchievement', {
      id: 'uptime_champion',
      value: hours
    })
  },

  async onKlippyReadyChanged ({ state, commit, dispatch, rootGetters }, payload: { prevReady: boolean, nextReady: boolean }) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return

    const now = Date.now()
    if (payload.prevReady && !payload.nextReady) {
      const start = state.stats.uptimeSessionStartMs
      if (start != null && start > 0) {
        commit('updateStat', {
          key: 'uptimeMs',
          value: state.stats.uptimeMs + (now - start)
        })
      }
      commit('updateStat', { key: 'uptimeSessionStartMs', value: null })
    } else if (!payload.prevReady && payload.nextReady) {
      commit('updateStat', { key: 'uptimeSessionStartMs', value: now })
    }

    if (payload.prevReady !== payload.nextReady) {
      await dispatch('recomputeUptimeAchievement')
      await dispatch('saveToDb')
    }
  },

  async onConfigFileSaved ({ state, dispatch, rootGetters }, payload: { root: string, filename: string, contents: string }) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return
    if (payload.root !== 'config' || !payload.filename.endsWith('.cfg')) return
    if (/\[gcode_macro\b/i.test(payload.contents)) {
      await dispatch('unlockAchievement', { id: 'macro_creator' })
    }
    await dispatch('saveToDb')
  },

  async onDatabaseBackupCreated ({ state, dispatch, rootGetters }) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return
    await dispatch('unlockAchievement', { id: 'config_backup' })
    await dispatch('saveToDb')
  },

  /**
   * printer.gcode.script returned ok — Klipper accepted the script. Used for fair
   * macro / calibration / console achievement tracking (failed commands do not count).
   * Invoked only from `console/onGcodeScript`, which runs for this tab’s RPC result (see socketClient + `__request__` guard), not for other users’ commands or passive console history.
   * Other flows: print/history achievements use server totals; theme/shortcuts/navigation are local UI; thermal polling is this client only.
   */
  async onGcodeScriptOk ({ state, rootState, commit, dispatch, rootGetters }, script: string) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return

    const line = firstExecutableGcodeLine(script)
    if (!line) return

    const trimmed = line.toUpperCase()
    const baseName = trimmed.split(/\s+/)[0]

    const newCount = state.stats.commandsSentCount + 1
    commit('updateStat', { key: 'commandsSentCount', value: newCount })
    await dispatch('unlockAchievement', {
      id: 'console_explorer',
      value: newCount
    })

    const cmdMap: Record<string, string> = {
      BED_MESH_CALIBRATE: 'first_mesh',
      SHAPER_CALIBRATE: 'input_shaper',
      TEST_RESONANCES: 'input_shaper',
      ACCELEROMETER_QUERY: 'speed_test',
      SET_PRESSURE_ADVANCE: 'pressure_advance',
      PID_CALIBRATE: 'pid_tuned',
      MPC_CALIBRATE: 'pid_tuned',
      SET_RETRACTION: 'firmware_retract',
      EXCLUDE_OBJECT: 'exclude_object',
      PROBE_ACCURACY: 'probe_accuracy',
      QUERY_ENDSTOPS: 'endstop_check',
      FIRMWARE_RESTART: 'klipper_restart',
      SAVE_CONFIG: 'save_config',
      Z_OFFSET_APPLY_PROBE: 'z_offset_save',
      Z_OFFSET_APPLY_ENDSTOP: 'z_offset_save'
    }

    for (const [cmd, achievementId] of Object.entries(cmdMap)) {
      if (baseName === cmd) {
        await dispatch('unlockAchievement', { id: achievementId })
      }
    }

    if (baseName === 'BED_MESH_CALIBRATE') {
      const newMeshCount = state.stats.bedMeshCalibrations + 1
      commit('updateStat', { key: 'bedMeshCalibrations', value: newMeshCount })
      await dispatch('unlockAchievement', {
        id: 'mesh_master',
        value: newMeshCount
      })
    }

    if (baseName === 'FIRMWARE_RESTART') {
      const newRestarts = state.stats.klipperRestarts + 1
      commit('updateStat', { key: 'klipperRestarts', value: newRestarts })
      await dispatch('unlockAchievement', {
        id: 'klipper_restart',
        value: newRestarts
      })
    }

    if (baseName === 'SAVE_CONFIG') {
      const newSaves = state.stats.saveConfigCount + 1
      commit('updateStat', { key: 'saveConfigCount', value: newSaves })
      await dispatch('unlockAchievement', {
        id: 'save_config',
        value: newSaves
      })
    }

    const macroName = resolveUserVisibleMacroName(rootState, baseName)
    if (macroName != null) {
      if (!state.stats.distinctMacrosRun.includes(macroName)) {
        const updated = [...state.stats.distinctMacrosRun, macroName]
        commit('updateStat', { key: 'distinctMacrosRun', value: updated })
        if (updated.length === 1) {
          await dispatch('unlockAchievement', { id: 'first_macro' })
        }
        await dispatch('unlockAchievement', {
          id: 'macro_variety',
          value: updated.length
        })
      }
    }

    await dispatch('onCalibrationGuideGcode', baseName)

    await dispatch('saveToDb')
  },

  async onMultiPrinterFleet ({ state, dispatch, rootGetters }) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return
    await dispatch('unlockAchievement', { id: 'multi_instance' })
    await dispatch('saveToDb')
  },

  async onPluginZipInstalled ({ state, dispatch, rootGetters }) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return
    await dispatch('unlockAchievement', { id: 'community_plugin' })
    await dispatch('saveToDb')
  },

  async onThemeChange ({ state, commit, dispatch, rootGetters }, theme: string) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return

    const newCount = state.stats.themeChanges + 1
    commit('updateStat', { key: 'themeChanges', value: newCount })
    await dispatch('unlockAchievement', { id: 'theme_changer' })

    if (theme && !state.stats.distinctThemesUsed.includes(theme)) {
      const updated = [...state.stats.distinctThemesUsed, theme]
      commit('updateStat', { key: 'distinctThemesUsed', value: updated })
      if (updated.length >= 5) {
        await dispatch('unlockAchievement', { id: 'theme_collector' })
      }
    }

    await dispatch('saveToDb')
  },

  async onLayoutChange ({ state, commit, dispatch, rootGetters }) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return

    const newCount = state.stats.layoutChanges + 1
    commit('updateStat', { key: 'layoutChanges', value: newCount })
    await dispatch('unlockAchievement', { id: 'layout_editor' })

    if (newCount >= 10) {
      await dispatch('unlockAchievement', { id: 'layout_power_user' })
    }

    await dispatch('saveToDb')
  },

  async onPresetActivated ({ state, commit, dispatch, rootGetters }) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return

    const newCount = state.stats.presetActivations + 1
    commit('updateStat', { key: 'presetActivations', value: newCount })
    if (newCount >= 10) {
      await dispatch('unlockAchievement', { id: 'preheat_master' })
    }

    await dispatch('saveToDb')
  },

  async onKeyboardShortcutUsed ({ state, commit, dispatch, rootGetters }, shortcut: string) {
    if (!state.enabled || !shortcut) return
    if (!canEarnAchievements(rootGetters)) return

    if (state.stats.shortcutsUsed.includes(shortcut)) {
      return
    }

    const updated = [...state.stats.shortcutsUsed, shortcut]
    commit('updateStat', { key: 'shortcutsUsed', value: updated })
    await dispatch('unlockAchievement', {
      id: 'keyboard_shortcuts',
      value: updated.length
    })

    await dispatch('saveToDb')
  },

  async onEmergencyStop ({ state, dispatch, rootGetters }) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return
    await dispatch('unlockAchievement', { id: 'emergency_stop' })
  },

  /** Dashboard at local 3:14 PM */
  async onDashboardClockEgg ({ state, dispatch, rootGetters }) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return
    const d = new Date()
    if (d.getHours() === 15 && d.getMinutes() === 14) {
      await dispatch('unlockAchievement', { id: 'easter_egg_time' })
    }
  },

  async onKonamiKey ({ state, commit, dispatch, rootGetters }, key: string) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return
    const k = normalizeKonamiKey(key)
    let idx = state.stats.konamiIndex
    const expected = KONAMI_EXPECTED[idx]
    const expN = normalizeKonamiKey(expected)
    if (k === expN) {
      idx += 1
      if (idx >= KONAMI_EXPECTED.length) {
        await dispatch('unlockAchievement', { id: 'konami' })
        idx = 0
      }
      commit('updateStat', { key: 'konamiIndex', value: idx })
    } else {
      const first = normalizeKonamiKey(KONAMI_EXPECTED[0])
      idx = k === first ? 1 : 0
      commit('updateStat', { key: 'konamiIndex', value: idx })
    }
  },

  async onUserInteraction ({ state, commit, rootGetters }) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return
    commit('updateStat', { key: 'lastUserInteractionMs', value: Date.now() })
  },

  async onPrintWatchBaseline ({ state, commit, dispatch, rootGetters }) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return
    commit('updateStat', { key: 'lastUserInteractionMs', value: Date.now() })
    commit('updateStat', { key: 'sawHotBedThisPrint', value: false })
    await dispatch('saveToDb')
  },

  async onPeriodicThermalAndPatience ({ state, commit, dispatch, rootGetters }) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return
    const printerState: string = rootGetters['printer/getPrinterState']
    const printing = printerState === 'printing'
    if (printing && state.stats.lastUserInteractionMs > 0) {
      if (Date.now() - state.stats.lastUserInteractionMs >= 30 * 60 * 1000) {
        await dispatch('unlockAchievement', { id: 'patience' })
      }
    }

    if (!rootGetters['printer/getKlippyReady']) return

    const heaters = rootGetters['printer/getHeaters'] as HeaterForAchievement[]

    if (printing) {
      const bed = heaters.find(h => h.type === 'heater_bed')
      if (bed != null && bed.temperature > 80) {
        if (!state.stats.sawHotBedThisPrint) {
          commit('updateStat', { key: 'sawHotBedThisPrint', value: true })
        }
      }
    }

    for (const h of heaters) {
      if (h.type === 'extruder' && h.temperature > 280) {
        await dispatch('unlockAchievement', { id: 'high_temp' })
        break
      }
    }

    for (const h of heaters) {
      if (h.type === 'heater_bed' && h.temperature > 100) {
        await dispatch('unlockAchievement', { id: 'abs_warrior' })
        break
      }
    }

    const atTargetCount = heaters.filter(h =>
      h.target > 0 && Math.abs(h.temperature - h.target) <= 2.5
    ).length
    if (atTargetCount >= 3) {
      await dispatch('unlockAchievement', { id: 'all_heaters_on' })
    }

    let stableHeater = false
    for (const h of heaters) {
      if (h.target > 0 && Math.abs(h.temperature - h.target) <= 0.5) {
        stableHeater = true
        break
      }
    }
    if (stableHeater) {
      if (state.stats.tempPrecisionStableSinceMs == null) {
        commit('updateStat', { key: 'tempPrecisionStableSinceMs', value: Date.now() })
      } else if (
        state.stats.tempPrecisionStableSinceMs > 0 &&
        Date.now() - state.stats.tempPrecisionStableSinceMs >= 10 * 60 * 1000
      ) {
        await dispatch('unlockAchievement', { id: 'temp_precision' })
      }
    } else if (state.stats.tempPrecisionStableSinceMs != null) {
      commit('updateStat', { key: 'tempPrecisionStableSinceMs', value: null })
    }
  },

  async onScrollAchievementsListEnd ({ state, dispatch, rootGetters }) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return
    await dispatch('unlockAchievement', { id: 'scroll_to_bottom' })
  },

  async onHeaterTargetForAchievement ({ state, dispatch, rootGetters }, payload: { target: number }) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return
    if (payload.target === 42) {
      await dispatch('unlockAchievement', { id: 'temp_42' })
    }
  },

  async onFileOrganizerFolderCreated ({ state, dispatch, rootGetters }) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return
    await dispatch('unlockAchievement', { id: 'file_organizer' })
  },

  async onCameraView ({ state, commit, dispatch, rootGetters }, cameraId: string) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return

    if (cameraId && !state.stats.webcamsViewed.includes(cameraId)) {
      const updated = [...state.stats.webcamsViewed, cameraId]
      commit('updateStat', { key: 'webcamsViewed', value: updated })
      if (updated.length >= 3) {
        await dispatch('unlockAchievement', { id: 'camera_viewer' })
      }
      await dispatch('saveToDb')
    }
  },

  async onNavigate ({ state, dispatch, rootGetters }, route: string) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return

    if (route.includes('/history')) {
      await dispatch('unlockAchievement', { id: 'history_buff' })
    }
    if (route.includes('/preview')) {
      await dispatch('unlockAchievement', { id: 'gcode_previewer' })
    }
    if (route.includes('/camera/')) {
      await dispatch('unlockAchievement', { id: 'fullscreen_mode' })
    }
  },

  async onSettingsVisit ({ state, commit, dispatch, rootGetters }, section: string) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return

    if (section && !state.stats.settingsSectionsVisited.includes(section)) {
      const updated = [...state.stats.settingsSectionsVisited, section]
      commit('updateStat', { key: 'settingsSectionsVisited', value: updated })
      if (updated.length >= 8) {
        await dispatch('unlockAchievement', { id: 'settings_deep_dive' })
      }
      await dispatch('saveToDb')
    }
  },

  async onPageRefresh ({ state, commit, dispatch, rootGetters }) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return

    const newCount = state.stats.pageRefreshCount + 1
    commit('updateStat', { key: 'pageRefreshCount', value: newCount })
    if (newCount >= 10) {
      await dispatch('unlockAchievement', { id: 'browser_refresh' })
    }
    await dispatch('saveToDb')
  },

  async retroactiveScan ({ state, rootState, commit, dispatch, rootGetters }) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return

    const jobs = rootState.history?.jobs ?? []
    const totals = (rootState.history as any)?.job_totals

    const derived = deriveAchievementStatsFromHistory(jobs)
    commit('updateStat', { key: 'consecutiveSuccesses', value: derived.consecutiveSuccesses })
    commit('updateStat', { key: 'totalPrintWeightGrams', value: derived.totalPrintWeightGrams })
    commit('updateStat', { key: 'distinctDaysPrinted', value: derived.distinctDaysPrinted })
    commit('updateStat', { key: 'weekendsPrinted', value: derived.weekendsPrinted })
    commit('updateStat', { key: 'weeksWithPrint', value: derived.weeksWithPrint })
    commit('updateStat', { key: 'dailyStreak', value: derived.dailyStreak })
    commit('updateStat', { key: 'failedPrintCount', value: derived.failedPrintCount })
    commit('updateStat', { key: 'lastPrintEndTime', value: derived.lastPrintEndTime })
    commit('updateStat', { key: 'lastPrintDate', value: derived.lastPrintDate })

    const completedJobs = jobs.filter((j: any) => j.status === 'completed') as HistoryItem[]
    const totalCompleted = totals?.total_jobs ?? completedJobs.length

    if (totalCompleted > 0) {
      await dispatch('unlockAchievement', { id: 'prints_completed', value: totalCompleted })
      await dispatch('unlockAchievement', { id: 'first_print' })
    }

    const totalHours = (totals?.total_print_time ?? 0) / 3600
    if (totalHours > 0) {
      await dispatch('unlockAchievement', { id: 'print_hours', value: totalHours })
    }

    const totalFilamentM = (totals?.total_filament_used ?? 0) / 1000
    if (totalFilamentM > 0) {
      await dispatch('unlockAchievement', { id: 'filament_used', value: totalFilamentM })
    }

    if (derived.totalPrintWeightGrams > 0) {
      await dispatch('unlockAchievement', { id: 'print_weight', value: derived.totalPrintWeightGrams })
    }
    if (derived.weeksWithPrint.length > 0) {
      await dispatch('unlockAchievement', { id: 'weekly_active', value: derived.weeksWithPrint.length })
    }

    await dispatch('unlockAchievement', {
      id: 'daily_streak',
      value: derived.dailyStreak
    })
    await dispatch('unlockAchievement', {
      id: 'days_active',
      value: derived.distinctDaysPrinted.length
    })
    await dispatch('unlockAchievement', {
      id: 'consecutive_success',
      value: derived.consecutiveSuccesses
    })

    await dispatch('unlockAchievement', {
      id: 'queue_completed',
      value: countQueueCompletedJobs(jobs)
    })
    await dispatch('unlockAchievement', {
      id: 'months_active',
      value: countDistinctMonthsWithPrint(jobs)
    })
    await dispatch('unlockAchievement', {
      id: 'seasons_touched',
      value: countDistinctSeasonsWithPrint(jobs)
    })

    const rateAll = computeSuccessRatePercent(jobs as Array<{ status: string }>)
    if (rateAll != null) {
      await dispatch('unlockAchievement', { id: 'success_rate', value: rateAll })
    }

    const sortedByEnd = [...completedJobs].sort((a, b) => {
      const ea = a.end_time != null ? (typeof a.end_time === 'string' ? parseFloat(a.end_time) : a.end_time) : 0
      const eb = b.end_time != null ? (typeof b.end_time === 'string' ? parseFloat(b.end_time) : b.end_time) : 0
      return ea - eb
    })
    const seventh = sortedByEnd[6]
    if (seventh && Math.round(seventh.print_duration ?? 0) === 420) {
      await dispatch('unlockAchievement', { id: 'lucky_seven' })
    }

    for (const job of completedJobs) {
      const st = job.start_time ?? 0
      let et = 0
      if (job.end_time != null) {
        et = typeof job.end_time === 'string' ? parseFloat(job.end_time) : job.end_time
      }
      if (st > 0 && et > 0 && coversGraveyardWindow(st, et)) {
        await dispatch('unlockAchievement', { id: 'night_shift' })
        break
      }
    }

    for (const job of completedJobs) {
      const ji = job as HistoryItem
      const st = ji.start_time ?? 0
      let et = 0
      if (ji.end_time != null) {
        et = typeof ji.end_time === 'string' ? parseFloat(ji.end_time) : ji.end_time
      }
      if ((st > 0 && isMajorHoliday(st)) || (et > 0 && isMajorHoliday(et))) {
        await dispatch('unlockAchievement', { id: 'holiday_printer' })
        break
      }
    }

    await dispatch('recomputeUptimeAchievement')

    const cancelledJobs = jobs.filter((j: any) => j.status === 'cancelled')
    if (cancelledJobs.length > 0) {
      await dispatch('unlockAchievement', { id: 'first_cancel' })
    }

    const failedJobs = jobs.filter((j: any) =>
      j.status === 'cancelled' || j.status === 'error'
    )
    if (failedJobs.length >= 50) {
      await dispatch('unlockAchievement', { id: 'five_hundred_errors' })
    }

    for (const job of completedJobs) {
      const duration = (job as any).print_duration ?? 0
      if (duration < 60) await dispatch('unlockAchievement', { id: 'quick_job' })
      if (duration < 300) await dispatch('unlockAchievement', { id: 'speed_demon' })
      if (duration >= 4 * 3600) await dispatch('unlockAchievement', { id: 'marathon_4h' })
      if (duration >= 12 * 3600) await dispatch('unlockAchievement', { id: 'marathon_12h' })
      if (duration >= 24 * 3600) await dispatch('unlockAchievement', { id: 'marathon_24h' })
      if (duration >= 48 * 3600) await dispatch('unlockAchievement', { id: 'marathon_48h' })

      const filament = (job as any).filament_used ?? 0
      if (filament >= 50000) await dispatch('unlockAchievement', { id: 'big_print_50m' })
      if (filament >= 100000) await dispatch('unlockAchievement', { id: 'big_print_100m' })
      if (filament >= 250000) await dispatch('unlockAchievement', { id: 'big_print_250m' })
      if (filament > 0 && filament < 500) await dispatch('unlockAchievement', { id: 'tiny_print' })

      const startTime = (job as any).start_time ?? 0
      if (startTime > 0) {
        const startHour = new Date(startTime * 1000).getHours()
        if (startHour >= 0 && startHour <= 3) await dispatch('unlockAchievement', { id: 'night_owl' })
        if (startHour >= 5 && startHour <= 6) await dispatch('unlockAchievement', { id: 'early_bird' })
        if (startHour === 12) await dispatch('unlockAchievement', { id: 'lunch_break' })
      }
    }

    await dispatch('saveToDb')

    EventBus.$emit(
      `Retroactive scan complete: ${totalCompleted} prints analyzed`,
      { type: 'success', timeout: 6000 }
    )
  },

  /**
   * Moonraker timelapse `render` event with status success (broadcast to all clients).
   * Dedupes by filename/printfile so multiple tabs do not multiply counts.
   */
  async onTimelapseRenderSuccess ({ state, commit, dispatch, rootGetters }, payload: Moonraker.Timelapse.RenderSuccess) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return

    const fp = `${payload.filename ?? ''}\0${payload.printfile ?? ''}`
    if (fp === '\0' || state.stats.timelapseRenderFingerprints.includes(fp)) {
      return
    }

    const fps = [...state.stats.timelapseRenderFingerprints, fp].slice(-400)
    const n = state.stats.timelapseSuccessfulRenders + 1
    commit('updateStat', { key: 'timelapseRenderFingerprints', value: fps })
    commit('updateStat', { key: 'timelapseSuccessfulRenders', value: n })

    if (n === 1) {
      await dispatch('unlockAchievement', { id: 'timelapse_debut' })
    }
    await dispatch('unlockAchievement', { id: 'timelapse_producer', value: n })
    await dispatch('saveToDb')
  },

  async onCheckedForUpdates ({ dispatch, rootGetters }) {
    if (!canEarnAchievements(rootGetters)) return
    await dispatch('unlockAchievement', { id: 'update_inventory' })
    await dispatch('saveToDb')
  },

  /** After Moonraker update manager finishes upgrading a component (not “check for updates”). */
  async onServiceUpdateApplied ({ state, commit, dispatch, rootGetters }) {
    if (!state.enabled) return
    if (!canEarnAchievements(rootGetters)) return
    const n = state.stats.serviceUpdatesCompleted + 1
    commit('updateStat', { key: 'serviceUpdatesCompleted', value: n })
    await dispatch('unlockAchievement', { id: 'stack_upgrade', value: n })
    await dispatch('saveToDb')
  },

  async resetAndSave ({ commit, dispatch, rootGetters }) {
    if (!canEarnAchievements(rootGetters)) return
    commit('setReset')
    await dispatch('saveToDb', { force: true })
  }
} satisfies ActionTree<AchievementsState, RootState>
