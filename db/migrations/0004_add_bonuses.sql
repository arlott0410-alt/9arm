CREATE TABLE IF NOT EXISTS bonus_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bonuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  website_id INTEGER NOT NULL REFERENCES websites(id) ON DELETE RESTRICT,
  user_id_input TEXT NOT NULL,
  user_full TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES bonus_categories(id) ON DELETE RESTRICT,
  display_currency TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  bonus_time TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER,
  deleted_by INTEGER REFERENCES users(id),
  delete_reason TEXT
);

CREATE TABLE IF NOT EXISTS bonus_edits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bonus_id INTEGER NOT NULL REFERENCES bonuses(id) ON DELETE CASCADE,
  edited_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  edit_reason TEXT NOT NULL,
  before_snapshot TEXT NOT NULL,
  after_snapshot TEXT NOT NULL,
  edited_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bonuses_website_id ON bonuses(website_id);
CREATE INDEX IF NOT EXISTS idx_bonuses_category_id ON bonuses(category_id);
CREATE INDEX IF NOT EXISTS idx_bonuses_bonus_time ON bonuses(bonus_time);
CREATE INDEX IF NOT EXISTS idx_bonuses_deleted_at ON bonuses(deleted_at);
