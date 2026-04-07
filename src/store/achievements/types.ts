import type { AchievementProgress, AchievementStats } from '@/types/achievement'

export interface AchievementsState {
  progress: Record<string, AchievementProgress>
  stats: AchievementStats
  totalPoints: number
  enabled: boolean
  notificationsEnabled: boolean
}
