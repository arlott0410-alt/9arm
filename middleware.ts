import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const start = Date.now();
  const response = NextResponse.next();

  // Disable caching for all API routes (user-specific, dynamic data)
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, private'
    );
    response.headers.set('Pragma', 'no-cache');
  }

  // Analytics Engine: log pathname, status, duration_ms (no sensitive data)
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = getCloudflareContext();
    const env = ctx?.env as import('@/lib/cf-env').Env | undefined;
    if (env?.AE) {
      const { logRouteMetric } = await import('@/lib/analytics');
      logRouteMetric(env, {
        pathname: request.nextUrl.pathname,
        status: response.status,
        durationMs: Date.now() - start,
      });
    }
  } catch {
    // AE optional; skip if context unavailable (e.g. Edge)
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
