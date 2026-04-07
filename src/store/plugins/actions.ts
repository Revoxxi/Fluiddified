import type { ActionTree } from 'vuex'
import type { PluginsState } from './types'
import type { RootState } from '../types'
import { consola } from 'consola'
import { pluginRegistry } from '@/plugins/pluginRegistry'
import { SocketActions } from '@/api/socketActions'
import {
  canUserDisablePlugin,
  canUserRemovePlugin,
  isNativeBundledPlugin
} from '@/util/nativePluginPolicy'
import { addRemovedExternalPluginId, deleteUserZip, isUserZipPluginId } from '@/util/userPluginPersistence'
import { installUserPluginFromZipFile, revokeUserPluginBlob } from '@/util/userPluginZip'

export const actions = {
  async reset ({ commit }) {
    commit('setReset')
  },

  async initPlugins ({ commit }, payload: { disabled?: string[] } | undefined) {
    const raw = payload?.disabled ?? []
    const disabled = raw.filter(
      id => !isNativeBundledPlugin(id) || canUserDisablePlugin(id)
    )
    commit('setDisabled', disabled)
    commit('setRegistered', pluginRegistry.getAll().map(m => m.id))
  },

  async enablePlugin ({ commit, state }, id: string) {
    commit('removeDisabled', id)
    SocketActions.serverDatabasePostItem('plugins', { disabled: state.disabled })
  },

  async disablePlugin ({ commit, state }, id: string) {
    if (!canUserDisablePlugin(id)) {
      consola.warn('[plugins] Refusing to disable built-in widget:', id)
      return
    }
    commit('addDisabled', id)
    SocketActions.serverDatabasePostItem('plugins', { disabled: state.disabled })
  },

  async removePlugin ({ commit, state, dispatch }, id: string) {
    if (!canUserRemovePlugin(id)) {
      return
    }
    if (isUserZipPluginId(id)) {
      revokeUserPluginBlob(id)
      deleteUserZip(id)
    } else {
      addRemovedExternalPluginId(id)
    }
    pluginRegistry.unregister(id)
    commit('removeDisabled', id)
    await dispatch('layout/removePluginFromAllDashboards', id, { root: true })
    commit('setRegistered', pluginRegistry.getAll().map(m => m.id))
    await SocketActions.serverDatabasePostItem('plugins', { disabled: state.disabled })
  },

  async installPluginFromZip ({ commit, dispatch }, file: File) {
    const result = await installUserPluginFromZipFile(file)
    if (!result.ok) {
      commit('setLoadError', { id: '__zip_install__', error: result.error })
      return result
    }
    commit('clearLoadError', '__zip_install__')
    commit('setRegistered', pluginRegistry.getAll().map(m => m.id))
    await dispatch('layout/appendRegisteredPluginToDashboards', result.id, { root: true })
    await dispatch('achievements/onPluginZipInstalled', undefined, { root: true })
    return result
  }
} satisfies ActionTree<PluginsState, RootState>
