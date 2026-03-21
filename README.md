# Admin

แอปเว็บภายในสำหรับบันทึกฝาก/ถอน ธุรกรรม กระเป๋าเงิน โอนเงิน แดชบอร์ด รายงาน เงินเดือน และจัดการพนักงาน (หลายเว็บไซต์). รองรับ PWA.

---

## ⚠️ ข้อจำกัดสำคัญ – ห้ามลืม

**ไม่ต้องติดตั้ง Node.js หรือ Wrangler บนเครื่อง**

- ตั้งค่าทั้งหมดบน **Cloudflare Dashboard** เท่านั้น
- Deploy โดย **Push ขึ้น Git** — Cloudflare จะ build และ deploy ให้
- ไม่มีคำสั่ง local ที่ user ต้องรันเอง

---

## สถาปัตยกรรมปัจจุบัน

- **Runtime:** Cloudflare Workers (ผ่าน @opennextjs/cloudflare)
- **Database:** D1 (SQLite) + Drizzle ORM
- **Cache:** Workers KV (optional) — ใช้เก็บสถานะ bootstrap และ cache session→user เพื่อลด D1 read
- **Analytics:** Analytics Engine (optional) — log pathname, status, duration ต่อ request
- **Auth:** Login ด้วย cookie, RBAC (SUPER_ADMIN, ADMIN, AUDIT); session cache ใน KV เมื่อมี binding

**เงินเดือน:** ใช้ **กีบ (LAK)** เป็นค่าเดียว — ไม่มีตั้งค่าสกุลเงินเดือน แก้ได้แค่เงินเดือนฐานต่อพนักงานที่หน้าจัดการพนักงาน

---

## PWA & Icon

Copy ไอคอนแอปไปที่ `public/icon.png` (แนะนำ 512×512 px หรือใหญ่กว่า)

---

## Deployment (Dashboard + Git เท่านั้น)

แอปใช้ **@opennextjs/cloudflare** deploy เป็น **Workers** — ตั้งค่าทั้งหมดบน Dashboard

### 1. สร้าง D1 Database

1. Cloudflare Dashboard → **Workers & Pages** → **D1** → **Create database**
2. ตั้งชื่อ (เช่น `9arm-ledger-db`)
3. บันทึก **Database ID**

### 2. สร้าง Workers Project + เชื่อม Git

1. **Workers & Pages** → **Create application** → **Workers** → **Connect to Git**
2. เลือก repository
3. **Build configuration**
   - **Build command:** `npm install && npm run build:cf`
   - **Build output directory:** (เว้นว่าง)
4. **Root directory:** (เว้นว่าง หรือ `/`)

### 3. ผูก Bindings

1. เข้า Workers project → **Settings** → **Bindings**

2. **D1**
   - **D1 database bindings** → Add
   - **Variable name:** `DB`
   - **D1 database:** เลือก database จากขั้นตอนที่ 1

3. **KV (แนะนำ เพื่อลด D1 read)**
   - **KV namespace bindings** → Add
   - **Variable name:** `KV`
   - สร้าง namespace ก่อนที่ **Workers & Pages** → **KV** → **Create namespace** แล้ว copy **Namespace ID** ใส่

4. **Analytics Engine (ถ้าต้องการ log metric)**
   - **Analytics Engine Datasets** → Add
   - **Variable name:** `AE`
   - **Dataset:** `9arm_ae` (สร้างอัตโนมัติเมื่อมีข้อมูลเขียนครั้งแรก)

### 4. แก้ wrangler.jsonc ใน repo

- แก้ `database_id` ใน `d1_databases` ให้ตรงกับ D1 จริง
- ถ้าใช้ KV: แก้ `id` ใน `kv_namespaces` ให้เป็น **Namespace ID** ที่สร้างใน Dashboard (แทน `YOUR_KV_NAMESPACE_ID`)
- จากนั้น push ขึ้น Git

### 5. ตั้งค่า Environment Variables

1. Workers project → **Settings** → **Variables and Secrets**
2. เพิ่ม:
   - `APP_SECRET` — สตริงสุ่มยาว (เช่น [generate](https://generate-secret.vercel.app/32))
   - `SUPERADMIN_USERNAME` — ชื่อผู้ใช้ Superadmin
   - `SUPERADMIN_PASSWORD` — รหัสผ่าน Superadmin (อย่างน้อย 8 ตัว)
   - `SESSION_TTL_HOURS` — เช่น `24` (optional)

> สำหรับ **Workers Builds** ต้องตั้ง Build variables ด้วย (ดู [OpenNext env vars](https://opennext.js.org/cloudflare/howtos/env-vars#workers-builds))

### 6. รัน Schema และ Migrations ใน D1

1. **Workers & Pages** → **D1** → เลือก database → **Console** (Execute SQL)
2. รัน `db/schema.sql` ก่อน (สร้างตารางหลัก)
3. ถ้าฐานมีอยู่แล้ว รัน migrations ตามลำดับ:
   - `db/migrations/0001_add_transfer_time.sql`
   - `db/migrations/0002_add_withdraw_fee.sql`
   - `db/migrations/0003_add_soft_delete.sql`
   - `db/migrations/0004_add_bonuses.sql`
   - `db/migrations/0005_add_credit_cuts.sql`
   - `db/migrations/0006_add_credit_cut_time.sql`
   - `db/migrations/0007_add_holiday_entries.sql`
   - `db/migrations/0008_add_payroll.sql`
   - `db/migrations/0009_add_payroll_allowances.sql`
   - `db/migrations/0010_add_late_arrivals.sql`
   - `db/migrations/0011_late_arrivals_minutes.sql`
   - `db/migrations/0012_add_d1_indexes.sql`

### 7. Deploy

Push commit ขึ้น Git → Cloudflare จะ build และ deploy อัตโนมัติ

### 8. Login

เข้าสู่ระบบด้วย `SUPERADMIN_USERNAME` และ `SUPERADMIN_PASSWORD`

---

## Troubleshooting

### ตรวจสอบ /api/health

`https://your-worker.workers.dev/api/health` คืน `{ ok: true, ts: ... }` (ไม่เข้า D1)

- **DB ไม่ทำงาน:** เช็ก D1 binding ชื่อ `DB` ใน Settings → Bindings
- **APP_SECRET:** ตั้งใน Variables and Secrets
- **Schema:** รัน `db/schema.sql` และ migrations ใน D1 Console
- **SUPERADMIN:** ตั้ง `SUPERADMIN_USERNAME` และ `SUPERADMIN_PASSWORD`

### Custom Domain

Workers → **Settings** → **Domains & Routes** → Add custom domain

---

## Features

- **Auth:** Login, HttpOnly cookies, RBAC (SUPER_ADMIN, ADMIN, AUDIT)
- **Transactions:** ฝาก/ถอน, รายการ, แก้ไขพร้อม audit
- **Wallets:** ยอดเปิดต้น, ยอดคงเหลือคำนวณจากธุรกรรม
- **Transfers:** โอนภายใน, โอนออกภายนอก, โอนเข้าภายนอก
- **Dashboard:** สรุปวันนี้ / เดือน, ยอดกระเป๋าเงิน
- **Reports:** รายวัน/เดือน/ปี
- **เงินเดือน:** รอบเงินเดือน, เงินเดือนฐานต่อพนักงาน — **หน่วยเป็นกีบ (LAK) เท่านั้น** ไม่มีตั้งค่าสกุลเงินเดือน
- **จัดการพนักงาน:** รายชื่อ ADMIN, หัวหน้าวันหยุด, เงินเดือนฐาน (กีบ)
- **ตารางวันหยุด / มาสาย:** บันทึกวันหยุดและนาทีมาสาย (ใช้คำนวณเงินเดือน)
- **Settings** (SUPER_ADMIN): เว็บไซต์, ผู้ใช้, สกุลเงินแสดงผล, อัตราแลกเปลี่ยน, หมวดหมู่โบนัส, รายการค่าตอบแทนเพิ่ม

---

## Tech Stack

- Next.js 14 App Router + TypeScript
- Cloudflare Workers + @opennextjs/cloudflare
- D1 (SQLite) + Drizzle ORM
- Workers KV (optional), Analytics Engine (optional)
- TailwindCSS + shadcn/ui + lucide-react
