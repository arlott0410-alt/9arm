/**
 * Cache-Control helpers for API routes.
 * Semi-static: edge cache (s-maxage + stale-while-revalidate).
 * Sensitive: no-store (set in route handler).
 */

/** Edge cache 60s, revalidate in background up to 300s. Use for semi-static GET (settings, holidays, rates). */
export const EDGE_CACHE_60 = 'public, s-maxage=60, stale-while-revalidate=300';

/** No cache — for user-specific or mutable data. */
export const NO_STORE = 'private, no-store, no-cache, must-revalidate';

export function setEdgeCache60(res: Response): void {
  res.headers.set('Cache-Control', EDGE_CACHE_60);
}

export function setNoStore(res: Response): void {
  res.headers.set('Cache-Control', NO_STORE);
  res.headers.set('Pragma', 'no-cache');
}
