export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getDbAndUser, requireSettings } from '@/lib/api-helpers';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { updateUserSchema } from '@/lib/validations';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user } = await getDbAndUser(request);
    const err = requireSettings(user);
    if (err) return err;

    const { id } = await params;
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const target = await db
      .select()
      .from(users)
      .where(eq(users.id, idNum))
      .limit(1);
    if (target.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (target[0].role === 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Cannot modify superadmin' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.role !== undefined) updates.role = parsed.data.role;
    if (parsed.data.isActive !== undefined)
      updates.isActive = parsed.data.isActive;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(target[0]);
    }

    const now = new Date();
    updates.updatedAt = now;

    const [updated] = await db
      .update(users)
      .set(updates as Record<string, string | boolean | Date>)
      .where(eq(users.id, idNum))
      .returning({
        id: users.id,
        username: users.username,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
