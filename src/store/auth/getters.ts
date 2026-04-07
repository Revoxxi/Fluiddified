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
    const sole = soleMoonrakerUsername(state)
    if (sole === username) return 'owner'
    return state.roles[username] ?? 'guest'
  },

  getCurrentRole: (state, getters): Role => {
    // RBAC follows the logged-in Moonraker user (JWT + Fluidd role map).
    if (state.token && state.currentUser?.username) {
      return getters.getRoleForUser(state.currentUser.username)
    }
    if (state.currentUser?.username) {
      return getters.getRoleForUser(state.currentUser.username)
    }
    return 'guest'
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
