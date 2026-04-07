import type { ActionTree } from 'vuex'
import type { LayoutConfig, LayoutContainer, LayoutState } from './types'
import type { RootState } from '../types'
import { SocketActions } from '@/api/socketActions'
import { Globals } from '@/globals'
import { mergePluginCardsIntoDashboard, removePluginFromDashboardLayout } from './mergePluginLayout'

export const actions = {
  /**
   * Reset our store
   */
  async reset ({ commit }) {
    commit('setReset')
  },

  async initLayout ({ commit }, payload: LayoutState) {
    commit('setInitLayout', payload)
  },

  async onLayoutChange ({ commit, state, dispatch, rootState }, payload: { name: string; value: LayoutContainer }) {
    const layout = state.layouts[payload.name]
    if (layout || payload.name.startsWith('dashboard')) {
      commit('setLayoutChange', payload)
      await SocketActions.serverDatabasePostItem(
        Globals.MOONRAKER_DB.fluidd.ROOTS.layout.name + '.layouts',
        state.layouts
      )
      if (rootState.config.layoutMode) {
        dispatch('achievements/onLayoutChange', undefined, { root: true })
      }
    }
  },

  async appendRegisteredPluginToDashboards ({ state, dispatch, getters }, pluginId: string) {
    const keys = Object.keys(state.layouts).filter(
      k => k === 'dashboard' || k.startsWith('dashboard-')
    )
    for (const name of keys) {
      const layout = getters.getLayout(name)
      if (!layout) {
        continue
      }
      const flat = Object.values(layout).flat() as LayoutConfig[]
      const hasId = flat.some(c => c.id === pluginId)
      if (hasId) {
        continue
      }
      const merged = mergePluginCardsIntoDashboard(layout)
      await dispatch('onLayoutChange', { name, value: merged })
    }
  },

  async removePluginFromAllDashboards ({ state, dispatch, getters }, pluginId: string) {
    const keys = Object.keys(state.layouts).filter(
      k => k === 'dashboard' || k.startsWith('dashboard-')
    )
    for (const name of keys) {
      const layout = getters.getLayout(name)
      if (!layout) {
        continue
      }
      const stripped = removePluginFromDashboardLayout(layout, pluginId)
      await dispatch('onLayoutChange', { name, value: stripped })
    }
  },

  async onUpdateConfig ({ commit, state, dispatch }, payload: { name: string; value: LayoutConfig }) {
    let containers = state.layouts[payload.name]
    if (!containers) {
      // user/device specific layout doesn't exist yet, so we create it
      dispatch('onLayoutChange', { name: payload.name, value: state.layouts.dashboard })
      containers = state.layouts[payload.name]
    }

    if (containers) {
      for (const container in containers) {
        const i = containers[container].findIndex(layout => layout.id === payload.value.id)
        if (i >= 0) {
          commit('setUpdateConfig', { name: payload.name, container, i, value: payload.value })
          await SocketActions.serverDatabasePostItem(
            Globals.MOONRAKER_DB.fluidd.ROOTS.layout.name + `.layouts.${payload.name}.${container}`,
            state.layouts[payload.name][container]
          )
        }
      }
    }
  }
} satisfies ActionTree<LayoutState, RootState>
