import type { GetterTree } from 'vuex'
import type { AchievementsState } from './types'
import type { RootState } from '../types'
import type { AchievementProgress } from '@/types/achievement'
import { achievementDefinitions } from '@/components/widgets/achievements/definitions'

export const getters = {
  getProgress: (state): Record<string, AchievementProgress> => {
    return state.progress
  },

  getProgressById: (state) => (id: string): AchievementProgress | undefined => {
    return state.progress[id]
  },

  getUnlockedIds: (state): string[] => {
    return Object.entries(state.progress)
      .filter(([, p]) => p.unlockedAt != null)
      .map(([id]) => id)
  },

  getTotalPoints: (state): number => {
    return state.totalPoints
  },

  getCompletionPercentage: (state): number => {
    const total = achievementDefinitions.length
    if (total === 0) return 0
    const unlocked = Object.values(state.progress)
      .filter(p => p.unlockedAt != null)
      .length
    return Math.round((unlocked / total) * 100)
  },

  isEnabled: (state): boolean => {
    return state.enabled
  }
} satisfies GetterTree<AchievementsState, RootState>
