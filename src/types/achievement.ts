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

export interface AchievementDefinition {
  id: string
  name: string
  description: string
  icon: string
  category: AchievementCategory
  hidden?: boolean
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
}

export interface AchievementStats {
  consecutiveSuccesses: number
  dailyStreak: number
  lastPrintDate: string | null
  distinctMacrosRun: string[]
  distinctDaysPrinted: string[]
  distinctThemesUsed: string[]
  weekendsPrinted: string[]
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
  klipperRestarts: number
  saveConfigCount: number
}
