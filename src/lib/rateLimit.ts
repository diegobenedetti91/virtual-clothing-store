// Small in-memory limiter (single Node process). Good enough to stop password
// guessing and form abuse; resets on restart.

const buckets = new Map<string, { count: number; reset: number }>();

/** Returns true when `key` exceeded `limit` hits inside `windowMs`. */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (now > b.reset) buckets.delete(k);
    }
    return false;
  }
  bucket.count++;
  return bucket.count > limit;
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
}
