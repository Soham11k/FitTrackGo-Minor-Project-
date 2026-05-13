/**
 * Simple in-memory token-bucket rate limiter.
 *
 * For multi-region production, swap the store for Upstash Redis by passing a
 * different `store` when constructing. The interface is `get/set`.
 *
 * Usage:
 *   const limiter = new RateLimiter({ key: "wearables:live", max: 10, windowMs: 60_000 })
 *   const result = await limiter.check(userId)
 *   if (!result.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: result.headers })
 */

export interface RateLimitStore {
  get(key: string): Promise<Bucket | null>
  set(key: string, bucket: Bucket, ttlMs: number): Promise<void>
}

interface Bucket {
  tokens: number
  resetAt: number
}

class MemoryStore implements RateLimitStore {
  private map = new Map<string, Bucket>()

  async get(key: string): Promise<Bucket | null> {
    const v = this.map.get(key)
    if (!v) return null
    if (Date.now() > v.resetAt) {
      this.map.delete(key)
      return null
    }
    return v
  }

  async set(key: string, bucket: Bucket, _ttlMs: number): Promise<void> {
    void _ttlMs
    this.map.set(key, bucket)
  }
}

const sharedStore = new MemoryStore()

async function createKvRateLimitStore(): Promise<RateLimitStore | null> {
  const url = process.env.KV_REST_API_URL?.trim()
  const token = process.env.KV_REST_API_TOKEN?.trim()
  if (!url || !token) return null
  try {
    const kvmod = await import("@vercel/kv").catch(() => null as typeof import("@vercel/kv") | null)
    if (!kvmod?.kv) return null
    const kv = kvmod.kv
    return {
      async get(key: string): Promise<Bucket | null> {
        const raw = await kv.get<string>(key)
        if (!raw || typeof raw !== "string") return null
        try {
          const b = JSON.parse(raw) as Bucket
          if (typeof b.tokens !== "number" || typeof b.resetAt !== "number") return null
          if (Date.now() > b.resetAt) {
            await kv.del(key).catch(() => {})
            return null
          }
          return b
        } catch {
          return null
        }
      },
      async set(key: string, bucket: Bucket, ttlMs: number): Promise<void> {
        const px = Math.max(900, ttlMs, bucket.resetAt - Date.now() + 250)
        await kv.set(key, JSON.stringify(bucket), { px: Math.ceil(px) })
      },
    }
  } catch {
    return null
  }
}

/** Prefer Vercel KV when configured; fall back to memory (PR D1). */
let resolvedSharedStore: RateLimitStore | undefined

async function resolveSharedRateStore(): Promise<RateLimitStore> {
  if (resolvedSharedStore) return resolvedSharedStore
  const kvStore = await createKvRateLimitStore()
  resolvedSharedStore = kvStore ?? sharedStore
  return resolvedSharedStore
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number
  headers: Record<string, string>
}

export class RateLimiter {
  private key: string
  private max: number
  private windowMs: number
  private store: RateLimitStore

  constructor(opts: {
    key: string
    max: number
    windowMs: number
    store?: RateLimitStore
  }) {
    this.key = opts.key
    this.max = opts.max
    this.windowMs = opts.windowMs
    this.store = opts.store ?? sharedStore
  }

  async check(subject: string = ""): Promise<RateLimitResult> {
    const now = Date.now()
    const k = `${this.key}:${subject}`
    const existing = await this.store.get(k)

    let bucket: Bucket
    if (!existing || now > existing.resetAt) {
      bucket = { tokens: this.max - 1, resetAt: now + this.windowMs }
    } else {
      bucket = { tokens: existing.tokens - 1, resetAt: existing.resetAt }
    }

    await this.store.set(k, bucket, this.windowMs)

    const ok = bucket.tokens >= 0
    const remaining = Math.max(0, bucket.tokens)
    return {
      ok,
      remaining,
      resetAt: bucket.resetAt,
      headers: {
        "X-RateLimit-Limit": String(this.max),
        "X-RateLimit-Remaining": String(remaining),
        "X-RateLimit-Reset": String(Math.ceil(bucket.resetAt / 1000)),
        ...(ok
          ? {}
          : {
              "Retry-After": String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))),
            }),
      },
    }
  }
}

/**
 * Back-compat functional helper used by existing API routes.
 *
 * Existing call shape:
 *   const rate = await checkRateLimit({ key, limit, windowMs })
 *   if (!rate.allowed) { ... }
 */
export interface LegacyRateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  limit: number
  source: "memory" | "redis"
}

export async function checkRateLimit(opts: {
  key: string
  limit: number
  windowMs: number
  store?: RateLimitStore
}): Promise<LegacyRateLimitResult> {
  const store = opts.store ?? (await resolveSharedRateStore())
  const limiter = new RateLimiter({
    key: "legacy",
    max: opts.limit,
    windowMs: opts.windowMs,
    store,
  })
  const r = await limiter.check(opts.key)
  return {
    allowed: r.ok,
    remaining: r.remaining,
    resetAt: r.resetAt,
    limit: opts.limit,
    source: store === sharedStore ? "memory" : "redis",
  }
}

