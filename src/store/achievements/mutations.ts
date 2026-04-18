import Vue from 'vue'
import type { MutationTree } from 'vuex'
import { defaultState } from './state'
import type { AchievementsState } from './types'
import type { AchievementProgress, AchievementStats } from '@/types/achievement'

export const mutations = {
  setReset (state) {
    Object.assign(state, defaultState())
  },

  setProgress (state, payload: { id: string, progress: AchievementProgress }) {
    Vue.set(state.progress, payload.id, payload.progress)
  },

  setStats (state, stats: AchievementStats) {
    state.stats = stats
  },

  updateStat<K extends keyof AchievementStats> (state: AchievementsState, payload: { key: K, value: AchievementStats[K] }) {
    Vue.set(state.stats, payload.key, payload.value)
  },

  setTotalPoints (state, points: number) {
    state.totalPoints = points
  },

  setEnabled (state, enabled: boolean) {
    state.enabled = enabled
  },

  setNotificationsEnabled (state, enabled: boolean) {
    state.notificationsEnabled = enabled
  },

  setHydratedFromMoonraker (state, value: boolean) {
    state.hydratedFromMoonraker = value
  },

  initFromDb (state, payload: Partial<AchievementsState>) {
    if (payload.progress != null) state.progress = payload.progress
    if (payload.stats != null) {
      state.stats = { ...defaultState().stats, ...payload.stats }
    }
    if (payload.totalPoints != null) state.totalPoints = payload.totalPoints
    if (payload.enabled != null) state.enabled = payload.enabled
    if (payload.notificationsEnabled != null) state.notificationsEnabled = payload.notificationsEnabled
  }
} satisfies MutationTree<AchievementsState>
