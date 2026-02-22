# 9arm Ledger

Production-ready internal web app for recording deposit/withdraw + income/expense ledger for multiple gambling websites. Includes wallets, transfers, dashboards, reports, and CSV export.

---

## ⚠️ ข้อจำกัดสำคัญ – ห้ามลืม

**ไม่ต้องติดตั้ง Node.js หรือ Wrangler บนเครื่อง**

- ตั้งค่าทั้งหมดบน **Cloudflare Dashboard** เท่านั้น
- Deploy โดย **Push ขึ้น Git** — Cloudflare จะ build และ deploy ให้
- ไม่มีคำสั่ง local ที่ user ต้องรันเอง

---

## PWA & Icon

Copy app icon ไปที่ `public/icon.png` (แนะนำ 512×512 px หรือใหญ่กว่า)

## Deployment (Dashboard + Git เท่านั้น)

แอปใช้ **@opennextjs/cloudflare** deploy เป็น **Workers** — ตั้งค่าทั้งหมดบน Dashboard

### 1. สร้าง D1 Database

1. Cloudflare Dashboard → **Workers & Pages** → **D1** → **Create database**
2. ตั้งชื่อ (เช่น `9arm-ledger-db`)
3. บันทึก **Database ID**

### 2. สร้าง Workers Project + เชื่อม Git

1. **Workers & Pages** → **Create application** → **Workers** → **Connect to Git**
2. เลือก GitHub repository
3. **Build configuration**:
   - **Build command**: `npm install && npm run build:cf`
   - **Build output directory**: (เว้นว่าง — OpenNext deploy เอง)
4. **Root directory**: (เว้นว่าง หรือ `/` ถ้าต้องการ)

### 3. ผูก D1 กับ Workers

1. เข้า Workers project → **Settings** → **Bindings**
2. **D1 database bindings** → **Add binding**
3. **Variable name**: `DB`
4. **D1 database**: เลือก database ที่สร้างในขั้นตอนที่ 1

### 4. ตั้งค่า Environment Variables

1. Workers project → **Settings** → **Variables and Secrets**
2. เพิ่ม:
   - `APP_SECRET`: สตริงสุ่มยาว (เช่น สร้างจาก [generate](https://generate-secret.vercel.app/32))
   - `SUPERADMIN_USERNAME`: ชื่อผู้ใช้ Superadmin
   - `SUPERADMIN_PASSWORD`: รหัสผ่าน Superadmin (อย่างน้อย 8 ตัว)
   - `SESSION_TTL_HOURS`: `24` (optional)

> สำหรับ **Workers Builds**: ต้องตั้ง Build variables ด้วย (เช็ก [OpenNext env vars](https://opennext.js.org/cloudflare/howtos/env-vars#workers-builds))

### 5. แก้ wrangler.jsonc ใน repo

แก้ `database_id` ใน `d1_databases` ให้ตรงกับ D1 จริง แล้ว push ขึ้น Git

### 6. รัน Schema ใน D1

1. **Workers & Pages** → **D1** → เลือก database
2. เปิด **Console** (Execute SQL)
3. คัดลอก `db/schema.sql` วาง แล้ว **Execute**

**สำหรับฐานข้อมูลที่มีอยู่แล้ว:** รัน migrations ตามลำดับใน D1 Console:
- `db/migrations/0001_add_transfer_time.sql`
- `db/migrations/0002_add_withdraw_fee.sql` (ค่าธรรมเนียมถอน)
- `db/migrations/0003_add_soft_delete.sql` (soft delete ธุรกรรม/โอนเงิน)
- `db/migrations/0004_add_bonuses.sql` (โบนัสและหมวดหมู่โบนัส)

### 7. Deploy

Push commit ขึ้น Git → Cloudflare จะ build และ deploy อัตโนมัติ

### 8. Login

เข้าสู่ระบบด้วย `SUPERADMIN_USERNAME` และ `SUPERADMIN_PASSWORD`

---

## Troubleshooting

### เปิด /api/health เพื่อตรวจสอบ

`https://your-worker.workers.dev/api/health` จะแสดงสถานะ DB, APP_SECRET, SUPERADMIN และ schema

1. **DB binding**: ผูก D1 ใน Settings → Bindings ชื่อ `DB`
2. **APP_SECRET**: ตั้งใน Variables and Secrets
3. **Schema**: รัน `db/schema.sql` ใน D1 Console
4. **SUPERADMIN**: ตั้ง `SUPERADMIN_USERNAME` และ `SUPERADMIN_PASSWORD`

### Custom Domain

Workers → **Settings** → **Domains & Routes** → Add custom domain

---

## Features

- **Auth**: Login, HttpOnly cookies, RBAC (SUPER_ADMIN, ADMIN, AUDIT)
- **Transactions**: Deposit/Withdraw, listing, edit with audit trail
- **Wallets**: Opening balance, computed balances
- **Transfers**: Internal, External Out, External In
- **Dashboard**: Today/month summary
- **Reports**: Daily/Monthly/Yearly
- **CSV Export**: Transactions and transfers
- **Settings** (SUPER_ADMIN): Websites, users, currency, exchange rates

## Tech Stack

- Next.js 14 App Router + TypeScript
- Cloudflare Workers + @opennextjs/cloudflare
- D1 (SQLite) + Drizzle ORM
- TailwindCSS + shadcn/ui + lucide-react
