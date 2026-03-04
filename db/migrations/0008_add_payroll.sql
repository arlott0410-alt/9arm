-- เงินเดือนฐานต่อพนักงาน (มีประวัติตาม effective_from)
CREATE TABLE IF NOT EXISTS employee_salaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  effective_from TEXT NOT NULL,
  base_salary_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  UNIQUE(user_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_employee_salaries_user_id ON employee_salaries(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_salaries_effective_from ON employee_salaries(effective_from);

-- รอบคำนวณเงินเดือนต่อเดือน
CREATE TABLE IF NOT EXISTS payroll_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year_month TEXT NOT NULL,
  status TEXT NOT NULL,
  bonus_pool_minor INTEGER,
  created_at INTEGER NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_runs_year_month ON payroll_runs(year_month);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_status ON payroll_runs(status);

-- รายการเงินเดือนต่อคนต่อรอบ (มีรายการตัดเงินเดือน)
CREATE TABLE IF NOT EXISTS payroll_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payroll_run_id INTEGER NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  base_salary_minor INTEGER NOT NULL,
  total_days INTEGER NOT NULL,
  holiday_days INTEGER NOT NULL,
  working_days INTEGER NOT NULL,
  salary_after_holiday_minor INTEGER NOT NULL,
  bonus_portion_minor INTEGER NOT NULL DEFAULT 0,
  deductions TEXT NOT NULL DEFAULT '[]',
  total_deductions_minor INTEGER NOT NULL DEFAULT 0,
  net_amount_minor INTEGER NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payroll_items_run ON payroll_items(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_user ON payroll_items(user_id);
