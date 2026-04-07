import type { GetterTree } from 'vuex'
import type { PluginsState } from './types'
import type { RootState } from '../types'

export const getters = {
  getRegistered: (state): string[] => {
    return state.registered
  },

  getDisabled: (state): string[] => {
    return state.disabled
  },

  isDisabled: (state) => (id: string): boolean => {
    return state.disabled.includes(id)
  },

  getLoadError: (state) => (id: string): string | undefined => {
    return state.loadErrors[id]
  }
} satisfies GetterTree<PluginsState, RootState>
