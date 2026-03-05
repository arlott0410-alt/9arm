import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { logRouteMetric } from '@/lib/analytics';
import type { Env } from '@/lib/cf-env';

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

  // Analytics Engine: log pathname, status, duration_ms — ใช้ static import เพื่อไม่ให้ import() ช้าทุก request; ข้าม /api/health
  const pathname = request.nextUrl.pathname;
  if (pathname !== '/api/health') {
    try {
      const ctx = getCloudflareContext();
      const env = ctx?.env as Env | undefined;
      if (env?.AE) {
        logRouteMetric(env, {
          pathname,
          status: response.status,
          durationMs: Date.now() - start,
        });
      }
    } catch {
      // AE optional; skip if context unavailable (e.g. Edge)
    }
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
