import type { GetterTree } from 'vuex'
import type { AuthState } from './types'
import type { RootState } from '../types'
import { RoleHierarchy } from '@/types/auth'
import type { Role, Permission } from '@/types/auth'

function soleMoonrakerUsername (state: AuthState): string | null {
  return state.users.length === 1 ? state.users[0].username : null
}

/** Moonraker JWT claims — identity before `auth/init` hydrates `currentUser` from the socket. */
function sessionUsername (state: AuthState): string | undefined {
  const fromUser = state.currentUser?.username
  if (typeof fromUser === 'string' && fromUser.length > 0) return fromUser

  const payload = state.token
  if (payload == null || typeof payload !== 'object') return undefined
  const record = payload as Record<string, unknown>
  const username = record.username
  if (typeof username === 'string' && username.length > 0) return username
  const sub = record.sub
  if (typeof sub === 'string' && sub.length > 0) return sub
  return undefined
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
    // Multi-user host with no stored row yet: default to operator, not spectator — otherwise
    // legitimate logins look like `guest` and lose tool controls until DB hydrates.
    return 'user'
  },

  getCurrentRole: (state, getters): Role => {
    // RBAC uses JWT session + username. Prefer `currentUser` from the socket, but fall back
    // to JWT claims — otherwise there is a gap after reload where token is valid but
    // `auth/init` has not run yet, and UI wrongly treats the user as guest (no tool controls).
    if (!state.token || !state.authenticated) {
      return 'guest'
    }
    const username = sessionUsername(state)
    if (username == null) {
      return 'guest'
    }
    return getters.getRoleForUser(username)
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
