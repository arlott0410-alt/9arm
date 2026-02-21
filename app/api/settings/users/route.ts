export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getDbAndUser, requireSettings } from '@/lib/api-helpers';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createUserSchema, updateUserSchema } from '@/lib/validations';
import {
  hashPassword,
  generateSalt,
  saltToHex,
} from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireSettings(user);
    if (err) return err;

    const list = await db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .orderBy(users.username);
    return NextResponse.json(list);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireSettings(user);
    if (err) return err;

    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, parsed.data.username))
      .limit(1);
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 400 }
      );
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(parsed.data.password, salt);
    const now = new Date();

    const [inserted] = await db
      .insert(users)
      .values({
        username: parsed.data.username,
        role: parsed.data.role,
        passwordHash,
        salt: saltToHex(salt),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: users.id,
        username: users.username,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });
    return NextResponse.json(inserted);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
