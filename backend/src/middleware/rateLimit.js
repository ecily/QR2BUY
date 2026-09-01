export function createRateLimiter({ windowMs, max, key = (req) => req.ip }) {
  const buckets = new Map();

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const bucketKey = String(key(req) || req.ip || 'unknown');
    let bucket = buckets.get(bucketKey);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(bucketKey, bucket);
    }

    bucket.count += 1;
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      return res.status(429).json({ ok: false, error: 'too many requests' });
    }

    if (buckets.size > 5000) {
      for (const [storedKey, stored] of buckets) {
        if (stored.resetAt <= now) buckets.delete(storedKey);
      }
    }

    return next();
  };
}
