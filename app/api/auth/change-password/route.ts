import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth } from '@/lib/api-helpers';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { changeOwnPasswordSchema } from '@/lib/validations';
import { hashPassword, generateSalt, saltToHex, verifyPassword } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireAuth(user);
    if (err) return err;

    const body = await request.json();
    const parsed = changeOwnPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const [target] = await db
      .select()
      .from(users)
      .where(eq(users.id, user!.id))
      .limit(1);
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const valid = await verifyPassword(
      parsed.data.currentPassword,
      target.salt,
      target.passwordHash
    );
    if (!valid) {
      return NextResponse.json(
        { error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(parsed.data.newPassword, salt);
    const now = new Date();

    await db
      .update(users)
      .set({
        passwordHash,
        salt: saltToHex(salt),
        updatedAt: now,
      })
      .where(eq(users.id, user!.id));

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
