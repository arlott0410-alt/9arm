export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { bootstrapSettings } from '@/lib/bootstrap';

export async function GET() {
  try {
    const { env } = getRequestContext();
    const db = getDb(env.DB);
    await bootstrapSettings(db);

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'SUPER_ADMIN'))
      .limit(1);

    return NextResponse.json({ needsSetup: existing.length === 0 });
  } catch (err) {
    console.error('Needs setup error:', err);
    return NextResponse.json({ needsSetup: false }, { status: 200 });
  }
}
