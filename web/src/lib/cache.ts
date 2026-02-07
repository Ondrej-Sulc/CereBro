interface CacheEntry<T> {
  data: T;
  expires: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * A simple in-memory cache.
 * @param key The key to store the data under.
 * @param ttl The time-to-live in seconds.
 * @param fetchData A function that returns a promise resolving to the data to be cached.
 */
export async function getFromCache<T>(
  key: string, 
  ttl: number, 
  fetchData: () => Promise<T>,
  shouldCache?: (data: T) => boolean
): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key);

  if (existing && now < existing.expires) {
    // Return from cache
    return existing.data as T;
  }

  // Fetch new data
  const data = await fetchData();

  // Store in cache if allowed
  if (!shouldCache || shouldCache(data)) {
    cache.set(key, {
        data,
        expires: now + ttl * 1000,
    });
  }

  return data;
}
