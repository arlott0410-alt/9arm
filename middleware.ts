import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { logRouteMetric } from '@/lib/analytics';
import type { Env } from '@/lib/cf-env';

/** Sample 10% of API requests to AE to reduce write costs. */
const AE_SAMPLE_RATE = 0.1;

export async function middleware(request: NextRequest) {
  const start = Date.now();
  const response = NextResponse.next();

  // Cache-Control: ไม่ตั้งที่ middleware — แต่ละ route ตั้งเอง (semi-static ใช้ s-maxage, sensitive ใช้ no-store)

  // Analytics Engine: sample เท่านั้น เพื่อลด AE writes
  const pathname = request.nextUrl.pathname;
  if (pathname !== '/api/health' && Math.random() < AE_SAMPLE_RATE) {
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
      // AE optional
    }
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
