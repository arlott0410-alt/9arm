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
  withdrawFeeMinor: z.number().int().nonnegative().optional(),
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

export const transferSchema = z
  .object({
    txnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    txnTime: z.string().optional(),
    type: z.enum(['INTERNAL', 'EXTERNAL_OUT', 'EXTERNAL_IN']),
    fromWalletId: z
      .union([z.number().int(), z.null(), z.undefined()])
      .optional()
      .nullable()
      .transform((v) => (v === 0 || v === undefined ? null : v)),
    toWalletId: z
      .union([z.number().int(), z.null(), z.undefined()])
      .optional()
      .nullable()
      .transform((v) => (v === 0 || v === undefined ? null : v)),
    inputAmountMinor: z.number().int().positive(),
    fromWalletAmountMinor: z.number().int().nullable().optional(),
    toWalletAmountMinor: z.number().int().nullable().optional(),
    note: z.string().optional(),
  })
  .refine(
  (data) => {
    if (data.type === 'INTERNAL')
      return (data.fromWalletId ?? 0) > 0 && (data.toWalletId ?? 0) > 0;
    if (data.type === 'EXTERNAL_OUT') return (data.fromWalletId ?? 0) > 0;
    if (data.type === 'EXTERNAL_IN') return (data.toWalletId ?? 0) > 0;
    return false;
  },
  { message: 'ต้องระบุกระเป๋าต้นทาง/ปลายทางให้ถูกต้อง' }
  );

export const createUserSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'AUDIT']),
});

export const updateUserSchema = z.object({
  role: z.enum(['ADMIN', 'AUDIT']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8, 'รหัสผ่านอย่างน้อย 8 ตัว').optional(),
});

export const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'กรุณากรอกรหัสผ่านปัจจุบัน'),
  newPassword: z.string().min(8, 'รหัสผ่านใหม่อย่างน้อย 8 ตัว'),
});

export const displayCurrencySchema = z.object({
  displayCurrency: z.enum(['LAK', 'THB', 'USD']),
});

export const exchangeRatesSchema = z.object({
  rates: z.record(z.string(), z.number()),
});
