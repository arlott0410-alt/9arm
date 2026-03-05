import { NextResponse } from 'next/server';

/**
 * Lightweight health check for load balancers / monitoring.
 * Does not hit DB on every request to reduce Worker invocations.
 */
export async function GET() {
  const res = NextResponse.json({
    ok: true,
    ts: new Date().toISOString(),
  });
  res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  return res;
}
