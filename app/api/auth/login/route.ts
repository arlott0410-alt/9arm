export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { users, sessions } from '@/db/schema';
import { getEnvAndDb } from '@/lib/cf-env';
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
    const result = getEnvAndDb();
    if (result instanceof NextResponse) return result;
    const { db, env } = result;
    await bootstrapSettings(db);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { username, password } = parsed.data;

    let user: { id: number; username: string; role: string } | null = null;

    // Check Superadmin from Variables and Secrets first
    const superUsername = env.SUPERADMIN_USERNAME;
    const superPassword = env.SUPERADMIN_PASSWORD;
    if (superUsername && superPassword && username === superUsername && password === superPassword) {
      const { hashPassword, generateSalt, saltToHex } = await import('@/lib/auth');
      const now = new Date();
      const salt = generateSalt();
      const passwordHash = await hashPassword(password, salt);
      const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (existing.length > 0) {
        await db
          .update(users)
          .set({ passwordHash, salt: saltToHex(salt), updatedAt: now })
          .where(eq(users.id, existing[0].id));
        user = { id: existing[0].id, username, role: 'SUPER_ADMIN' };
      } else {
        const [inserted] = await db
          .insert(users)
          .values({
            username,
            role: 'SUPER_ADMIN',
            passwordHash,
            salt: saltToHex(salt),
            isActive: true,
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: users.id });
        user = { id: inserted!.id, username, role: 'SUPER_ADMIN' };
      }
    }

    if (!user) {
      const rows = await db
        .select()
        .from(users)
        .where(and(eq(users.username, username), eq(users.isActive, true)))
        .limit(1);
      const dbUser = rows[0];
      if (!dbUser) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
      const ok = await verifyPassword(password, dbUser.salt, dbUser.passwordHash);
      if (!ok) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
      user = { id: dbUser.id, username: dbUser.username, role: dbUser.role };
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
    const msg = err instanceof Error ? err.message : String(err);
    const isSchema = /no such table|SQLITE_ERROR|syntax error/i.test(msg);
    return NextResponse.json(
      {
        error: isSchema
          ? 'Database schema not initialized. Run db/schema.sql in D1 Console.'
          : 'Internal server error',
      },
      { status: isSchema ? 503 : 500 }
    );
  }
}
