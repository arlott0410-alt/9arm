export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getEnvAndDb } from '@/lib/cf-env';
import { users, sessions } from '@/db/schema';
import {
  hashPassword,
  generateSalt,
  saltToHex,
  generateSessionId,
  getSessionTtlHours,
} from '@/lib/auth';
import { createSuperadminSchema } from '@/lib/validations';
import { buildSetCookieHeader } from '@/lib/session-cookie';
import { bootstrapSettings } from '@/lib/bootstrap';

export async function POST(request: Request) {
  try {
    const result = getEnvAndDb();
    if (result instanceof NextResponse) return result;
    const { db, env } = result;
    await bootstrapSettings(db);

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.role, 'SUPER_ADMIN'))
      .limit(1);
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Superadmin already exists. Setup is disabled.' },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
    const parsed = createSuperadminSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { username, password } = parsed.data;

    const duplicate = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    if (duplicate.length > 0) {
      return NextResponse.json(
        { error: 'Username already taken' },
        { status: 400 }
      );
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const now = new Date();

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

    const sessionId = generateSessionId();
    const ttlHours = getSessionTtlHours(env);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    await db.insert(sessions).values({
      id: sessionId,
      userId: inserted!.id,
      expiresAt,
      createdAt: now,
    });

    const secure = request.headers.get('x-forwarded-proto') === 'https' || false;
    const cookieHeader = buildSetCookieHeader(
      sessionId,
      ttlHours * 60 * 60,
      secure
    );

    const res = NextResponse.json({
      user: {
        id: inserted!.id,
        username,
        role: 'SUPER_ADMIN',
      },
    });
    res.headers.set('Set-Cookie', cookieHeader);
    return res;
  } catch (err) {
    console.error('Setup error:', err);
    const msg = err instanceof Error ? err.message : '';
    const isDbError = /no such table|SQLITE_ERROR|syntax error/i.test(msg);
    return NextResponse.json(
      {
        error: isDbError
          ? 'Database schema not initialized. Run db/schema.sql in D1 Console.'
          : 'Internal server error',
        code: isDbError ? 'DB_SCHEMA' : undefined,
      },
      { status: isDbError ? 503 : 500 }
    );
  }
}
