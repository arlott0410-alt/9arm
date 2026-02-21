export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getDbAndUser, requireMutate } from '@/lib/api-helpers';
import {
  transactions,
  wallets,
  transactionEdits,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { editTransactionSchema } from '@/lib/validations';
import {
  convertFromDisplay,
  type Currency,
  type RateSnapshot,
} from '@/lib/rates';
import { settings } from '@/db/schema';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireMutate(user);
    if (err) return err;

    const { id } = await params;
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = editTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    if (!parsed.data.editReason || parsed.data.editReason.trim() === '') {
      return NextResponse.json(
        { error: 'Edit reason is required' },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, idNum))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const beforeSnapshot = {
      txnDate: existing.txnDate,
      websiteId: existing.websiteId,
      userIdInput: existing.userIdInput,
      userFull: existing.userFull,
      walletId: existing.walletId,
      amountMinor: existing.amountMinor,
      depositSlipTime: existing.depositSlipTime,
      depositSystemTime: existing.depositSystemTime,
      withdrawInputAmountMinor: existing.withdrawInputAmountMinor,
      withdrawSystemTime: existing.withdrawSystemTime,
      withdrawSlipTime: existing.withdrawSlipTime,
    };

    const rateSnapshot = existing.rateSnapshot as RateSnapshot;
    const displayCurrency = existing.displayCurrency as Currency;

    let newAmountMinor = existing.amountMinor;
    let newWalletId = existing.walletId;

    if (existing.type === 'DEPOSIT') {
      if (parsed.data.amountMinor !== undefined) {
        newAmountMinor = parsed.data.amountMinor;
      }
      if (parsed.data.walletId !== undefined) {
        newWalletId = parsed.data.walletId;
      }
    } else {
      if (parsed.data.withdrawInputAmountMinor !== undefined) {
        const [wal] = await db
          .select()
          .from(wallets)
          .where(eq(wallets.id, newWalletId))
          .limit(1);
        if (wal) {
          newAmountMinor = convertFromDisplay(
            parsed.data.withdrawInputAmountMinor,
            displayCurrency,
            wal.currency as Currency,
            rateSnapshot
          );
        }
      }
      if (parsed.data.walletId !== undefined) {
        newWalletId = parsed.data.walletId;
        if (parsed.data.withdrawInputAmountMinor !== undefined) {
          const [wal] = await db
            .select()
            .from(wallets)
            .where(eq(wallets.id, newWalletId))
            .limit(1);
          if (wal) {
            newAmountMinor = convertFromDisplay(
              parsed.data.withdrawInputAmountMinor,
              displayCurrency,
              wal.currency as Currency,
              rateSnapshot
            );
          }
        }
      }
    }

    const afterSnapshot = {
      txnDate: parsed.data.txnDate ?? existing.txnDate,
      websiteId: parsed.data.websiteId ?? existing.websiteId,
      userIdInput: parsed.data.userIdInput ?? existing.userIdInput,
      userFull: parsed.data.userFull ?? existing.userFull,
      walletId: newWalletId,
      amountMinor: newAmountMinor,
      depositSlipTime:
        parsed.data.depositSlipTime !== undefined
          ? parsed.data.depositSlipTime
          : existing.depositSlipTime,
      depositSystemTime:
        parsed.data.depositSystemTime !== undefined
          ? parsed.data.depositSystemTime
          : existing.depositSystemTime,
      withdrawInputAmountMinor:
        parsed.data.withdrawInputAmountMinor !== undefined
          ? parsed.data.withdrawInputAmountMinor
          : existing.withdrawInputAmountMinor,
      withdrawSystemTime:
        parsed.data.withdrawSystemTime !== undefined
          ? parsed.data.withdrawSystemTime
          : existing.withdrawSystemTime,
      withdrawSlipTime:
        parsed.data.withdrawSlipTime !== undefined
          ? parsed.data.withdrawSlipTime
          : existing.withdrawSlipTime,
    };

    const now = new Date();

    const deltaAmount = newAmountMinor - existing.amountMinor;
    const sameWallet = newWalletId === existing.walletId;

    if (existing.type === 'DEPOSIT') {
      if (sameWallet) {
        if (deltaAmount !== 0) {
          // wallet balance += deltaAmount (deposit adds)
          // no per-wallet update needed - D1 doesn't store computed balance
        }
      } else {
        // Revert old: old wallet effectively had +existing.amountMinor (deposit)
        // Apply new: new wallet gets +newAmountMinor
        // We don't store balance - it's computed. So we just update the transaction.
      }
    } else {
      if (sameWallet) {
        // Withdraw: old was -existing.amountMinor, new is -newAmountMinor
        // delta = -newAmountMinor - (-existing) = existing - newAmountMinor
        // So we reduce impact by (existing - newAmountMinor)
      } else {
        // Revert old wallet (add back existing.amountMinor), reduce new wallet by newAmountMinor
      }
    }

    await db
      .update(transactions)
      .set({
        txnDate: afterSnapshot.txnDate,
        websiteId: afterSnapshot.websiteId,
        userIdInput: afterSnapshot.userIdInput,
        userFull: afterSnapshot.userFull,
        walletId: afterSnapshot.walletId,
        amountMinor: afterSnapshot.amountMinor,
        depositSlipTime: afterSnapshot.depositSlipTime,
        depositSystemTime: afterSnapshot.depositSystemTime,
        withdrawInputAmountMinor: afterSnapshot.withdrawInputAmountMinor,
        withdrawSystemTime: afterSnapshot.withdrawSystemTime,
        withdrawSlipTime: afterSnapshot.withdrawSlipTime,
        updatedAt: now,
      })
      .where(eq(transactions.id, idNum));

    await db.insert(transactionEdits).values({
      transactionId: idNum,
      editedBy: user!.id,
      editReason: parsed.data.editReason.trim(),
      beforeSnapshot: JSON.stringify(beforeSnapshot),
      afterSnapshot: JSON.stringify(afterSnapshot),
      editedAt: now,
    });

    const [updated] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, idNum))
      .limit(1);
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
