import Vue from 'vue'
import type { MutationTree } from 'vuex'
import { defaultState } from './state'
import type { AuthState } from './types'
import { jwtDecode } from 'jwt-decode'
import type { Role, UserRoleMap } from '@/types/auth'

export const mutations = {
  setReset (state) {
    Object.assign(state, defaultState())
  },

  setCurrentUser (state, user) {
    state.currentUser = user
  },

  setToken (state, token) {
    state.token = (token) ? jwtDecode(token) : null
  },

  setRefreshToken (state, token) {
    state.refresh_token = (token) ? jwtDecode(token) : null
  },

  setAuthenticated (state, authenticated) {
    state.authenticated = authenticated
  },

  setMoonrakerTrusted (state, trusted: boolean) {
    state.moonrakerTrusted = trusted
  },

  setMoonrakerLoginRequired (state, loginRequired: boolean) {
    state.moonrakerLoginRequired = loginRequired
  },

  setUsers (state, users) {
    state.users = users
  },

  setAddUser (state, user) {
    state.users.push({ source: 'moonraker', ...user })
  },

  setRemoveUser (state, user) {
    const i = state.users.findIndex(u => u.username === user.username)
    if (i >= 0) state.users.splice(i, 1)
  },

  setApiKey (state, key) {
    state.apiKey = key
  },

  setRoles (state, roles: UserRoleMap) {
    state.roles = roles
  },

  setUserRole (state, payload: { username: string, role: Role }) {
    Vue.set(state.roles, payload.username, payload.role)
  },

  deleteUserRole (state, username: string) {
    Vue.delete(state.roles, username)
  }
} satisfies MutationTree<AuthState>
