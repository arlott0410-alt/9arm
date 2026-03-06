/**
 * Thundering herd protection: deduplicate in-flight requests by key.
 * When multiple identical requests arrive while the first is still resolving,
 * they share the same Promise and thus a single D1 workload.
 *
 * IMPORTANT: The key must include every parameter that affects the response
 * (e.g. query string for dashboard/reports). Do not include user id when
 * the response is identical for all users with the same params.
 */
const inFlight = new Map<string, Promise<unknown>>();

export async function dedupeRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }
  const promise = fn().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise as Promise<unknown>);
  return promise;
}
