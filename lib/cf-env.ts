import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';

export type Env = {
  DB: D1Database;
  APP_SECRET: string;
  SESSION_TTL_HOURS?: string;
  SUPERADMIN_USERNAME?: string;
  SUPERADMIN_PASSWORD?: string;
};

/** Validates Cloudflare env and returns db + env, or an error response. */
export function getEnvAndDb(opts?: { requireAppSecret?: boolean }): { db: ReturnType<typeof getDb>; env: Env } | NextResponse {
  try {
    const { env } = getCloudflareContext();
    if (!env?.DB) {
      console.error('D1 binding "DB" is not configured. Add it in wrangler.jsonc d1_databases.');
      return NextResponse.json(
        { error: 'DB_NOT_CONFIGURED', message: 'Database binding is missing. Check wrangler config.' },
        { status: 503 }
      );
    }
    if (opts?.requireAppSecret !== false && !env?.APP_SECRET) {
      console.error('APP_SECRET environment variable is not set. Set it in Cloudflare Dashboard or .dev.vars.');
      return NextResponse.json(
        { error: 'APP_SECRET_MISSING', message: 'APP_SECRET is not configured.' },
        { status: 503 }
      );
    }
    const db = getDb(env.DB);
    return { db, env: env as Env };
  } catch (err) {
    console.error('Failed to get Cloudflare context:', err);
    return NextResponse.json(
      { error: 'RUNTIME_ERROR', message: 'Could not access runtime environment.' },
      { status: 503 }
    );
  }
}
