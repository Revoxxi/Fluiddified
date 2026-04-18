import type { AchievementProgress, AchievementStats } from '@/types/achievement'

export interface AchievementsState {
  progress: Record<string, AchievementProgress>
  stats: AchievementStats
  totalPoints: number
  enabled: boolean
  notificationsEnabled: boolean
  /**
   * True after `initAchievements` has run for this session (Moonraker `fluidd` row read or absent).
   * Blocks `saveToDb` until then so a socket flush cannot overwrite server data with default/empty state.
   */
  hydratedFromMoonraker: boolean
}
