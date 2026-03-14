-- Add effective_to for salary date ranges (effective_from <= period AND (effective_to >= period OR effective_to IS NULL))
ALTER TABLE employee_salaries ADD COLUMN effective_to TEXT;
