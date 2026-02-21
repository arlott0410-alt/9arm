import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username required'),
  password: z.string().min(1, 'Password required'),
});

export const createSuperadminSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const websiteSchema = z.object({
  name: z.string().min(1),
  prefix: z.string().min(1).max(32),
});

export const walletSchema = z.object({
  name: z.string().min(1),
  currency: z.enum(['LAK', 'THB', 'USD']),
  openingBalanceMinor: z.number().int(),
});

export const depositTransactionSchema = z.object({
  txnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  websiteId: z.number().int().positive(),
  userIdInput: z.string().min(1),
  userFull: z.string().min(1),
  walletId: z.number().int().positive(),
  amountMinor: z.number().int().nonnegative(),
  depositSlipTime: z.string().min(1),
  depositSystemTime: z.string().min(1),
});

export const withdrawTransactionSchema = z.object({
  txnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  websiteId: z.number().int().positive(),
  userIdInput: z.string().min(1),
  userFull: z.string().min(1),
  walletId: z.number().int().positive(),
  withdrawInputAmountMinor: z.number().int().nonnegative(),
  withdrawSystemTime: z.string().min(1),
  withdrawSlipTime: z.string().min(1),
});

export const editTransactionSchema = z.object({
  editReason: z.string().min(1, 'Edit reason required'),
  txnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  websiteId: z.number().int().positive().optional(),
  userIdInput: z.string().min(1).optional(),
  userFull: z.string().min(1).optional(),
  walletId: z.number().int().positive().optional(),
  amountMinor: z.number().int().nonnegative().optional(),
  depositSlipTime: z.string().optional(),
  depositSystemTime: z.string().optional(),
  withdrawInputAmountMinor: z.number().int().nonnegative().optional(),
  withdrawSystemTime: z.string().optional(),
  withdrawSlipTime: z.string().optional(),
});

export const transferSchema = z.object({
  txnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(['INTERNAL', 'EXTERNAL_OUT', 'EXTERNAL_IN']),
  fromWalletId: z.number().int().positive().nullable(),
  toWalletId: z.number().int().positive().nullable(),
  inputAmountMinor: z.number().int().positive(),
  fromWalletAmountMinor: z.number().int().nullable(),
  toWalletAmountMinor: z.number().int().nullable(),
  note: z.string().optional(),
});

export const createUserSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'AUDIT']),
});

export const updateUserSchema = z.object({
  role: z.enum(['ADMIN', 'AUDIT']).optional(),
  isActive: z.boolean().optional(),
});

export const displayCurrencySchema = z.object({
  displayCurrency: z.enum(['LAK', 'THB', 'USD']),
});

export const exchangeRatesSchema = z.object({
  rates: z.record(z.string(), z.number()),
});
