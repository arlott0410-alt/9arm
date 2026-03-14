-- Soft delete for payroll runs (draft only). Status column already exists as DRAFT/CONFIRMED.
ALTER TABLE payroll_runs ADD COLUMN deleted_at INTEGER;
