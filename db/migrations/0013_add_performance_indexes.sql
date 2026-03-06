-- Performance indexes for common WHERE + ORDER BY patterns. Safe to run on production (IF NOT EXISTS).
-- Reduces D1 row reads for dashboard, reports, list APIs, and payroll lookups.

-- Transactions: list/filter by type, date, deleted; dashboard/reports GROUP BY wallet
CREATE INDEX IF NOT EXISTS idx_transactions_type_deleted_txn_date ON transactions(type, deleted_at, txn_date);
CREATE INDEX IF NOT EXISTS idx_transactions_website_deleted_txn_date ON transactions(website_id, deleted_at, txn_date);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_deleted ON transactions(wallet_id, deleted_at);

-- Transfers: list by type/date; balance aggregates by from/to wallet
CREATE INDEX IF NOT EXISTS idx_transfers_type_deleted_txn_date ON transfers(type, deleted_at, txn_date);
CREATE INDEX IF NOT EXISTS idx_transfers_from_wallet_deleted ON transfers(from_wallet_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_transfers_to_wallet_deleted ON transfers(to_wallet_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_transfers_deleted_txn_date ON transfers(deleted_at, txn_date);

-- Bonuses: list by website, date range, deleted
CREATE INDEX IF NOT EXISTS idx_bonuses_website_deleted_bonus_time ON bonuses(website_id, deleted_at, bonus_time);
CREATE INDEX IF NOT EXISTS idx_bonuses_deleted_bonus_time ON bonuses(deleted_at, bonus_time);

-- Credit cuts: list by website, date range, deleted
CREATE INDEX IF NOT EXISTS idx_credit_cuts_website_deleted_cut_time ON credit_cuts(website_id, deleted_at, cut_time);
CREATE INDEX IF NOT EXISTS idx_credit_cuts_deleted_cut_time ON credit_cuts(deleted_at, cut_time);

-- Payroll / salary lookups
CREATE INDEX IF NOT EXISTS idx_late_arrivals_user_late_date ON late_arrivals(user_id, late_date);
CREATE INDEX IF NOT EXISTS idx_holiday_entries_user_holiday_date ON holiday_entries(user_id, holiday_date);
CREATE INDEX IF NOT EXISTS idx_employee_salaries_user_effective ON employee_salaries(user_id, effective_from);
