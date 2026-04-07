import type { GetterTree } from 'vuex'
import type { AuthState } from './types'
import type { RootState } from '../types'
import { RoleHierarchy } from '@/types/auth'
import type { Role, Permission } from '@/types/auth'

function soleMoonrakerUsername (state: AuthState): string | null {
  return state.users.length === 1 ? state.users[0].username : null
}

export const getters = {
  /**
   * Stored Fluidd role for a Moonraker username, with sole-account always owner.
   */
  getRoleForUser: (state) => (username: string): Role => {
    // Respect an explicit Fluidd role from the UI DB first (e.g. guest on a multi-user host).
    // Sole-account default-owner applies only when there is no stored role for that user.
    if (Object.prototype.hasOwnProperty.call(state.roles, username)) {
      return state.roles[username]
    }
    const sole = soleMoonrakerUsername(state)
    if (sole === username) return 'owner'
    return 'guest'
  },

  getCurrentRole: (state, getters): Role => {
    // RBAC follows a real JWT session only. Moonraker may accept API keys or trusted
    // clients for HTTP/WS, and the app may still receive `currentUser` from the socket —
    // that must not grant Fluidd owner/user without `token` + `authenticated`.
    if (!state.token || !state.authenticated || !state.currentUser?.username) {
      return 'guest'
    }
    return getters.getRoleForUser(state.currentUser.username)
  },

  hasPermission: (_state, getters) => (permission: Permission): boolean => {
    const userRole: Role = getters.getCurrentRole
    return RoleHierarchy[userRole] >= RoleHierarchy[permission.minRole]
  },

  hasMinRole: (_state, getters) => (minRole: Role): boolean => {
    const userRole: Role = getters.getCurrentRole
    return RoleHierarchy[userRole] >= RoleHierarchy[minRole]
  },

  isOwner: (_state, getters): boolean => getters.getCurrentRole === 'owner',
  isUser: (_state, getters): boolean => getters.hasMinRole('user'),
  isGuest: (_state, getters): boolean => getters.getCurrentRole === 'guest',

  /**
   * Full UI (toolbar, drawers, dashboard): requires a logged-in session (JWT).
   */
  uiSessionActive: (state): boolean => {
    return Boolean(state.token && state.authenticated)
  },

  /**
   * Create/delete Moonraker login users: Fluidd owner only (Moonraker enforces policy on POST).
   */
  canManageMoonrakerAccounts: (state, getters): boolean => {
    return getters.getCurrentRole === 'owner'
  }
} satisfies GetterTree<AuthState, RootState>
