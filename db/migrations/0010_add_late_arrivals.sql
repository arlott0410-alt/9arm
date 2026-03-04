-- มาสาย: เก็บวินาทีที่มาสายต่อคนต่อวัน (หัวหน้าวันหยุดลงได้)
CREATE TABLE IF NOT EXISTS late_arrivals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  late_date TEXT NOT NULL,
  seconds_late INTEGER NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, late_date)
);

CREATE INDEX IF NOT EXISTS idx_late_arrivals_user_date ON late_arrivals(user_id, late_date);
CREATE INDEX IF NOT EXISTS idx_late_arrivals_late_date ON late_arrivals(late_date);

-- หักเงินเดือน: วิละ 1000 กีบ (เก็บรวมใน payroll_items)
ALTER TABLE payroll_items ADD COLUMN late_seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN late_deduction_minor INTEGER NOT NULL DEFAULT 0;
