/**
 * Rate Caching System for SeaRates API
 * 
 * Caches live carrier quotes for 24 hours to reduce API consumption.
 * Only applies to subscribed users getting SeaRates live rates.
 * 
 * Benefits:
 * - Reduces 50 API calls/month by ~50% (with typical reuse)
 * - Faster quote display for repeat routes
 * - Better user experience
 * - Saves money on API costs
 */

import { Quote } from './state';

export interface CachedRate {
  service: 'fcl' | 'lcl' | 'airfreight';
  route: {
    origin: string;
    destination: string;
  };
  requestParams: any; // Container types, cargo details, etc.
  quotes: Quote[];
  cachedAt: number; // timestamp
  expiresAt: number; // timestamp
  source: 'searates'; // Only cache API rates, not AI estimates
}

// Cache duration: 24 hours (86400000 milliseconds)
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * Generate a unique cache key for a rate request
 */
function generateCacheKey(
  service: 'fcl' | 'lcl' | 'airfreight',
  origin: string,
  destination: string,
  params: any
): string {
  // Create a stable hash of the parameters
  const paramsString = JSON.stringify(params, Object.keys(params).sort());
  const routeKey = `${origin}-${destination}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return `rate_cache_${service}_${routeKey}_${hashString(paramsString)}`;
}

/**
 * Simple string hash function for cache keys
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get cached rates if available and not expired
 */
export function getCachedRates(
  service: 'fcl' | 'lcl' | 'airfreight',
  origin: string,
  destination: string,
  params: any
): Quote[] | null {
  try {
    const cacheKey = generateCacheKey(service, origin, destination, params);
    const cachedData = localStorage.getItem(cacheKey);
    
    if (!cachedData) {
      console.log(`[Cache] No cached rates for ${service}: ${origin} → ${destination}`);
      return null;
    }

    const cached: CachedRate = JSON.parse(cachedData);
    const now = Date.now();

    // Check if cache has expired
    if (now > cached.expiresAt) {
      console.log(`[Cache] Expired rates for ${service}: ${origin} → ${destination}`);
      localStorage.removeItem(cacheKey);
      return null;
    }

    // Calculate remaining validity time
    const remainingHours = Math.ceil((cached.expiresAt - now) / (1000 * 60 * 60));
    console.log(`[Cache] HIT! Using cached ${service} rates (valid for ${remainingHours}h)`);

    return cached.quotes;

  } catch (error) {
    console.error('[Cache] Error reading cache:', error);
    return null;
  }
}

/**
 * Cache rates for 24 hours
 */
export function setCachedRates(
  service: 'fcl' | 'lcl' | 'airfreight',
  origin: string,
  destination: string,
  params: any,
  quotes: Quote[]
): void {
  try {
    const cacheKey = generateCacheKey(service, origin, destination, params);
    const now = Date.now();
    const expiresAt = now + CACHE_DURATION_MS;

    const cacheData: CachedRate = {
      service,
      route: { origin, destination },
      requestParams: params,
      quotes,
      cachedAt: now,
      expiresAt,
      source: 'searates',
    };

    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    
    const expiryDate = new Date(expiresAt);
    console.log(`[Cache] Saved ${service} rates until ${expiryDate.toLocaleString()}`);

  } catch (error) {
    console.error('[Cache] Error saving cache:', error);
    // If localStorage is full, clear old caches
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      clearExpiredCaches();
      // Try again after clearing
      try {
        const cacheKey = generateCacheKey(service, origin, destination, params);
        const cacheData: CachedRate = {
          service,
          route: { origin, destination },
          requestParams: params,
          quotes,
          cachedAt: Date.now(),
          expiresAt: Date.now() + CACHE_DURATION_MS,
          source: 'searates',
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      } catch (retryError) {
        console.error('[Cache] Failed to cache even after cleanup:', retryError);
      }
    }
  }
}

/**
 * Clear all expired caches to free up space
 */
export function clearExpiredCaches(): void {
  try {
    const now = Date.now();
    let clearedCount = 0;

    // Iterate through localStorage
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('rate_cache_')) {
        continue;
      }

      try {
        const cached: CachedRate = JSON.parse(localStorage.getItem(key)!);
        if (now > cached.expiresAt) {
          localStorage.removeItem(key);
          clearedCount++;
        }
      } catch (error) {
        // Invalid cache entry, remove it
        localStorage.removeItem(key);
        clearedCount++;
      }
    }

    if (clearedCount > 0) {
      console.log(`[Cache] Cleared ${clearedCount} expired cache entries`);
    }

  } catch (error) {
    console.error('[Cache] Error clearing expired caches:', error);
  }
}

/**
 * Clear all rate caches (useful for testing or manual refresh)
 */
export function clearAllRateCaches(): void {
  try {
    let clearedCount = 0;

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('rate_cache_')) {
        localStorage.removeItem(key);
        clearedCount++;
      }
    }

    console.log(`[Cache] Cleared all ${clearedCount} rate caches`);

  } catch (error) {
    console.error('[Cache] Error clearing all caches:', error);
  }
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats(): {
  totalCached: number;
  expired: number;
  active: number;
  oldestCache: Date | null;
  newestCache: Date | null;
} {
  let totalCached = 0;
  let expired = 0;
  let active = 0;
  let oldestTimestamp = Infinity;
  let newestTimestamp = 0;
  const now = Date.now();

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('rate_cache_')) {
        continue;
      }

      totalCached++;

      try {
        const cached: CachedRate = JSON.parse(localStorage.getItem(key)!);
        
        if (now > cached.expiresAt) {
          expired++;
        } else {
          active++;
        }

        if (cached.cachedAt < oldestTimestamp) {
          oldestTimestamp = cached.cachedAt;
        }
        if (cached.cachedAt > newestTimestamp) {
          newestTimestamp = cached.cachedAt;
        }

      } catch (error) {
        // Invalid entry
        expired++;
      }
    }

  } catch (error) {
    console.error('[Cache] Error getting stats:', error);
  }

  return {
    totalCached,
    expired,
    active,
    oldestCache: oldestTimestamp !== Infinity ? new Date(oldestTimestamp) : null,
    newestCache: newestTimestamp > 0 ? new Date(newestTimestamp) : null,
  };
}

/**
 * Get cache info for a specific rate
 */
export function getCacheInfo(
  service: 'fcl' | 'lcl' | 'airfreight',
  origin: string,
  destination: string,
  params: any
): { exists: boolean; expiresAt: Date | null; hoursRemaining: number | null } {
  try {
    const cacheKey = generateCacheKey(service, origin, destination, params);
    const cachedData = localStorage.getItem(cacheKey);
    
    if (!cachedData) {
      return { exists: false, expiresAt: null, hoursRemaining: null };
    }

    const cached: CachedRate = JSON.parse(cachedData);
    const now = Date.now();
    
    if (now > cached.expiresAt) {
      return { exists: false, expiresAt: null, hoursRemaining: null };
    }

    const hoursRemaining = Math.ceil((cached.expiresAt - now) / (1000 * 60 * 60));

    return {
      exists: true,
      expiresAt: new Date(cached.expiresAt),
      hoursRemaining,
    };

  } catch (error) {
    return { exists: false, expiresAt: null, hoursRemaining: null };
  }
}

// Auto-clear expired caches on module load
clearExpiredCaches();
