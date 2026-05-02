// Simple in-memory rate limiter per serverless function instance.
// Counts requests per IP within a rolling time window.
// Not perfect across concurrent instances but meaningfully reduces abuse.

const counts = new Map()

export function rateLimit(req, { limit = 10, windowMs = 60_000 } = {}) {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    'unknown'

  const bucket = Math.floor(Date.now() / windowMs)
  const key = `${ip}:${bucket}`
  const count = (counts.get(key) || 0) + 1
  counts.set(key, count)

  // Prune stale buckets to avoid unbounded growth
  if (counts.size > 5_000) {
    for (const [k] of counts) {
      if (parseInt(k.split(':')[1]) < bucket - 1) counts.delete(k)
    }
  }

  return { allowed: count <= limit, count, limit }
}
