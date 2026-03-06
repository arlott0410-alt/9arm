import { NextResponse } from 'next/server';
import { getDbAndUser, requireSettings } from '@/lib/api-helpers';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { invalidateSettingsCaches } from '@/lib/d1-cache';

const KEY = 'SALARY_ALLOWANCE_TYPES';

export type AllowanceType = { id: string; name: string };

const DEFAULT: AllowanceType[] = [
  { id: '1', name: 'ค่าไฟ' },
  { id: '2', name: 'ค่าข้าว' },
  { id: '3', name: 'ค่าโบนัส' },
  { id: '4', name: 'ค่าอื่น' },
];

function parse(value: unknown): AllowanceType[] {
  if (Array.isArray(value)) {
    return value.filter(
      (x): x is AllowanceType =>
        x != null && typeof x === 'object' && typeof (x as AllowanceType).id === 'string' && typeof (x as AllowanceType).name === 'string'
    );
  }
  return DEFAULT;
}

export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireSettings(user);
    if (err) return err;

    const rows = await db.select().from(settings).where(eq(settings.key, KEY)).limit(1);
    const value = rows.length > 0 ? rows[0].value : null;
    const items = Array.isArray(value) ? parse(value) : typeof value === 'string' ? (() => { try { return parse(JSON.parse(value)); } catch { return DEFAULT; } })() : DEFAULT;

    return NextResponse.json({ items });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireSettings(user);
    if (err) return err;

    const body = (await request.json()) as { items?: unknown };
    const raw = body?.items;
    if (!Array.isArray(raw)) {
      return NextResponse.json(
        { error: 'ต้องส่ง items เป็น array' },
        { status: 400 }
      );
    }
    const items = raw
      .filter((x: unknown) => x != null && typeof (x as AllowanceType).name === 'string' && (x as AllowanceType).name.trim())
      .map((x: AllowanceType, i: number) => ({
        id: typeof (x as AllowanceType).id === 'string' ? (x as AllowanceType).id : String(i + 1),
        name: String((x as AllowanceType).name).trim(),
      }));

    const value = JSON.stringify(items);
    const existing = await db.select().from(settings).where(eq(settings.key, KEY)).limit(1);
    if (existing.length > 0) {
      await db.update(settings).set({ value }).where(eq(settings.key, KEY));
    } else {
      await db.insert(settings).values({ key: KEY, value });
    }
    invalidateSettingsCaches();
    return NextResponse.json({ items });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
