/**
 * Simple in-memory cache for Cadro.
 * Stores data in a module-level Map so it persists across route changes
 * within the same session. Each entry has a TTL (default 60s).
 *
 * Usage:
 *   import { setCache, getCache } from '../lib/cache'
 *   const cached = getCache('recipes')
 *   if (cached) { setData(cached); return }
 *   // ... fetch ...
 *   setCache('recipes', freshData)
 */

const store = new Map()
const DEFAULT_TTL_MS = 60_000  // 60 seconds

export function setCache(key, value, ttlMs = DEFAULT_TTL_MS) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
}

export function getCache(key) {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { store.delete(key); return null }
  return entry.value
}

export function invalidateCache(key) {
  store.delete(key)
}

export function invalidateAll() {
  store.clear()
}
