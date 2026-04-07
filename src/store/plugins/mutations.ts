import Vue from 'vue'
import type { MutationTree } from 'vuex'
import { defaultState } from './state'
import type { PluginsState } from './types'

export const mutations = {
  setReset (state) {
    Object.assign(state, defaultState())
  },

  setRegistered (state, payload: string[]) {
    state.registered = payload
  },

  setDisabled (state, payload: string[]) {
    state.disabled = payload
  },

  addDisabled (state, id: string) {
    if (!state.disabled.includes(id)) {
      state.disabled.push(id)
    }
  },

  removeDisabled (state, id: string) {
    const idx = state.disabled.indexOf(id)
    if (idx !== -1) {
      state.disabled.splice(idx, 1)
    }
  },

  setLoadError (state, payload: { id: string, error: string }) {
    Vue.set(state.loadErrors, payload.id, payload.error)
  },

  clearLoadError (state, id: string) {
    Vue.delete(state.loadErrors, id)
  }
} satisfies MutationTree<PluginsState>
