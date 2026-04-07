export type AchievementCategory =
  | 'volume'
  | 'consistency'
  | 'characteristics'
  | 'timing'
  | 'klipper'
  | 'exploration'
  | 'thermal'
  | 'hidden'

export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

/** Extruder setup for calibration command hints (direct drive vs bowden). */
export type CalibrationExtruderMode = 'direct' | 'bowden'

export interface CalibrationGuideSuggested {
  direct: string[]
  bowden: string[]
}

export interface CalibrationGuideStep {
  /** Step title shown in the guide */
  title: string
  /** Short explanation */
  summary: string
  /** Official Klipper documentation (how to read results, proceed, etc.) */
  docUrl: string
  /** Uppercase G-code command names (first token) that complete this step */
  triggerCommands: string[]
  /** e.g. prefer PA tower over line/pattern */
  methodTip?: string
  suggestedCommands: CalibrationGuideSuggested
}

export interface AchievementCalibrationGuide {
  steps: CalibrationGuideStep[]
}

export interface AchievementDefinition {
  id: string
  name: string
  description: string
  icon: string
  category: AchievementCategory
  hidden?: boolean
  /** Keep at top of lists (within the same hidden / category group). */
  pinToTop?: boolean
  /** Interactive ordered calibration checklist with doc links and command hints */
  calibrationGuide?: AchievementCalibrationGuide
  tiers?: number[]
  unit?: string
  unlockMessage?: string
  rarity: AchievementRarity
  points: number
}

export interface AchievementProgress {
  current: number
  tierReached: number
  unlockedAt?: number
  tierUnlockedAt?: Record<number, number>
  calibrationStepsComplete?: number[]
  calibrationExtruderMode?: CalibrationExtruderMode
}

export interface AchievementStats {
  consecutiveSuccesses: number
  dailyStreak: number
  lastPrintDate: string | null
  distinctMacrosRun: string[]
  distinctDaysPrinted: string[]
  distinctThemesUsed: string[]
  weekendsPrinted: string[]
  /** Monday-anchored date keys (YYYY-M-D) for weeks with ≥1 completed print */
  weeksWithPrint: string[]
  webcamsViewed: string[]
  settingsSectionsVisited: string[]
  shortcutsUsed: string[]
  commandsSentCount: number
  bedMeshCalibrations: number
  themeChanges: number
  layoutChanges: number
  presetActivations: number
  failedPrintCount: number
  lastPrintEndTime: number
  pageRefreshCount: number
  uptimeMs: number
  /** When Klippy was last ready — used to accumulate `uptimeMs` on disconnect */
  uptimeSessionStartMs: number | null
  /** Estimated filament mass from job metadata (grams) */
  totalPrintWeightGrams: number
  klipperRestarts: number
  saveConfigCount: number
  /** Last user input time (ms) for `patience` while printing */
  lastUserInteractionMs: number
  /** Progress through Konami key sequence (0–10) */
  konamiIndex: number
  /** First time (ms) any heater held within 0.5°C of target; cleared when not */
  tempPrecisionStableSinceMs: number | null
  /** Bed exceeded ~80°C during current print job */
  sawHotBedThisPrint: boolean
}
