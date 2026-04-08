import type { JwtPayload } from 'jwt-decode'
import type { Role, UserRoleMap } from '@/types/auth'

/**
 * - account_exists: user list returned ≥1 Moonraker user.
 * - login_prompt: show login UI; includes failed probes — do not assume accounts exist.
 * - register / blocked_untrusted: first-user or untrusted-without-users flows.
 * - loginRequired: from GET /access/info `login_required`; omit if that request failed.
 */
export type FirstUserSetupState =
  | { mode: 'account_exists'; loginRequired?: boolean }
  | { mode: 'login_prompt'; loginRequired?: boolean }
  | { mode: 'register'; loginRequired?: boolean }
  | { mode: 'blocked_untrusted'; loginRequired?: boolean }

export interface AuthState {
  authenticated: boolean;
  token: JwtPayload | null;
  refresh_token: JwtPayload | null;
  currentUser: AppUser | null;
  users: AppUser[];
  apiKey: string;
  roles: UserRoleMap;
  /** From Moonraker GET /access/info when the client is a trusted client (e.g. LAN). */
  moonrakerTrusted: boolean;
  /** From Moonraker GET /access/info `login_required` (e.g. force_logins). When true, trust must not bypass Fluidd session for the socket or default roles. */
  moonrakerLoginRequired: boolean;
}

export interface AppUser {
  username: string;
  password?: string;
  source: string;
  created_on?: number;
  /**
   * Moonraker does not persist RBAC; Fluidd stores roles in `AuthState.roles` by username.
   * When present on the wire, ignored for permission checks in favour of `roles`.
   */
  role?: Role;
}
