# ออกแบบฟีเจอร์การคำนวณเงินเดือน

เอกสารนี้อธิบายแนวทางออกแบบฟีเจอร์คำนวณเงินเดือนที่ใช้ข้อมูลจาก **ตารางวันหยุด** (holiday_entries) เพื่อหักวันหยุดออกจากจำนวนวันทำงาน

---

## 1. ข้อมูลที่มีอยู่แล้ว

- **ตารางวันหยุด (`holiday_entries`)**
  - `user_id` = พนักงาน (users.id)
  - `holiday_date` = วันที่หยุด (YYYY-MM-DD)
  - ใช้สำหรับนับจำนวนวันหยุดของแต่ละคนในแต่ละเดือน

- **พนักงาน** = ผู้ใช้ในระบบ (`users`) ที่มี **role = ADMIN เท่านั้น** — ใช้ทั้งในตารางวันหยุดและในการคำนวณเงินเดือน (SUPER_ADMIN และ AUDIT ไม่นับ)

---

## 2. สกุลเงินและองค์ประกอบเงินเดือน

- **สกุลเงินเดือน** = ใช้**ตั้งค่าแยก** (ตั้งค่า → สกุลเงินเดือน) — **ไม่รวมกับสกุลเงินแสดงผลในธุรกรรม** (ตั้งค่า → สกุลเงินแสดงผล). จำนวนเงินฐานและค่าตอบแทนพนักงานใช้สกุลเงินเดือน (key `SALARY_CURRENCY`: LAK | THB | USD)
- **ค่าข้าว** = คิดตาม**วันที่มาทำงาน** (จำนวนวันทำงานในเดือนนั้น หลังหักวันหยุดจากตารางวันหยุด)
- **ค่าไฟ, ค่าโบนัส, ค่าอื่น** = เป็นรายการค่าตอบแทนเพิ่ม — **เพิ่ม/แก้ไขได้ในตั้งค่า** (ตั้งค่า → รายการค่าตอบแทนเพิ่ม). ค่าเริ่มต้นมี "ค่าไฟ", "ค่าโบนัส", "ค่าอื่น" และสามารถเพิ่มรายการอื่นได้ตามต้องการ

---

## 3. สูตรการคำนวณเงินเดือน (แนวทาง)

### 3.1 ตัวแปรหลัก

| ตัวแปร | ความหมาย |
|--------|-----------|
| **เดือนที่คำนวณ** | ปี-เดือน (เช่น 2026-03) |
| **จำนวนวันในเดือน** | `totalDays = 28/29/30/31` ตามเดือน |
| **วันหยุด (จากระบบ)** | จำนวนวันที่พนักงานลงวันหยุดในตารางวันหยุดในเดือนนั้น |
| **วันทำงาน** | `workingDays = totalDays - holidayDays` (หรือกำหนดสูตรเอง เช่น หักวันหยุดราชการ/วันอาทิตย์แล้วค่อยหักวันหยุดส่วนตัว) |

### 3.2 สูตรแบบสัดส่วน (ตัวอย่าง)

```
เงินเดือนที่ได้ = (เงินเดือนฐาน / จำนวนวันในเดือน) × จำนวนวันทำงาน
```

หรือถ้ามีวันหยุดราชการ/วันหยุดประจำสัปดาห์:

```
วันทำงานสูงสุดในเดือน = จำนวนวันในเดือน - วันหยุดราชการ - วันอาทิตย์ (ถ้านับ)
วันทำงานจริง = วันทำงานสูงสุด - วันหยุดที่พนักงานลงในระบบ
เงินเดือนที่ได้ = (เงินเดือนฐาน / วันทำงานสูงสุดในเดือน) × วันทำงานจริง
```

---

## 4. โครงสร้างข้อมูลที่แนะนำ (สำหรับฟีเจอร์ต่อไป)

### 4.1 เก็บเงินเดือนฐานต่อพนักงาน

**ตัวเลือก A: เก็บใน settings (JSON)**  
- Key เช่น `SALARY_BASE`  
- Value = `{ "userId": amountMinor, ... }`  
- ข้อดี: ไม่ต้องเพิ่มตาราง ข้อเสีย: แก้ทีละคน ไม่มีประวัติ

**ตัวเลือก B: ตารางใหม่ `employee_salaries`** (แนะนำ)

```sql
CREATE TABLE employee_salaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  effective_from TEXT NOT NULL,  -- YYYY-MM-DD เริ่มใช้อัตรานี้
  base_salary_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  UNIQUE(user_id, effective_from)
);
```

- หนึ่งคนมีได้หลายแถว (แต่ละช่วงเวลา) เวลาคำนวณเลือกแถวที่ `effective_from <= เดือนที่คำนวณ` ล่าสุด

### 4.2 รายการค่าตอบแทนเพิ่ม (ค่าไฟ, โบนัส, อื่น)

- เก็บใน **settings** key `SALARY_ALLOWANCE_TYPES` = array ของ `{ id, name }` (มีให้แล้วในตั้งค่า)
- ใช้เป็นรายการที่สามารถใส่จำนวนเงินเพิ่มให้พนักงานได้ในรอบ payroll (ค่าไฟ, ค่าโบนัส, ค่าอื่น ฯลฯ)

### 4.3 เก็บผลการคำนวณแต่ละรอบ (Payroll Run)

**ตาราง `payroll_runs`**

```sql
CREATE TABLE payroll_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year_month TEXT NOT NULL,  -- YYYY-MM
  status TEXT NOT NULL,      -- DRAFT | CONFIRMED
  created_at INTEGER NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id)
);
```

**ตาราง `payroll_items`**

```sql
CREATE TABLE payroll_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payroll_run_id INTEGER NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  base_salary_minor INTEGER NOT NULL,
  total_days INTEGER NOT NULL,
  holiday_days INTEGER NOT NULL,
  working_days INTEGER NOT NULL,
  amount_minor INTEGER NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL
);
```

- `holiday_days` = นับจาก `holiday_entries` ในเดือนนั้นสำหรับ `user_id` นั้น  
- `working_days = total_days - holiday_days` (หรือตามนโยบายบริษัท)  
- `amount_minor` = เงินที่คำนวณได้จากสูตรที่เลือก

---

## 5. ขั้นตอนการทำงาน (Flow)

1. **SUPER_ADMIN / ผู้มีสิทธิ์** ตั้งค่าเงินเดือนฐานต่อพนักงาน (ใน `employee_salaries` หรือ settings) — **เฉพาะ user ที่ role = ADMIN**
2. เลือก **ปี-เดือน** ที่จะรัน payroll.
3. ระบบดึง:
   - จำนวนวันในเดือน
   - รายการพนักงานที่ role = ADMIN เท่านั้น
   - รายการวันหยุดจาก `holiday_entries` ในเดือนนั้นแยกตาม `user_id` (ของ ADMIN แต่ละคน)
   - เงินเดือนฐานของแต่ละคน (จาก `employee_salaries` ตาม effective date)
4. คำนวณ `working_days`, `amount_minor` ตามสูตรที่กำหนด.
5. สร้าง `payroll_run` (สถานะ DRAFT) และ `payroll_items` แต่ละคน.
6. ให้ตรวจสอบ/แก้ไข (ถ้ามี) แล้วเปลี่ยนสถานะเป็น CONFIRMED เมื่ออนุมัติ.

---

## 6. สิทธิ์การใช้งาน (แนะนำ)

- **ดูรายงานเงินเดือน / payroll runs**: ADMIN ขึ้นไป (หรือตาม role ที่กำหนด).
- **สร้าง/แก้ไข DRAFT payroll**: ADMIN ขึ้นไป.
- **ยืนยัน (CONFIRMED)**: อาจจำกัดเป็น SUPER_ADMIN เท่านั้น เพื่อกันการแก้หลังยืนยัน.

---

## 7. สรุป

- **สกุลเงินเดือน** = ตั้งค่าแยก (SALARY_CURRENCY) ไม่ใช้สกุลเงินแสดงผลในธุรกรรม; **ค่าข้าว** = ตามวันที่มาทำงาน; **ค่าไฟ/โบนัส/อื่น** = จากตั้งค่า (รายการค่าตอบแทนเพิ่ม).
- ใช้ตาราง **holiday_entries** ที่มีอยู่แล้วเป็นตัวนับ **วันหยุด** ต่อคนต่อเดือน.
- เพิ่ม **employee_salaries** (หรือทางเลือก settings) สำหรับเงินเดือนฐาน.
- รายการค่าตอบแทนเพิ่ม (ค่าไฟ, โบนัส, อื่น) ตั้งค่าได้ใน **ตั้งค่า → รายการค่าตอบแทนเพิ่ม** (key `SALARY_ALLOWANCE_TYPES`).
- เพิ่ม **payroll_runs** + **payroll_items** สำหรับเก็บผลคำนวณแต่ละรอบ.
- สูตรคำนวณใช้ **วันทำงาน = จำนวนวันในเดือน − วันหยุดจากตารางวันหยุด** (หรือปรับตามนโยบายวันหยุดราชการ/วันอาทิตย์).

เมื่อพร้อมพัฒนาฟีเจอร์เงินเดือน สามารถอ้างอิงเอกสารนี้และเริ่มจาก migration ตาราง `employee_salaries`, `payroll_runs`, `payroll_items` ตามลำดับ
