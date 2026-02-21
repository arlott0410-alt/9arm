CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'AUDIT')),
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS websites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('LAK', 'THB', 'USD')),
  opening_balance_minor INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  txn_date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAW')),
  website_id INTEGER NOT NULL REFERENCES websites(id) ON DELETE RESTRICT,
  user_id_input TEXT NOT NULL,
  user_full TEXT NOT NULL,
  wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
  display_currency TEXT NOT NULL,
  rate_snapshot TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  deposit_slip_time TEXT,
  deposit_system_time TEXT,
  withdraw_input_amount_minor INTEGER,
  withdraw_system_time TEXT,
  withdraw_slip_time TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS transaction_edits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  edited_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  edit_reason TEXT NOT NULL,
  before_snapshot TEXT NOT NULL,
  after_snapshot TEXT NOT NULL,
  edited_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  txn_date TEXT NOT NULL,
  txn_time TEXT,
  type TEXT NOT NULL CHECK (type IN ('INTERNAL', 'EXTERNAL_OUT', 'EXTERNAL_IN')),
  from_wallet_id INTEGER REFERENCES wallets(id) ON DELETE RESTRICT,
  to_wallet_id INTEGER REFERENCES wallets(id) ON DELETE RESTRICT,
  display_currency TEXT NOT NULL,
  input_amount_minor INTEGER NOT NULL,
  from_wallet_amount_minor INTEGER,
  to_wallet_amount_minor INTEGER,
  rate_snapshot TEXT NOT NULL,
  note TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_txn_date ON transactions(txn_date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_website_id ON transactions(website_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_full ON transactions(user_full);
CREATE INDEX IF NOT EXISTS idx_transaction_edits_transaction_id ON transaction_edits(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_edits_edited_at ON transaction_edits(edited_at);
CREATE INDEX IF NOT EXISTS idx_transfers_txn_date ON transfers(txn_date);
CREATE INDEX IF NOT EXISTS idx_transfers_type ON transfers(type);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
