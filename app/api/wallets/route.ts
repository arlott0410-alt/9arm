import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth, requireWallets } from '@/lib/api-helpers';
import { wallets } from '@/db/schema';
import { walletSchema } from '@/lib/validations';

export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireAuth(user);
    if (err) return err;

    const list = await db.select().from(wallets).orderBy(wallets.name);
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
    const err = requireWallets(user);
    if (err) return err;

    const body = await request.json();
    const parsed = walletSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const now = new Date();
    const [inserted] = await db
      .insert(wallets)
      .values({
        name: parsed.data.name,
        currency: parsed.data.currency,
        openingBalanceMinor: parsed.data.openingBalanceMinor,
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
