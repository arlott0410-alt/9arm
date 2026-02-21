import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { getDb } from '@/db';

type Env = {
  DB: D1Database;
  APP_SECRET: string;
  SESSION_TTL_HOURS?: string;
};

/** Validates Cloudflare env and returns db + env, or an error response. */
export function getEnvAndDb(opts?: { requireAppSecret?: boolean }): { db: ReturnType<typeof getDb>; env: Env } | NextResponse {
  try {
    const { env } = getRequestContext();
    if (!env?.DB) {
      console.error('D1 binding "DB" is not configured. Add it in Cloudflare Pages → Settings → Functions → D1 database bindings.');
      return NextResponse.json(
        { error: 'DB_NOT_CONFIGURED', message: 'Database binding is missing. Check Cloudflare Pages settings.' },
        { status: 503 }
      );
    }
    if (opts?.requireAppSecret !== false && !env?.APP_SECRET) {
      console.error('APP_SECRET environment variable is not set. Add it in Cloudflare Pages → Settings → Environment variables.');
      return NextResponse.json(
        { error: 'APP_SECRET_MISSING', message: 'APP_SECRET is not configured. Check Cloudflare Pages settings.' },
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
