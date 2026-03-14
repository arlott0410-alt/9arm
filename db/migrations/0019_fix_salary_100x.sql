-- แก้เงินเดือนที่บันทึกผิด (คูณ 100 ไป) สำหรับ LAK ที่ 1 minor = 1 kip
-- ค่าที่มากกว่า 10,000,000 น่าจะผิด (ควรเป็นหลักล้าน ไม่ใช่หลักร้อยล้าน)
UPDATE employee_salaries SET base_salary_minor = base_salary_minor / 100 WHERE base_salary_minor > 10000000;
UPDATE payroll_items SET base_salary_minor = base_salary_minor / 100 WHERE base_salary_minor > 10000000;
UPDATE payroll_items SET salary_after_holiday_minor = salary_after_holiday_minor / 100 WHERE salary_after_holiday_minor > 10000000;
UPDATE payroll_items SET bonus_portion_minor = bonus_portion_minor / 100 WHERE bonus_portion_minor > 10000000;
UPDATE payroll_items SET total_allowances_minor = total_allowances_minor / 100 WHERE total_allowances_minor > 10000000;
UPDATE payroll_items SET total_deductions_minor = total_deductions_minor / 100 WHERE total_deductions_minor > 10000000;
UPDATE payroll_items SET late_deduction_minor = late_deduction_minor / 100 WHERE late_deduction_minor > 10000000;
UPDATE payroll_items SET net_amount_minor = net_amount_minor / 100 WHERE net_amount_minor > 10000000;
UPDATE payroll_items SET override_base_salary_minor = override_base_salary_minor / 100 WHERE override_base_salary_minor > 10000000;
