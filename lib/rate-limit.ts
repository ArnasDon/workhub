/**
 * Tiny in-memory sliding-window limiter for the auth actions. Good enough
 * for a single-process, single-user app; Supabase applies its own limits
 * on top. Keys are "<bucket>:<ip>".
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((windowMs - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    // Drop idle keys so the map cannot grow without bound.
    for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  }
  return { ok: true, retryAfterSec: 0 };
}

export function clientKey(headers: Headers, bucket: string): string {
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${bucket}:${fwd || headers.get("x-real-ip") || "local"}`;
}
