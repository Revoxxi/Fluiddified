import Vue from 'vue'
import axios from 'axios'
import type { ActionTree } from 'vuex'
import type { AuthState, FirstUserSetupState } from './types'
import type { RootState } from '../types'
import type { Role, UserRoleMap } from '@/types/auth'
import { httpClientActions } from '@/api/httpClientActions'
import { consola } from 'consola'
import { Globals } from '@/globals'
import { SocketActions } from '@/api/socketActions'
import { jwtDecode } from 'jwt-decode'

export const actions = {
  async reset ({ commit }) {
    commit('setReset')
  },

  async init ({ commit, dispatch }) {
    await Promise.all([
      SocketActions.accessGetUser()
        .then(response => commit('setCurrentUser', response)),

      SocketActions.accessUsersList()
        .then(response => commit('setUsers', response.users))
    ])

    await dispatch('normalizeSoleAccountRoles')
    await dispatch('loadApiKeyIfOwner')
  },

  async loadApiKeyIfOwner ({ commit, rootGetters }) {
    if (!rootGetters['auth/hasMinRole']('owner')) return
    try {
      const response = await SocketActions.accessGetApiKey()
      commit('setApiKey', response)
    } catch {
      // Moonraker rejects when session is not allowed — ignore.
    }
  },

  /**
   * Single Moonraker user is always Fluidd owner; persist so DB matches RBAC.
   */
  async normalizeSoleAccountRoles ({ commit, state }) {
    if (state.users.length !== 1) return
    const username = state.users[0].username
    if (state.roles[username] === 'owner') return
    commit('setUserRole', { username, role: 'owner' })
    try {
      await SocketActions.serverDatabasePostItem('auth', { roles: state.roles })
    } catch (e) {
      consola.warn('[auth] normalizeSoleAccountRoles persist failed', e)
    }
  },

  async initRoles ({ commit, state, dispatch }, payload: { roles?: UserRoleMap } | undefined) {
    const roles = payload?.roles ?? {}
    commit('setRoles', roles)

    if (state.currentUser && !roles[state.currentUser.username]) {
      const isFirstUser = Object.keys(roles).length === 0
      const defaultRole: Role = isFirstUser
        ? 'owner'
        : (state.moonrakerLoginRequired ? 'guest' : 'user')
      commit('setUserRole', { username: state.currentUser.username, role: defaultRole })
      try {
        await SocketActions.serverDatabasePostItem('auth', { roles: state.roles })
      } catch (e) {
        consola.warn('[auth] initRoles default role persist failed', e)
      }
    }

    await dispatch('normalizeSoleAccountRoles')
  },

  async setUserRole ({ commit, state, rootGetters }, payload: { username: string, role: Role }) {
    if (!rootGetters['auth/isOwner']) {
      consola.warn('setUserRole denied: owner role required')
      throw new Error('Permission denied')
    }
    if (
      state.users.length === 1 &&
      state.users[0].username === payload.username &&
      payload.role !== 'owner'
    ) {
      consola.warn('setUserRole denied: sole account must remain owner')
      throw new Error('Permission denied')
    }
    commit('setUserRole', payload)
    SocketActions.serverDatabasePostItem('auth', { roles: state.roles })
  },

  async deleteUserRole (
    { commit, state, rootGetters },
    payload: string | { username: string, fromServer?: boolean }
  ) {
    const username = typeof payload === 'string' ? payload : payload.username
    const fromServer = typeof payload === 'object' && payload.fromServer === true
    if (!fromServer && !rootGetters['auth/canManageMoonrakerAccounts']) {
      consola.warn('deleteUserRole denied')
      throw new Error('Permission denied')
    }
    commit('deleteUserRole', username)
    SocketActions.serverDatabasePostItem('auth', { roles: state.roles })
  },

  async initAuth ({ commit, rootState, rootGetters }) {
    if (rootState.config.apiUrl === '') {
      commit('setAuthenticated', true)
      return
    }

    const keys = rootGetters['config/getTokenKeys']
    const refreshToken = localStorage.getItem(keys['refresh-token'])
    const token = localStorage.getItem(keys['user-token'])
    if (token && refreshToken) {
      commit('setToken', token)
      commit('setRefreshToken', refreshToken)
      httpClientActions.defaults.headers.common.Authorization = `Bearer ${token}`
      try {
        const decoded = jwtDecode<{ exp?: number }>(token)
        const nowSec = Date.now() / 1000
        if (decoded.exp == null || decoded.exp > nowSec) {
          commit('setAuthenticated', true)
        }
      } catch {
        /* corrupt token in storage */
      }
    } else {
      delete httpClientActions.defaults.headers.common.Authorization
    }
  },

  async checkToken ({ state }) {
    if (state.token?.exp) {
      const exp = state.token.exp
      const now = Date.now() / 1000
      const isExpiring = (exp - now) < 300
      if (isExpiring) {
        consola.debug('checkToken - isExpiring', new Date(now * 1000), new Date(exp * 1000))
        return true
      } else {
        return false
      }
    }
    return false
  },

  async refreshTokens ({ commit, rootGetters }) {
    const keys = rootGetters['config/getTokenKeys']
    const refresh_token = localStorage.getItem(keys['refresh-token'])

    try {
      const response = await SocketActions.accessRefreshJwt(refresh_token || '')

      localStorage.setItem(keys['user-token'], response.token)
      commit('setToken', response.token)
      httpClientActions.defaults.headers.common.Authorization = `Bearer ${response.token}`
      return response.token
    } catch {
      // Error on refresh — 401 will redirect to login.
    }
  },

  async getAuthInfo () {
    try {
      const response = await httpClientActions.accessInfoGet({
        withAuth: false,
        timeout: Globals.AUTH_HTTP_PROBE_MS
      })

      return {
        defaultSource: response.data.result.default_source,
        availableSources: response.data.result.available_sources
      }
    } catch {
      return {}
    }
  },

  async getFirstUserSetupState (): Promise<FirstUserSetupState> {
    try {
      const infoRes = await httpClientActions.accessInfoGet({
        withAuth: false,
        timeout: Globals.AUTH_HTTP_PROBE_MS
      })
      const info = infoRes.data.result
      const sources = info.available_sources ?? []

      const lr = info.login_required

      if (!sources.includes('moonraker')) {
        return { mode: 'login_prompt', loginRequired: lr }
      }

      let userCount: number
      try {
        const usersRes = await httpClientActions.accessUsersListGet({
          withAuth: false,
          timeout: Globals.AUTH_HTTP_PROBE_MS
        })
        userCount = usersRes.data.result.users?.length ?? 0
      } catch (error: unknown) {
        // Fresh Moonraker installs often reject GET /access/users/list without a session
        // even from trusted clients — that used to force login_prompt and block first-user UI.
        if (axios.isAxiosError(error) && error.code === 'ERR_NETWORK') {
          return { mode: 'login_prompt', loginRequired: lr }
        }
        // With force_logins / untrusted clients, Moonraker returns 401 for this probe while
        // accounts still exist — always use Fluidd login, not "create first user".
        const status = axios.isAxiosError(error) ? error.response?.status : 0
        if (status === 401 || status === 403) {
          return { mode: 'account_exists', loginRequired: lr }
        }
        if (info.trusted === true) {
          consola.debug(
            'access/users/list probe failed; trusted client — first-user registration on login page',
            error
          )
          return { mode: 'register', loginRequired: lr }
        }
        return { mode: 'blocked_untrusted', loginRequired: lr }
      }

      if (userCount > 0) {
        return { mode: 'account_exists', loginRequired: lr }
      }

      if (!info.trusted) {
        return { mode: 'blocked_untrusted', loginRequired: lr }
      }

      return { mode: 'register', loginRequired: lr }
    } catch {
      return { mode: 'login_prompt' }
    }
  },

  async registerFirstUser ({ commit, dispatch, rootGetters }, { username, password }: { username: string, password: string }) {
    const keys = rootGetters['config/getTokenKeys']

    try {
      const response = await httpClientActions.accessPostUserCreate(username, password, {
        withAuth: false,
        headers: {
          Authorization: undefined
        }
      })

      const user = response.data.result

      localStorage.setItem(keys['user-token'], user.token)
      localStorage.setItem(keys['refresh-token'], user.refresh_token)
      httpClientActions.defaults.headers.common.Authorization = `Bearer ${user.token}`
      commit('setAuthenticated', true)
      commit('setCurrentUser', {
        username: user.username,
        source: user.source
      })
      commit('setToken', user.token)
      commit('setRefreshToken', user.refresh_token)

      await dispatch('initRoles', undefined)

      return user
    } catch (error: unknown) {
      localStorage.removeItem(keys['user-token'])
      localStorage.removeItem(keys['refresh-token'])
      delete httpClientActions.defaults.headers.common.Authorization
      throw error
    }
  },

  async login ({ commit, dispatch, rootGetters }, { username, password, source }) {
    const keys = rootGetters['config/getTokenKeys']

    try {
      const response = await httpClientActions.accessLoginPost(username, password, source, {
        headers: {
          Authorization: undefined
        }
      })

      const user = response.data.result

      localStorage.setItem(keys['user-token'], user.token)
      localStorage.setItem(keys['refresh-token'], user.refresh_token)
      httpClientActions.defaults.headers.common.Authorization = `Bearer ${user.token}`
      commit('setAuthenticated', true)
      commit('setCurrentUser', {
        username: user.username,
        source: user.source
      })
      commit('setToken', user.token)
      commit('setRefreshToken', user.refresh_token)

      await dispatch('initRoles', undefined)

      return user
    } catch (error: unknown) {
      localStorage.removeItem(keys['user-token'])
      localStorage.removeItem(keys['refresh-token'])
      delete httpClientActions.defaults.headers.common.Authorization
      throw error
    }
  },

  async logout ({ commit, rootGetters }, options?: { invalidate: boolean; partial: boolean }) {
    const opts = {
      invalidate: false,
      partial: false,
      ...options
    }

    const keys = rootGetters['config/getTokenKeys']

    if (opts.invalidate) await httpClientActions.accessLogoutPost()

    localStorage.removeItem(keys['user-token'])
    localStorage.removeItem(keys['refresh-token'])

    delete httpClientActions.defaults.headers.common.Authorization

    commit('setCurrentUser', null)
    commit('setToken', null)
    commit('setRefreshToken', null)

    if (!opts.partial) {
      if (Vue.$socket) Vue.$socket.close()
      commit('setAuthenticated', false)
      if (Vue.$filters.getCurrentRouteName() !== 'login') {
        await Vue.$filters.routeTo({ name: 'login' })
      }
    }
  },

  async checkTrust ({ dispatch, commit, rootGetters }) {
    const keys = rootGetters['config/getTokenKeys']
    const token = localStorage.getItem(keys['user-token'])

    delete httpClientActions.defaults.headers.common.Authorization

    try {
      const response = await httpClientActions.accessCurrentUserGet({ withAuth: false })

      const user = response.data.result

      httpClientActions.defaults.headers.common.Authorization = `Bearer ${token}`

      dispatch('logout', { partial: true })
      commit('setCurrentUser', user)
    } catch {
      dispatch('logout')
    }
  },

  async addUser ({ rootGetters }, user) {
    if (!rootGetters['auth/canManageMoonrakerAccounts']) {
      consola.warn('addUser denied')
      throw new Error('Permission denied')
    }
    await SocketActions.accessPostUser(user.username, user.password)

    return user
  },

  async removeUser ({ dispatch, rootGetters }, user) {
    if (!rootGetters['auth/canManageMoonrakerAccounts']) {
      consola.warn('removeUser denied')
      throw new Error('Permission denied')
    }
    await SocketActions.accessDeleteUser(user.username)
    await dispatch('deleteUserRole', user.username)
    await dispatch('normalizeSoleAccountRoles')

    return user
  },

  async onUserCreated ({ commit }, user) {
    commit('setAddUser', user)
  },

  async onUserDeleted ({ commit, dispatch }, user) {
    commit('setRemoveUser', user)
    await dispatch('deleteUserRole', { username: user.username, fromServer: true })
    await dispatch('normalizeSoleAccountRoles')
  },

  async refreshApiKey ({ commit }) {
    const key = await SocketActions.accessPostApiKey()

    commit('setApiKey', key)
  }
} satisfies ActionTree<AuthState, RootState>
