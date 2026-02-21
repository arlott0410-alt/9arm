export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { sessions } from '@/db/schema';
import { getSessionIdFromRequest } from '@/lib/session-cookie';
import { buildClearCookieHeader } from '@/lib/session-cookie';

export async function POST(request: Request) {
  try {
    const sessionId = getSessionIdFromRequest(request);
    if (sessionId) {
      const { env } = getRequestContext();
      const db = getDb(env.DB);
      await db.delete(sessions).where(eq(sessions.id, sessionId));
    }
    const res = NextResponse.json({ ok: true });
    res.headers.set('Set-Cookie', buildClearCookieHeader());
    return res;
  } catch (err) {
    console.error('Logout error:', err);
    return NextResponse.json({ ok: true });
  }
}
