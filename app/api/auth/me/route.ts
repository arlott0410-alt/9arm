export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { getDb } from '@/db';
import { getSessionUser } from '@/lib/auth';
import { getSessionIdFromRequest } from '@/lib/session-cookie';

export async function GET(request: Request) {
  try {
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) {
      return NextResponse.json({ user: null }, { status: 200 });
    }
    const { env } = getRequestContext();
    const db = getDb(env.DB);
    const user = await getSessionUser(db, sessionId, env.APP_SECRET);
    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }
    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Auth me error:', err);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
