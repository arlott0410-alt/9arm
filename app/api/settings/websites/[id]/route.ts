export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getDbAndUser, requireSettings } from '@/lib/api-helpers';
import { websites } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { websiteSchema } from '@/lib/validations';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireSettings(user);
    if (err) return err;

    const { id } = await params;
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = websiteSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.prefix !== undefined) updates.prefix = parsed.data.prefix;

    if (Object.keys(updates).length === 0) {
      const [row] = await db
        .select()
        .from(websites)
        .where(eq(websites.id, idNum))
        .limit(1);
      return NextResponse.json(row ?? { error: 'Not found' }, { status: 200 });
    }

    const [updated] = await db
      .update(websites)
      .set(updates as Record<string, string | boolean>)
      .where(eq(websites.id, idNum))
      .returning();
    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
