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
    // When Moonraker requires login, unknown Fluidd rows default to guest until an owner
    // assigns a role (`moonrakerTrusted` does not elevate this for authenticated users).
    if (state.moonrakerLoginRequired) return 'guest'
    return 'user'
  },

  /**
   * Whether the app may open the Moonraker WebSocket (bootstrap / idle connection).
   * - With a Fluidd JWT session (`uiSessionActive`), always allow when API is up.
   * - Without login, allow when the HTTP API is reachable **or** Moonraker marks the client
   *   trusted (first-user / LAN setup only). This does **not** grant widget or socket method
   *   permissions; `getCurrentRole` and `checkMethodPermission` ignore `moonrakerTrusted`.
   */
  shouldConnectSocket: (state, getters) => (opts: {
    apiConnected: boolean
    apiAuthenticated: boolean
    socketUrl?: string
  }): boolean => {
    if (!opts.socketUrl || !opts.apiConnected) return false
    const session = getters.uiSessionActive
    const trustBypass =
      !state.moonrakerLoginRequired &&
      (opts.apiAuthenticated || state.moonrakerTrusted)
    return session || trustBypass
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
