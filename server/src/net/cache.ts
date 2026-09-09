export interface CacheEntry {
  body: string;
  status: number;
  hash: string;
  fetchedAt: number;
}

export interface ResponseCache {
  get(key: string, now: number): CacheEntry | undefined;
  set(key: string, entry: CacheEntry, ttlMs: number): void;
}

export function createMemoryCache(): ResponseCache {
  const store = new Map<string, { entry: CacheEntry; expiresAt: number }>();
  return {
    get(key, now) {
      const hit = store.get(key);
      if (!hit) return undefined;
      if (now >= hit.expiresAt) {
        store.delete(key);
        return undefined;
      }
      return hit.entry;
    },
    set(key, entry, ttlMs) {
      store.set(key, { entry, expiresAt: entry.fetchedAt + ttlMs });
    },
  };
}
