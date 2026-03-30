-- Add new transfer type: MISTAKE_OUT
-- SQLite cannot alter CHECK constraints directly, so recreate transfers table.

PRAGMA foreign_keys=off;

CREATE TABLE IF NOT EXISTS transfers_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  txn_date TEXT NOT NULL,
  txn_time TEXT,
  type TEXT NOT NULL CHECK (type IN ('INTERNAL', 'EXTERNAL_OUT', 'EXTERNAL_IN', 'MISTAKE_OUT')),
  from_wallet_id INTEGER REFERENCES wallets(id) ON DELETE RESTRICT,
  to_wallet_id INTEGER REFERENCES wallets(id) ON DELETE RESTRICT,
  display_currency TEXT NOT NULL,
  input_amount_minor INTEGER NOT NULL,
  from_wallet_amount_minor INTEGER,
  to_wallet_amount_minor INTEGER,
  rate_snapshot TEXT NOT NULL,
  note TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER,
  deleted_by INTEGER REFERENCES users(id),
  delete_reason TEXT
);

INSERT INTO transfers_new (
  id,
  txn_date,
  txn_time,
  type,
  from_wallet_id,
  to_wallet_id,
  display_currency,
  input_amount_minor,
  from_wallet_amount_minor,
  to_wallet_amount_minor,
  rate_snapshot,
  note,
  created_by,
  created_at,
  deleted_at,
  deleted_by,
  delete_reason
)
SELECT
  id,
  txn_date,
  txn_time,
  type,
  from_wallet_id,
  to_wallet_id,
  display_currency,
  input_amount_minor,
  from_wallet_amount_minor,
  to_wallet_amount_minor,
  rate_snapshot,
  note,
  created_by,
  created_at,
  deleted_at,
  deleted_by,
  delete_reason
FROM transfers;

DROP TABLE transfers;
ALTER TABLE transfers_new RENAME TO transfers;

-- Recreate transfer indexes (old ones are dropped with the old table)
CREATE INDEX IF NOT EXISTS idx_transfers_txn_date ON transfers(txn_date);
CREATE INDEX IF NOT EXISTS idx_transfers_type ON transfers(type);
CREATE INDEX IF NOT EXISTS idx_transfers_type_deleted_txn_date ON transfers(type, deleted_at, txn_date);
CREATE INDEX IF NOT EXISTS idx_transfers_from_wallet_deleted ON transfers(from_wallet_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_transfers_to_wallet_deleted ON transfers(to_wallet_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_transfers_deleted_txn_date ON transfers(deleted_at, txn_date);

PRAGMA foreign_keys=on;
