// Short-TTL cache for upstream API responses (quotes every 5-15s, option
// chains, etc.). Uses Upstash Redis over REST when configured; otherwise a
// per-instance in-memory map so local dev needs no infrastructure.

interface MemEntry {
  value: unknown;
  expires: number;
}

const g = globalThis as unknown as { __vantageMemCache?: Map<string, MemEntry> };
const mem = (g.__vantageMemCache ??= new Map<string, MemEntry>());

function upstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;
  return url && token ? { url, token } : null;
}

async function redisCommand<T>(cmd: (string | number)[]): Promise<T | null> {
  const cfg = upstashConfig();
  if (!cfg) return null;
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash command failed: ${res.status}`);
  const body = (await res.json()) as { result: T };
  return body.result;
}

/** Get `key` from cache, or compute it with `fn` and store for `ttlSeconds`. */
export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  if (upstashConfig()) {
    try {
      const hit = await redisCommand<string | null>(["GET", key]);
      if (hit != null) return JSON.parse(hit) as T;
      const value = await fn();
      await redisCommand(["SET", key, JSON.stringify(value), "EX", ttlSeconds]);
      return value;
    } catch (err) {
      // Redis being down shouldn't take the terminal down — fall through to compute.
      console.error("cache: redis unavailable, computing directly", err);
      return fn();
    }
  }

  const now = Date.now();
  const entry = mem.get(key);
  if (entry && entry.expires > now) return entry.value as T;
  const value = await fn();
  mem.set(key, { value, expires: now + ttlSeconds * 1000 });
  return value;
}
