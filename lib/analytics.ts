import type { Env } from '@/lib/cf-env';

/** Log a route metric to Analytics Engine (pathname, status, duration_ms). No sensitive data. */
export function logRouteMetric(
  env: Env,
  opts: { pathname: string; status: number; durationMs: number }
): void {
  if (!env.AE) return;
  try {
    const path = opts.pathname.slice(0, 96) || '/';
    env.AE.writeDataPoint({
      indexes: [path],
      blobs: [path, String(opts.status)],
      doubles: [opts.durationMs],
    });
  } catch {
    // non-blocking; ignore
  }
}
