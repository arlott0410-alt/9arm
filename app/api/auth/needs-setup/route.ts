export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { users } from '@/db/schema';
import { bootstrapSettings } from '@/lib/bootstrap';
import { getEnvAndDb } from '@/lib/cf-env';

export async function GET() {
  try {
    const result = getEnvAndDb({ requireAppSecret: false });
    if (result instanceof NextResponse) return result;
    const { db } = result;
    await bootstrapSettings(db);

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'SUPER_ADMIN'))
      .limit(1);

    return NextResponse.json({ needsSetup: existing.length === 0 });
  } catch (err) {
    console.error('Needs setup error:', err);
    const msg = err instanceof Error ? err.message : '';
    const isDbError = /no such table|SQLITE_ERROR|syntax error/i.test(msg);
    if (isDbError) {
      return NextResponse.json(
        { error: 'DB_SCHEMA', message: 'Database schema not initialized. Run db/schema.sql in D1 Console.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ needsSetup: false }, { status: 200 });
  }
}
