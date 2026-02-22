CREATE TABLE IF NOT EXISTS credit_cuts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  website_id INTEGER NOT NULL REFERENCES websites(id) ON DELETE RESTRICT,
  user_id_input TEXT NOT NULL,
  user_full TEXT NOT NULL,
  display_currency TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  cut_reason TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER,
  deleted_by INTEGER REFERENCES users(id),
  delete_reason TEXT
);

CREATE TABLE IF NOT EXISTS credit_cuts_edits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  credit_cut_id INTEGER NOT NULL REFERENCES credit_cuts(id) ON DELETE CASCADE,
  edited_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  edit_reason TEXT NOT NULL,
  before_snapshot TEXT NOT NULL,
  after_snapshot TEXT NOT NULL,
  edited_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_cuts_website_id ON credit_cuts(website_id);
CREATE INDEX IF NOT EXISTS idx_credit_cuts_created_at ON credit_cuts(created_at);
CREATE INDEX IF NOT EXISTS idx_credit_cuts_deleted_at ON credit_cuts(deleted_at);
