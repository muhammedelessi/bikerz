import { ADMIN_ROLES, type UserProfile } from "@/types/auth";

const ADMIN_ROLE_SET = new Set<string>([...ADMIN_ROLES, "admin"].map((r) => r.toLowerCase()));

/**
 * Skip third-party marketing pixels and in-app public analytics for staff.
 * - `user_roles` → `canAccessAdmin` (global roles)
 * - `profiles.role` → e.g. `admin` or any `app_role` that is a staff role
 */
export function shouldSkipMarketingAnalytics(
  canAccessAdmin: boolean,
  profile: UserProfile | null
): boolean {
  if (canAccessAdmin) return true;
  const raw = profile?.role;
  if (raw == null || String(raw).trim() === "") return false;
  return ADMIN_ROLE_SET.has(String(raw).trim().toLowerCase());
}
