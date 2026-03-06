/**
 * Stable cache key for list count. Excludes page/pageSize so all pages share same count.
 * Sorts params so key is deterministic.
 */
export function listCountCacheKey(route: string, searchParams: URLSearchParams): string {
  const exclude = new Set(['page', 'pageSize', 'cursor', 'limit']);
  const entries = [...searchParams.entries()].filter(([k]) => !exclude.has(k));
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  const q = entries.map(([k, v]) => `${k}=${v}`).join('&');
  return `listcount:${route}:${q}`;
}
