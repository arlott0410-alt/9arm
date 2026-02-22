import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth } from '@/lib/api-helpers';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireAuth(user);
    if (err) return err;

    const rows = await db.select().from(settings);
    const obj: Record<string, unknown> = {};
    for (const r of rows) {
      if (typeof r.value === 'string') {
        try {
          obj[r.key] = JSON.parse(r.value);
        } catch {
          obj[r.key] = r.value;
        }
      } else {
        obj[r.key] = r.value;
      }
    }
    return NextResponse.json(obj);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
