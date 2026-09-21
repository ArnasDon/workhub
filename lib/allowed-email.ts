/**
 * Single-user gate. ALLOWED_EMAIL may hold one address or a comma-separated
 * list (handy if you have a work and a personal address). Unset → nobody.
 */
export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return allowedEmails().includes(email.trim().toLowerCase());
}
