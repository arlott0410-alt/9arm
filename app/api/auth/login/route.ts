export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/db';
import { users, sessions } from '@/db/schema';
import {
  verifyPassword,
  generateSessionId,
  getSessionTtlHours,
} from '@/lib/auth';
import { loginSchema } from '@/lib/validations';
import {
  getSessionIdFromRequest,
  buildSetCookieHeader,
} from '@/lib/session-cookie';
import { bootstrapSettings } from '@/lib/bootstrap';

export async function POST(request: Request) {
  try {
    const { env } = getRequestContext();
    const db = getDb(env.DB);
    await bootstrapSettings(db);

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { username, password } = parsed.data;

    const rows = await db
      .select()
      .from(users)
      .where(and(eq(users.username, username), eq(users.isActive, true)))
      .limit(1);
    const user = rows[0];
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const ok = await verifyPassword(password, user.salt, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const sessionId = generateSessionId();
    const ttlHours = getSessionTtlHours(env);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    const now = new Date();

    await db.insert(sessions).values({
      id: sessionId,
      userId: user.id,
      expiresAt,
      createdAt: now,
    });

    await db
      .update(users)
      .set({ lastLoginAt: now, updatedAt: now })
      .where(eq(users.id, user.id));

    const secure = request.headers.get('x-forwarded-proto') === 'https' || false;
    const cookieHeader = buildSetCookieHeader(
      sessionId,
      ttlHours * 60 * 60,
      secure
    );

    const res = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
    res.headers.set('Set-Cookie', cookieHeader);
    return res;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
