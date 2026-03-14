-- Override base salary for a specific payroll run (nullable; when set, use instead of effective history)
ALTER TABLE payroll_items ADD COLUMN override_base_salary_minor INTEGER;
