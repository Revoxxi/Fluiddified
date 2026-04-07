import type { ActionTree } from 'vuex'
import type { AchievementsState } from './types'
import type { RootState } from '../types'
import type { HistoryItem } from '../history/types'
import { SocketActions } from '@/api/socketActions'
import { EventBus } from '@/eventBus'
import { achievementDefinitions } from '@/components/widgets/achievements/definitions'
import { resolveUserVisibleMacroName } from '@/store/achievements/gcodeMacros'

const rarityPoints: Record<string, number> = {
  common: 10,
  uncommon: 25,
  rare: 50,
  epic: 100,
  legendary: 250
}

function getDateKey (ts: number): string {
  const d = new Date(ts * 1000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getWeekendKey (ts: number): string {
  const d = new Date(ts * 1000)
  const sun = new Date(d)
  sun.setDate(d.getDate() - d.getDay())
  return getDateKey(sun.getTime() / 1000)
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
    getDateKey(typeof j.end_time === 'string' ? parseFloat(j.end_time) : j.end_time) === dateKey
  ).length
}

/** Monday-anchored calendar week (local), for “active week” streaks */
function getWeekAnchorDateKey (tsSec: number): string {
  const d = new Date(tsSec * 1000)
  const day = d.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(mon.getDate() + mondayOffset)
  return getDateKey(mon.getTime() / 1000)
}

function gramsFromCompletedJob (job: HistoryItem): number {
  const w = job.metadata?.filament_weight_total
  return typeof w === 'number' && w > 0 ? w : 0
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

export const actions = {
  async reset ({ commit }) {
    commit('setReset')
  },

  async initAchievements ({ commit }, payload: Partial<AchievementsState> | undefined) {
    if (payload) {
      commit('initFromDb', payload)
    }
  },

  async saveToDb ({ state }) {
    SocketActions.serverDatabasePostItem('achievements', {
      progress: state.progress,
      stats: state.stats,
      totalPoints: state.totalPoints,
      enabled: state.enabled,
      notificationsEnabled: state.notificationsEnabled
    })
  },

  async setEnabled ({ commit, dispatch }, enabled: boolean) {
    commit('setEnabled', enabled)
    await dispatch('saveToDb')
  },

  async setNotificationsEnabled ({ commit, dispatch }, enabled: boolean) {
    commit('setNotificationsEnabled', enabled)
    await dispatch('saveToDb')
  },

  async unlockAchievement ({ state, commit, dispatch }, payload: { id: string, value?: number }) {
    if (!state.enabled) return

    const def = achievementDefinitions.find(d => d.id === payload.id)
    if (!def) return

    const progress = state.progress[payload.id] ?? { current: 0, tierReached: 0 }
    const currentValue = payload.value ?? progress.current + 1
    const now = Date.now()
    let unlocked = false
    let newTier = progress.tierReached

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
          current: 1,
          tierReached: 1,
          unlockedAt: now
        }
      })
      unlocked = true
    }

    if (unlocked) {
      const points = rarityPoints[def.rarity] ?? def.points
      commit('setTotalPoints', state.totalPoints + points)
      if (state.notificationsEnabled) {
        const tierLabel = def.tiers && def.tiers.length > 0
          ? `Tier ${newTier} / ${def.tiers.length}`
          : undefined
        EventBus.$emit(undefined, {
          type: 'success',
          timeout: 8000,
          achievement: {
            id: def.id,
            name: def.name,
            description: def.unlockMessage ?? def.description,
            rarity: def.rarity,
            points,
            tierLabel,
            icon: def.icon
          }
        })
      }
    }

    await dispatch('saveToDb')
  },

  async onPrintComplete ({ state, commit, dispatch, rootState, rootGetters }, job: HistoryItem) {
    if (!state.enabled) return

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

    if (isCompleted) {
      const grams = gramsFromCompletedJob(job)
      if (grams > 0) {
        const totalW = state.stats.totalPrintWeightGrams + grams
        commit('updateStat', { key: 'totalPrintWeightGrams', value: totalW })
        await dispatch('unlockAchievement', {
          id: 'print_weight',
          value: totalW
        })
      }
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

      if (state.stats.lastPrintEndTime > 0 && startTime - state.stats.lastPrintEndTime < 300) {
        await dispatch('unlockAchievement', { id: 'back_to_back' })
      }

      const endDateKey = endTime > 0 ? getDateKey(endTime) : getDateKey(Date.now() / 1000)
      const todayCount = countPrintsOnDay(rootState.history?.jobs ?? [], endDateKey) + 1
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
        const wkKey = getWeekendKey(startTime)
        if (!state.stats.weekendsPrinted.includes(wkKey)) {
          const updated = [...state.stats.weekendsPrinted, wkKey]
          commit('updateStat', { key: 'weekendsPrinted', value: updated })
          await dispatch('unlockAchievement', {
            id: 'weekend_warrior',
            value: updated.length
          })
        }
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
      const newStreak = state.stats.consecutiveSuccesses + 1
      commit('updateStat', { key: 'consecutiveSuccesses', value: newStreak })
      await dispatch('unlockAchievement', {
        id: 'consecutive_success',
        value: newStreak
      })

      if (state.stats.consecutiveSuccesses === 1 && state.stats.failedPrintCount > 0) {
        await dispatch('unlockAchievement', { id: 'bounced_back' })
      }
    } else if (isFailed) {
      commit('updateStat', { key: 'consecutiveSuccesses', value: 0 })
      const newFails = state.stats.failedPrintCount + 1
      commit('updateStat', { key: 'failedPrintCount', value: newFails })
      if (newFails >= 50) {
        await dispatch('unlockAchievement', { id: 'five_hundred_errors' })
      }
    }

    const nowKey = getDateKey(Date.now() / 1000)
    const lastDate = state.stats.lastPrintDate

    if (lastDate) {
      const lastMs = new Date(lastDate).getTime()
      const nowMs = new Date(nowKey).getTime()
      const diffDays = Math.round((nowMs - lastMs) / 86400000)
      if (diffDays === 1) {
        const newDailyStreak = state.stats.dailyStreak + 1
        commit('updateStat', { key: 'dailyStreak', value: newDailyStreak })
        await dispatch('unlockAchievement', {
          id: 'daily_streak',
          value: newDailyStreak
        })
      } else if (diffDays > 1) {
        commit('updateStat', { key: 'dailyStreak', value: 1 })
      }
    } else {
      commit('updateStat', { key: 'dailyStreak', value: 1 })
    }

    if (!state.stats.distinctDaysPrinted.includes(nowKey)) {
      const updated = [...state.stats.distinctDaysPrinted, nowKey]
      commit('updateStat', { key: 'distinctDaysPrinted', value: updated })
      await dispatch('unlockAchievement', {
        id: 'days_active',
        value: updated.length
      })
    }

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

    if (isCompleted && endTime > 0) {
      const wk = getWeekAnchorDateKey(endTime)
      if (!state.stats.weeksWithPrint.includes(wk)) {
        const wup = [...state.stats.weeksWithPrint, wk]
        commit('updateStat', { key: 'weeksWithPrint', value: wup })
        await dispatch('unlockAchievement', {
          id: 'weekly_active',
          value: wup.length
        })
      }
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

    await dispatch('recomputeUptimeAchievement')

    commit('updateStat', { key: 'lastPrintEndTime', value: endTime || Date.now() / 1000 })
    commit('updateStat', { key: 'lastPrintDate', value: nowKey })
    await dispatch('saveToDb')
  },

  /**
   * Klipper “ready” connection time toward `uptime_champion`. Call after prints too so
   * long sessions advance tiers without waiting for disconnect.
   */
  async recomputeUptimeAchievement ({ state, dispatch }) {
    if (!state.enabled) return
    const live = state.stats.uptimeSessionStartMs != null
      ? Date.now() - state.stats.uptimeSessionStartMs
      : 0
    const hours = (state.stats.uptimeMs + live) / 3600000
    await dispatch('unlockAchievement', {
      id: 'uptime_champion',
      value: hours
    })
  },

  async onKlippyReadyChanged ({ state, commit, dispatch }, payload: { prevReady: boolean, nextReady: boolean }) {
    if (!state.enabled) return

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

  async onConfigFileSaved ({ state, dispatch }, payload: { root: string, filename: string, contents: string }) {
    if (!state.enabled) return
    if (payload.root !== 'config' || !payload.filename.endsWith('.cfg')) return
    if (/\[gcode_macro\b/i.test(payload.contents)) {
      await dispatch('unlockAchievement', { id: 'macro_creator' })
    }
    await dispatch('saveToDb')
  },

  async onDatabaseBackupCreated ({ state, dispatch }) {
    if (!state.enabled) return
    await dispatch('unlockAchievement', { id: 'config_backup' })
    await dispatch('saveToDb')
  },

  /**
   * printer.gcode.script returned ok — Klipper accepted the script. Used for fair
   * macro / calibration / console achievement tracking (failed commands do not count).
   */
  async onGcodeScriptOk ({ state, rootState, commit, dispatch }, script: string) {
    if (!state.enabled) return

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

    await dispatch('saveToDb')
  },

  async onMultiPrinterFleet ({ state, dispatch }) {
    if (!state.enabled) return
    await dispatch('unlockAchievement', { id: 'multi_instance' })
    await dispatch('saveToDb')
  },

  async onPluginZipInstalled ({ state, dispatch }) {
    if (!state.enabled) return
    await dispatch('unlockAchievement', { id: 'community_plugin' })
    await dispatch('saveToDb')
  },

  async onThemeChange ({ state, commit, dispatch }, theme: string) {
    if (!state.enabled) return

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

  async onLayoutChange ({ state, commit, dispatch }) {
    if (!state.enabled) return

    const newCount = state.stats.layoutChanges + 1
    commit('updateStat', { key: 'layoutChanges', value: newCount })
    await dispatch('unlockAchievement', { id: 'layout_editor' })

    if (newCount >= 10) {
      await dispatch('unlockAchievement', { id: 'layout_power_user' })
    }

    await dispatch('saveToDb')
  },

  async onPresetActivated ({ state, commit, dispatch }) {
    if (!state.enabled) return

    const newCount = state.stats.presetActivations + 1
    commit('updateStat', { key: 'presetActivations', value: newCount })
    if (newCount >= 10) {
      await dispatch('unlockAchievement', { id: 'preheat_master' })
    }

    await dispatch('saveToDb')
  },

  async onKeyboardShortcutUsed ({ state, commit, dispatch }, shortcut: string) {
    if (!state.enabled || !shortcut) return

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

  async onEmergencyStop ({ state, dispatch }) {
    if (!state.enabled) return
    await dispatch('unlockAchievement', { id: 'emergency_stop' })
  },

  async onCameraView ({ state, commit, dispatch }, cameraId: string) {
    if (!state.enabled) return

    if (cameraId && !state.stats.webcamsViewed.includes(cameraId)) {
      const updated = [...state.stats.webcamsViewed, cameraId]
      commit('updateStat', { key: 'webcamsViewed', value: updated })
      if (updated.length >= 3) {
        await dispatch('unlockAchievement', { id: 'camera_viewer' })
      }
      await dispatch('saveToDb')
    }
  },

  async onNavigate ({ state, dispatch }, route: string) {
    if (!state.enabled) return

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

  async onSettingsVisit ({ state, commit, dispatch }, section: string) {
    if (!state.enabled) return

    if (section && !state.stats.settingsSectionsVisited.includes(section)) {
      const updated = [...state.stats.settingsSectionsVisited, section]
      commit('updateStat', { key: 'settingsSectionsVisited', value: updated })
      if (updated.length >= 8) {
        await dispatch('unlockAchievement', { id: 'settings_deep_dive' })
      }
      await dispatch('saveToDb')
    }
  },

  async onPageRefresh ({ state, commit, dispatch }) {
    if (!state.enabled) return

    const newCount = state.stats.pageRefreshCount + 1
    commit('updateStat', { key: 'pageRefreshCount', value: newCount })
    if (newCount >= 10) {
      await dispatch('unlockAchievement', { id: 'browser_refresh' })
    }
    await dispatch('saveToDb')
  },

  async retroactiveScan ({ state, rootState, commit, dispatch }) {
    if (!state.enabled) return

    const jobs = rootState.history?.jobs ?? []
    const totals = (rootState.history as any)?.job_totals

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

    let weightSum = 0
    const weekKeySet = new Set<string>()
    for (const job of completedJobs) {
      weightSum += gramsFromCompletedJob(job)
      const et = (job as HistoryItem).end_time
      if (et != null) {
        const t = typeof et === 'string' ? parseFloat(et) : et
        if (t > 0) weekKeySet.add(getWeekAnchorDateKey(t))
      }
    }
    if (weightSum > 0) {
      commit('updateStat', { key: 'totalPrintWeightGrams', value: weightSum })
      await dispatch('unlockAchievement', { id: 'print_weight', value: weightSum })
    }
    if (weekKeySet.size > 0) {
      commit('updateStat', { key: 'weeksWithPrint', value: [...weekKeySet] })
      await dispatch('unlockAchievement', { id: 'weekly_active', value: weekKeySet.size })
    }

    const rateAll = computeSuccessRatePercent(jobs as Array<{ status: string }>)
    if (rateAll != null) {
      await dispatch('unlockAchievement', { id: 'success_rate', value: rateAll })
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
      if (duration > 14400) await dispatch('unlockAchievement', { id: 'marathon_4h' })
      if (duration > 43200) await dispatch('unlockAchievement', { id: 'marathon_12h' })
      if (duration > 86400) await dispatch('unlockAchievement', { id: 'marathon_24h' })
      if (duration > 172800) await dispatch('unlockAchievement', { id: 'marathon_48h' })

      const filament = (job as any).filament_used ?? 0
      if (filament >= 50000) await dispatch('unlockAchievement', { id: 'big_print_50m' })
      if (filament >= 100000) await dispatch('unlockAchievement', { id: 'big_print_100m' })
      if (filament >= 250000) await dispatch('unlockAchievement', { id: 'big_print_250m' })
      if (filament > 0 && filament < 500) await dispatch('unlockAchievement', { id: 'tiny_print' })

      const startTime = (job as any).start_time ?? 0
      if (startTime > 0) {
        const startHour = new Date(startTime * 1000).getHours()
        if (startHour >= 0 && startHour < 4) await dispatch('unlockAchievement', { id: 'night_owl' })
        if (startHour >= 5 && startHour < 7) await dispatch('unlockAchievement', { id: 'early_bird' })
        if (startHour === 12) await dispatch('unlockAchievement', { id: 'lunch_break' })
      }
    }

    await dispatch('saveToDb')

    EventBus.$emit(
      `Retroactive scan complete: ${totalCompleted} prints analyzed`,
      { type: 'success', timeout: 6000 }
    )
  },

  async resetAndSave ({ commit, dispatch }) {
    commit('setReset')
    await dispatch('saveToDb')
  }
} satisfies ActionTree<AchievementsState, RootState>
