import type { AuthState } from './types'

export const defaultState = (): AuthState => {
  return {
    authenticated: false,
    token: null,
    refresh_token: null,
    currentUser: null,
    users: [],
    apiKey: '',
    roles: {},
    moonrakerTrusted: false,
    moonrakerLoginRequired: false
  }
}

export const state = defaultState()
