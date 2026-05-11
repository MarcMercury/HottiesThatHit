// Single source of truth for who is allowed to use the Admin area.
// Only this email can access /admin and the /api/admin/* routes,
// regardless of the `is_admin` flag in the profiles table.
export const ADMIN_EMAIL = 'marc.h.mercury@gmail.com';

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}
