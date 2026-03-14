import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  role: text('role', { enum: ['SUPER_ADMIN', 'ADMIN', 'AUDIT'] }).notNull(),
  passwordHash: text('password_hash').notNull(),
  salt: text('salt').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const websites = sqliteTable('websites', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  prefix: text('prefix').notNull().unique(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const wallets = sqliteTable('wallets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  currency: text('currency', { enum: ['LAK', 'THB', 'USD'] }).notNull(),
  openingBalanceMinor: integer('opening_balance_minor').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  txnDate: text('txn_date').notNull(),
  type: text('type', { enum: ['DEPOSIT', 'WITHDRAW'] }).notNull(),
  websiteId: integer('website_id')
    .notNull()
    .references(() => websites.id, { onDelete: 'restrict' }),
  userIdInput: text('user_id_input').notNull(),
  userFull: text('user_full').notNull(),
  walletId: integer('wallet_id')
    .notNull()
    .references(() => wallets.id, { onDelete: 'restrict' }),
  displayCurrency: text('display_currency').notNull(),
  rateSnapshot: text('rate_snapshot', { mode: 'json' }).notNull(),
  amountMinor: integer('amount_minor').notNull(),
  depositSlipTime: text('deposit_slip_time'),
  depositSystemTime: text('deposit_system_time'),
  withdrawInputAmountMinor: integer('withdraw_input_amount_minor'),
  withdrawFeeMinor: integer('withdraw_fee_minor'),
  withdrawSystemTime: text('withdraw_system_time'),
  withdrawSlipTime: text('withdraw_slip_time'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  createdBy: integer('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  deletedBy: integer('deleted_by').references(() => users.id),
  deleteReason: text('delete_reason'),
});

export const transactionEdits = sqliteTable('transaction_edits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  transactionId: integer('transaction_id')
    .notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  editedBy: integer('edited_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  editReason: text('edit_reason').notNull(),
  beforeSnapshot: text('before_snapshot', { mode: 'json' }).notNull(),
  afterSnapshot: text('after_snapshot', { mode: 'json' }).notNull(),
  editedAt: integer('edited_at', { mode: 'timestamp' }).notNull(),
});

export const transfers = sqliteTable('transfers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  txnDate: text('txn_date').notNull(),
  txnTime: text('txn_time'),
  type: text('type', {
    enum: ['INTERNAL', 'EXTERNAL_OUT', 'EXTERNAL_IN'],
  }).notNull(),
  fromWalletId: integer('from_wallet_id').references(() => wallets.id, {
    onDelete: 'restrict',
  }),
  toWalletId: integer('to_wallet_id').references(() => wallets.id, {
    onDelete: 'restrict',
  }),
  displayCurrency: text('display_currency').notNull(),
  inputAmountMinor: integer('input_amount_minor').notNull(),
  fromWalletAmountMinor: integer('from_wallet_amount_minor'),
  toWalletAmountMinor: integer('to_wallet_amount_minor'),
  rateSnapshot: text('rate_snapshot', { mode: 'json' }).notNull(),
  note: text('note'),
  createdBy: integer('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  deletedBy: integer('deleted_by').references(() => users.id),
  deleteReason: text('delete_reason'),
});

export const bonusCategories = sqliteTable('bonus_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const bonuses = sqliteTable('bonuses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  websiteId: integer('website_id')
    .notNull()
    .references(() => websites.id, { onDelete: 'restrict' }),
  userIdInput: text('user_id_input').notNull(),
  userFull: text('user_full').notNull(),
  categoryId: integer('category_id')
    .notNull()
    .references(() => bonusCategories.id, { onDelete: 'restrict' }),
  displayCurrency: text('display_currency').notNull(),
  amountMinor: integer('amount_minor').notNull(),
  bonusTime: text('bonus_time').notNull(),
  createdBy: integer('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  deletedBy: integer('deleted_by').references(() => users.id),
  deleteReason: text('delete_reason'),
});

export const bonusEdits = sqliteTable('bonus_edits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bonusId: integer('bonus_id')
    .notNull()
    .references(() => bonuses.id, { onDelete: 'cascade' }),
  editedBy: integer('edited_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  editReason: text('edit_reason').notNull(),
  beforeSnapshot: text('before_snapshot', { mode: 'json' }).notNull(),
  afterSnapshot: text('after_snapshot', { mode: 'json' }).notNull(),
  editedAt: integer('edited_at', { mode: 'timestamp' }).notNull(),
});

export const creditCuts = sqliteTable('credit_cuts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  websiteId: integer('website_id')
    .notNull()
    .references(() => websites.id, { onDelete: 'restrict' }),
  userIdInput: text('user_id_input').notNull(),
  userFull: text('user_full').notNull(),
  displayCurrency: text('display_currency').notNull(),
  amountMinor: integer('amount_minor').notNull(),
  cutReason: text('cut_reason').notNull(),
  cutTime: text('cut_time').notNull(),
  createdBy: integer('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  deletedBy: integer('deleted_by').references(() => users.id),
  deleteReason: text('delete_reason'),
});

export const creditCutEdits = sqliteTable('credit_cuts_edits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  creditCutId: integer('credit_cut_id')
    .notNull()
    .references(() => creditCuts.id, { onDelete: 'cascade' }),
  editedBy: integer('edited_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  editReason: text('edit_reason').notNull(),
  beforeSnapshot: text('before_snapshot', { mode: 'json' }).notNull(),
  afterSnapshot: text('after_snapshot', { mode: 'json' }).notNull(),
  editedAt: integer('edited_at', { mode: 'timestamp' }).notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
});

export const holidayEntries = sqliteTable('holiday_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  holidayDate: text('holiday_date').notNull(),
  createdBy: integer('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const lateArrivals = sqliteTable('late_arrivals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  lateDate: text('late_date').notNull(),
  /** เก็บไว้เพื่อความเข้ากันได้กับ migration 0010 (NOT NULL ไม่มี DEFAULT) — ใช้ 0 สำหรับแถวใหม่ */
  secondsLate: integer('seconds_late').notNull().default(0),
  minutesLate: integer('minutes_late').notNull(),
  createdBy: integer('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const employeeSalaries = sqliteTable('employee_salaries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  effectiveFrom: text('effective_from').notNull(),
  baseSalaryMinor: integer('base_salary_minor').notNull(),
  currency: text('currency').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  createdBy: integer('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
});

export const payrollRuns = sqliteTable('payroll_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  yearMonth: text('year_month').notNull(),
  status: text('status', { enum: ['DRAFT', 'CONFIRMED'] }).notNull(),
  bonusPoolMinor: integer('bonus_pool_minor'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  createdBy: integer('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
});

export const payrollItems = sqliteTable('payroll_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  payrollRunId: integer('payroll_run_id')
    .notNull()
    .references(() => payrollRuns.id, { onDelete: 'cascade' }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  baseSalaryMinor: integer('base_salary_minor').notNull(),
  totalDays: integer('total_days').notNull(),
  holidayDays: integer('holiday_days').notNull(),
  workingDays: integer('working_days').notNull(),
  salaryAfterHolidayMinor: integer('salary_after_holiday_minor').notNull(),
  bonusPortionMinor: integer('bonus_portion_minor').notNull().default(0),
  allowances: text('allowances', { mode: 'json' }).notNull().default('[]'),
  totalAllowancesMinor: integer('total_allowances_minor').notNull().default(0),
  deductions: text('deductions', { mode: 'json' }).notNull().default('[]'),
  totalDeductionsMinor: integer('total_deductions_minor').notNull().default(0),
  lateMinutes: integer('late_minutes').notNull().default(0),
  lateDeductionMinor: integer('late_deduction_minor').notNull().default(0),
  netAmountMinor: integer('net_amount_minor').notNull(),
  note: text('note'),
  excludeFromBonus: integer('exclude_from_bonus', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Website = typeof websites.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type TransactionEdit = typeof transactionEdits.$inferInsert;
export type Transfer = typeof transfers.$inferSelect;
export type BonusCategory = typeof bonusCategories.$inferSelect;
export type Bonus = typeof bonuses.$inferSelect;
export type BonusEdit = typeof bonusEdits.$inferInsert;
export type CreditCut = typeof creditCuts.$inferSelect;
export type CreditCutEdit = typeof creditCutEdits.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type HolidayEntry = typeof holidayEntries.$inferSelect;
export type NewHolidayEntry = typeof holidayEntries.$inferInsert;
export type LateArrival = typeof lateArrivals.$inferSelect;
export type NewLateArrival = typeof lateArrivals.$inferInsert;
export type EmployeeSalary = typeof employeeSalaries.$inferSelect;
export type NewEmployeeSalary = typeof employeeSalaries.$inferInsert;
export type PayrollRun = typeof payrollRuns.$inferSelect;
export type NewPayrollRun = typeof payrollRuns.$inferInsert;
export type PayrollItem = typeof payrollItems.$inferSelect;
export type NewPayrollItem = typeof payrollItems.$inferInsert;
