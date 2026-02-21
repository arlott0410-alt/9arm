export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { getDb } from '@/db';
import { settings } from '@/db/schema';

/** Diagnostic endpoint: checks env and DB. Visit /api/health to troubleshoot. */
export async function GET() {
  const checks: Record<string, string> = {};
  try {
    const { env } = getRequestContext();
    checks.env = 'ok';
    checks.DB = env?.DB ? 'bound' : 'missing';
    checks.APP_SECRET = env?.APP_SECRET ? 'set' : 'missing';
    checks.SUPERADMIN_USERNAME = env?.SUPERADMIN_USERNAME ? 'set' : 'not set';
    checks.SUPERADMIN_PASSWORD = env?.SUPERADMIN_PASSWORD ? 'set' : 'not set';

    if (env?.DB) {
      try {
        const db = getDb(env.DB);
        await db.select().from(settings).limit(1);
        checks.db_schema = 'ok';
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        checks.db_schema = /no such table|SQLITE_ERROR/i.test(msg)
          ? 'FAIL - run db/schema.sql in D1 Console'
          : `error: ${msg.slice(0, 100)}`;
      }
    }
    return NextResponse.json({ status: 'ok', checks });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { status: 'error', message: msg.slice(0, 200), checks },
      { status: 503 }
    );
  }
}
