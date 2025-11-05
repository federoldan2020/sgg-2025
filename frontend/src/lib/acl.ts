import type { NavGroup, Role } from "../tipos/nav";

export function filterByRoles(
  groups: NavGroup[],
  userRoles: Role[]
): NavGroup[] {
  const hasRole = (allowed?: Role[]) =>
    !allowed ||
    allowed.length === 0 ||
    allowed.includes("ALL") ||
    allowed.some((r) => userRoles.includes(r));

  return groups
    .filter((g) => hasRole(g.roles))
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => hasRole(it.roles)),
    }))
    .filter((g) => g.items.length > 0);
}
