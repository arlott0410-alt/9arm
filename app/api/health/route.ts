export const runtime = 'edge';

import { NextResponse } from 'next/server';

/**
 * Diagnostic endpoint. Minimal imports first to avoid Worker crash on load.
 * Visit /api/health to troubleshoot 500 errors.
 */
export async function GET() {
  const checks: Record<string, string> = {};
  try {
    checks.health = 'ok';

    // Cloudflare env - dynamic import to avoid crashing if context unavailable
    try {
      const { getRequestContext } = await import('@cloudflare/next-on-pages');
      const ctx = getRequestContext();
      const env = ctx?.env as Record<string, unknown> | undefined;
      if (env) {
        checks.env = 'ok';
        checks.DB = env.DB ? 'bound' : 'missing';
        checks.APP_SECRET = env.APP_SECRET ? 'set' : 'missing';
        checks.SUPERADMIN_USERNAME = env.SUPERADMIN_USERNAME ? 'set' : 'not set';
        checks.SUPERADMIN_PASSWORD = env.SUPERADMIN_PASSWORD ? 'set' : 'not set';

        if (env.DB) {
          try {
            const { getDb } = await import('@/db');
            const { settings } = await import('@/db/schema');
            const db = getDb(env.DB as D1Database);
            await db.select().from(settings).limit(1);
            checks.db_schema = 'ok';
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            checks.db_schema = /no such table|SQLITE_ERROR/i.test(msg)
              ? 'FAIL - run db/schema.sql in D1 Console'
              : `error: ${String(msg).slice(0, 80)}`;
          }
        }
      } else {
        checks.env = 'empty';
      }
    } catch (e) {
      checks.getRequestContext = `failed: ${String(e)}`;
    }

    return NextResponse.json({ status: 'ok', checks });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        status: 'error',
        message: String(msg).slice(0, 300),
        checks: Object.keys(checks).length > 0 ? checks : { note: 'error before checks' },
      },
      { status: 503 }
    );
  }
}
