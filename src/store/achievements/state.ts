import type { AchievementsState } from './types'

export const defaultState = (): AchievementsState => {
  return {
    progress: {},
    stats: {
      consecutiveSuccesses: 0,
      dailyStreak: 0,
      lastPrintDate: null,
      distinctMacrosRun: [],
      distinctDaysPrinted: [],
      distinctThemesUsed: [],
      weekendsPrinted: [],
      weeksWithPrint: [],
      webcamsViewed: [],
      settingsSectionsVisited: [],
      shortcutsUsed: [],
      commandsSentCount: 0,
      bedMeshCalibrations: 0,
      themeChanges: 0,
      layoutChanges: 0,
      presetActivations: 0,
      failedPrintCount: 0,
      lastPrintEndTime: 0,
      pageRefreshCount: 0,
      uptimeMs: 0,
      uptimeSessionStartMs: null,
      totalPrintWeightGrams: 0,
      klipperRestarts: 0,
      saveConfigCount: 0,
      lastUserInteractionMs: 0,
      konamiIndex: 0,
      tempPrecisionStableSinceMs: null,
      sawHotBedThisPrint: false
    },
    totalPoints: 0,
    enabled: true,
    notificationsEnabled: true
  }
}

export const state = defaultState()
