-- รายการเพิ่มต่อคน (ค่าไฟ, ค่าข้าว, โบนัส ฯลฯ)
ALTER TABLE payroll_items ADD COLUMN allowances TEXT NOT NULL DEFAULT '[]';
ALTER TABLE payroll_items ADD COLUMN total_allowances_minor INTEGER NOT NULL DEFAULT 0;
