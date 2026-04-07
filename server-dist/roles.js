export const RoleHierarchy = {
    guest: 0,
    user: 1,
    owner: 2
};
export function hasMinRole(currentRole, minRole) {
    return RoleHierarchy[currentRole] >= RoleHierarchy[minRole];
}
//# sourceMappingURL=roles.js.map