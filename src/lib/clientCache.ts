export const CACHE_TTL = {
  businesses: 5 * 60 * 1000,
  menu: 10 * 60 * 1000,
  banners: 5 * 60 * 1000,
  config: 5 * 60 * 1000,
  maintenance: 30 * 1000,
  default: 60 * 1000,
} as const;

type CacheEntry<T> = {
  expiresAt: number;
  data: T;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();

function readSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() > parsed.expiresAt) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeSession<T>(key: string, data: T, ttlMs: number) {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ expiresAt: Date.now() + ttlMs, data } satisfies CacheEntry<T>),
    );
  } catch {
    // Ignore quota errors
  }
}

export async function cachedFetch<T>(
  url: string,
  options?: RequestInit & { ttlMs?: number; persist?: boolean },
): Promise<T> {
  const method = (options?.method || "GET").toUpperCase();
  if (method !== "GET") {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json() as Promise<T>;
  }

  const ttlMs = options?.ttlMs ?? CACHE_TTL.default;
  const cacheKey = `fasty:${url}`;
  const memoryHit = memoryCache.get(cacheKey);
  if (memoryHit && Date.now() < memoryHit.expiresAt) {
    return memoryHit.data as T;
  }

  if (options?.persist) {
    const sessionHit = readSession<T>(cacheKey);
    if (sessionHit !== null) {
      memoryCache.set(cacheKey, { expiresAt: Date.now() + ttlMs, data: sessionHit });
      return sessionHit;
    }
  }

  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const data = (await res.json()) as T;

  memoryCache.set(cacheKey, { expiresAt: Date.now() + ttlMs, data });
  if (options?.persist) writeSession(cacheKey, data, ttlMs);
  return data;
}

export function invalidateClientCache(prefix = "fasty:") {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) memoryCache.delete(key);
  }
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(prefix)) sessionStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}
