export type Role = 'owner' | 'user' | 'guest'

export const RoleHierarchy: Record<Role, number> = {
  guest: 0,
  user: 1,
  owner: 2
}

export type UserRoleMap = Record<string, Role>

export function hasMinRole (currentRole: Role, minRole: Role): boolean {
  return RoleHierarchy[currentRole] >= RoleHierarchy[minRole]
}
