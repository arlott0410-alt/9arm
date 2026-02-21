import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth, requireMutate } from '@/lib/api-helpers';
import {
  transactions,
  websites,
  wallets,
  users,
  transactionEdits,
} from '@/db/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import {
  depositTransactionSchema,
  withdrawTransactionSchema,
} from '@/lib/validations';
import { settings } from '@/db/schema';
import {
  convertToDisplay,
  convertFromDisplay,
  type Currency,
  type RateSnapshot,
} from '@/lib/rates';

export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireAuth(user);
    if (err) return err;

    const url = new URL(request.url);
    const dateFrom = url.searchParams.get('dateFrom') || '';
    const dateTo = url.searchParams.get('dateTo') || '';
    const websiteId = url.searchParams.get('websiteId');
    const userFull = url.searchParams.get('userFull');
    const createdBy = url.searchParams.get('createdBy');
    const type = url.searchParams.get('type');
    const editedOnly = url.searchParams.get('editedOnly') === 'true';

    const conditions: Parameters<typeof and>[0][] = [];
    if (dateFrom) conditions.push(gte(transactions.txnDate, dateFrom));
    if (dateTo) conditions.push(lte(transactions.txnDate, dateTo));
    if (websiteId) conditions.push(eq(transactions.websiteId, parseInt(websiteId)));
    if (userFull) conditions.push(eq(transactions.userFull, userFull));
    if (createdBy) conditions.push(eq(transactions.createdBy, parseInt(createdBy)));
    if (type) conditions.push(eq(transactions.type, type as 'DEPOSIT' | 'WITHDRAW'));

    const baseQuery = db
      .select({
        id: transactions.id,
        txnDate: transactions.txnDate,
        type: transactions.type,
        websiteId: transactions.websiteId,
        userIdInput: transactions.userIdInput,
        userFull: transactions.userFull,
        walletId: transactions.walletId,
        displayCurrency: transactions.displayCurrency,
        rateSnapshot: transactions.rateSnapshot,
        amountMinor: transactions.amountMinor,
        depositSlipTime: transactions.depositSlipTime,
        depositSystemTime: transactions.depositSystemTime,
        withdrawInputAmountMinor: transactions.withdrawInputAmountMinor,
        withdrawSystemTime: transactions.withdrawSystemTime,
        withdrawSlipTime: transactions.withdrawSlipTime,
        createdAt: transactions.createdAt,
        updatedAt: transactions.updatedAt,
        createdBy: transactions.createdBy,
        websiteName: websites.name,
        websitePrefix: websites.prefix,
        walletName: wallets.name,
        walletCurrency: wallets.currency,
        createdByUsername: users.username,
      })
      .from(transactions)
      .leftJoin(websites, eq(transactions.websiteId, websites.id))
      .leftJoin(wallets, eq(transactions.walletId, wallets.id))
      .leftJoin(users, eq(transactions.createdBy, users.id));

    const filteredQuery =
      conditions.length > 0
        ? baseQuery.where(and(...conditions))
        : baseQuery;

    let list = await filteredQuery.orderBy(transactions.txnDate, transactions.id);

    if (editedOnly) {
      const editedIds = await db
        .selectDistinct({ transactionId: transactionEdits.transactionId })
        .from(transactionEdits);
      const idSet = new Set(editedIds.map((r) => r.transactionId));
      list = list.filter((r) => idSet.has(r.id));
    }

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
    const err = requireMutate(user);
    if (err) return err;

    const body = (await request.json()) as Record<string, unknown>;
    const type = body.type as 'DEPOSIT' | 'WITHDRAW';

    const [settingsRow] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'DISPLAY_CURRENCY'))
      .limit(1);
    const displayCurrency: Currency =
      (settingsRow?.value &&
        typeof settingsRow.value === 'string' &&
        JSON.parse(settingsRow.value)) ||
      'THB';

    const [ratesRow] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'EXCHANGE_RATES'))
      .limit(1);
    const rateSnapshot: RateSnapshot =
      ratesRow?.value && typeof ratesRow.value === 'string'
        ? JSON.parse(ratesRow.value)
        : {};

    const now = new Date();

    if (type === 'DEPOSIT') {
      const parsed = depositTransactionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, parsed.data.walletId))
        .limit(1);
      if (!wallet) {
        return NextResponse.json({ error: 'Wallet not found' }, { status: 400 });
      }

      const amountMinor = parsed.data.amountMinor;

      const [inserted] = await db
        .insert(transactions)
        .values({
          txnDate: parsed.data.txnDate,
          type: 'DEPOSIT',
          websiteId: parsed.data.websiteId,
          userIdInput: parsed.data.userIdInput,
          userFull: parsed.data.userFull,
          walletId: parsed.data.walletId,
          displayCurrency,
          rateSnapshot,
          amountMinor,
          depositSlipTime: parsed.data.depositSlipTime,
          depositSystemTime: parsed.data.depositSystemTime,
          withdrawInputAmountMinor: null,
          withdrawSystemTime: null,
          withdrawSlipTime: null,
          createdAt: now,
          updatedAt: now,
          createdBy: user!.id,
        })
        .returning();
      return NextResponse.json(inserted);
    }

    if (type === 'WITHDRAW') {
      const parsed = withdrawTransactionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, parsed.data.walletId))
        .limit(1);
      if (!wallet) {
        return NextResponse.json({ error: 'Wallet not found' }, { status: 400 });
      }

      const walletAmountMinor = convertFromDisplay(
        parsed.data.withdrawInputAmountMinor,
        displayCurrency,
        wallet.currency as Currency,
        rateSnapshot
      );

      const [inserted] = await db
        .insert(transactions)
        .values({
          txnDate: parsed.data.txnDate,
          type: 'WITHDRAW',
          websiteId: parsed.data.websiteId,
          userIdInput: parsed.data.userIdInput,
          userFull: parsed.data.userFull,
          walletId: parsed.data.walletId,
          displayCurrency,
          rateSnapshot,
          amountMinor: walletAmountMinor,
          depositSlipTime: null,
          depositSystemTime: null,
          withdrawInputAmountMinor: parsed.data.withdrawInputAmountMinor,
          withdrawSystemTime: parsed.data.withdrawSystemTime,
          withdrawSlipTime: parsed.data.withdrawSlipTime,
          createdAt: now,
          updatedAt: now,
          createdBy: user!.id,
        })
        .returning();
      return NextResponse.json(inserted);
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
