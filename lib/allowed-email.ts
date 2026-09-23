/**
 * Optional allowlist. ALLOWED_EMAIL may hold one address or a comma-separated
 * list. When it is unset or empty, anyone may register (multi-user mode).
 */
export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function hasAllowlist(): boolean {
  return allowedEmails().length > 0;
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!hasAllowlist()) return Boolean(email);
  if (!email) return false;
  return allowedEmails().includes(email.trim().toLowerCase());
}
