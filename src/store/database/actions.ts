import type { ActionTree } from 'vuex'
import type { DatabaseInfo, DatabaseState } from './types'
import type { RootState } from '../types'
import { SocketActions } from '@/api/socketActions'

export const actions = {
  async reset ({ commit }) {
    commit('setReset')
  },

  async init ({ rootGetters }) {
    if (!rootGetters['auth/hasMinRole']('owner')) {
      return
    }
    await SocketActions.serverDatabaseList()
  },

  async onServerDatabaseList ({ commit }, payload: DatabaseInfo) {
    commit('setServerDatabaseList', payload)
  },

  async onServerDatabasePostBackup ({ commit, dispatch }, payload: { backup_path: string }) {
    commit('setServerDatabasePostBackup', payload)
    Promise.resolve(
      dispatch('achievements/onDatabaseBackupCreated', undefined, { root: true })
    ).catch(() => undefined)
  },

  async onServerDatabaseDeleteBackup ({ commit }, payload: { backup_path: string }) {
    commit('setServerDatabaseDeleteBackup', payload)
  }
} satisfies ActionTree<DatabaseState, RootState>
