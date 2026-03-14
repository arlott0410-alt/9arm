-- อนุญาตให้มีหลาย record ต่อ year_month ได้เมื่อ soft-deleted แล้ว
-- เพื่อให้สร้างรอบใหม่ได้หลังลบรอบเดิม
DROP INDEX IF EXISTS idx_payroll_runs_year_month;
CREATE UNIQUE INDEX idx_payroll_runs_year_month ON payroll_runs(year_month) WHERE deleted_at IS NULL;
