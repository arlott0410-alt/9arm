import { NextResponse } from 'next/server';
import { getCachedSessionUser } from '@/lib/auth';
import { getSessionIdFromRequest } from '@/lib/session-cookie';
import { getEnvAndDb } from '@/lib/cf-env';
import { setNoStore } from '@/lib/cache-headers';

export async function GET(request: Request) {
  try {
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) {
      const res = NextResponse.json({ user: null }, { status: 200 });
      setNoStore(res);
      return res;
    }
    const result = getEnvAndDb();
    if (result instanceof NextResponse) return result;
    const { db, env } = result;
    const user = await getCachedSessionUser(db, sessionId, env);
    if (!user) {
      const res = NextResponse.json({ user: null }, { status: 200 });
      setNoStore(res);
      return res;
    }
    const res = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
    setNoStore(res);
    return res;
  } catch (err) {
    console.error('Auth me error:', err);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
