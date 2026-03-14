-- พนักงานที่ไม่ได้รับโบนัส (ไม่นับเข้าไปหารโบนัส)
ALTER TABLE payroll_items ADD COLUMN exclude_from_bonus INTEGER NOT NULL DEFAULT 0;
