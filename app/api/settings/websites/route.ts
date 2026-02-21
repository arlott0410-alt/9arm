export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth, requireSettings } from '@/lib/api-helpers';
import { websites } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { websiteSchema } from '@/lib/validations';

export async function GET(request: Request) {
  try {
    const { db, user } = await getDbAndUser(request);
    const err = requireAuth(user);
    if (err) return err;

    const list = await db.select().from(websites).orderBy(websites.name);
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
    const { db, user } = await getDbAndUser(request);
    const err = requireSettings(user);
    if (err) return err;

    const body = await request.json();
    const parsed = websiteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const now = new Date();
    const [inserted] = await db
      .insert(websites)
      .values({
        name: parsed.data.name,
        prefix: parsed.data.prefix,
        isActive: true,
        createdAt: now,
      })
      .returning();
    return NextResponse.json(inserted);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
