/**
 * Minimal in-memory sliding-window rate limiter, scoped per process.
 * Good enough for a single-instance deploy; swap for a Redis-backed limiter
 * (e.g. Upstash) before running multiple server instances.
 */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (timestamps.length >= limit) {
    buckets.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  buckets.set(key, timestamps);
  return true;
}
