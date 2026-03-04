CREATE TABLE IF NOT EXISTS holiday_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  holiday_date TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_holiday_entries_user_date ON holiday_entries(user_id, holiday_date);
CREATE INDEX IF NOT EXISTS idx_holiday_entries_holiday_date ON holiday_entries(holiday_date);
