import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { sessions } from '@/db/schema';
import { getSessionIdFromRequest } from '@/lib/session-cookie';
import { buildClearCookieHeader } from '@/lib/session-cookie';
import { getEnvAndDb } from '@/lib/cf-env';

export async function POST(request: Request) {
  try {
    const sessionId = getSessionIdFromRequest(request);
    if (sessionId) {
      const result = getEnvAndDb({ requireAppSecret: false });
      if (result instanceof NextResponse) return result;
      const { db } = result;
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
