-- มาสาย: เปลี่ยนจากวินาทีเป็นนาที หักนาทีละ 1000 กีบ
-- (D1 ไม่รองรับ DROP COLUMN จึงเก็บคอลัมน์เดิมไว้ ไม่ลบ)

-- late_arrivals: เพิ่ม minutes_late แล้วย้ายข้อมูลจาก seconds_late
ALTER TABLE late_arrivals ADD COLUMN minutes_late INTEGER NOT NULL DEFAULT 0;
UPDATE late_arrivals SET minutes_late = (seconds_late + 59) / 60 WHERE seconds_late > 0;

-- payroll_items: เพิ่ม late_minutes แล้วย้ายข้อมูลจาก late_seconds
ALTER TABLE payroll_items ADD COLUMN late_minutes INTEGER NOT NULL DEFAULT 0;
UPDATE payroll_items SET late_minutes = (late_seconds + 59) / 60 WHERE late_seconds > 0;
