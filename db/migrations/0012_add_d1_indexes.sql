-- Indexes to reduce D1 rows read on common WHERE/ORDER BY

-- List transactions by date + filter by deleted_at
CREATE INDEX IF NOT EXISTS idx_transactions_deleted_at ON transactions(deleted_at);
CREATE INDEX IF NOT EXISTS idx_transactions_txn_date_deleted ON transactions(txn_date, deleted_at);

-- List credit_cuts/bonuses by date range: already have website_id, deleted_at in 0005/0004
-- settings.key is primary key so already indexed
