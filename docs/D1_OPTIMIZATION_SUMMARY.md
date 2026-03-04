# สรุปการลด D1 Queries และ Rows Read

## เป้าหมาย
- ลด D1 queries ที่เกิดซ้ำจาก auth, settings/config, list pages, health
- ลด rows read ด้วยการเลือกเฉพาะ column, pagination, แก้ N+1, และ index
- **ไม่เปลี่ยน** business logic, permission, route paths

---

## รายชื่อไฟล์ที่แก้ไข

### สร้างใหม่
| ไฟล์ | คำอธิบาย |
|------|----------|
| `lib/d1-cache.ts` | TTL cache ใน worker memory (Map): authCache 60s, bootstrapKeysCache 120s, settingValueCache 30s |
| `lib/get-setting-cached.ts` | อ่าน setting ตาม key แบบมี cache (ลดการ query ตาราง settings บ่อย) |
| `db/migrations/0012_add_d1_indexes.sql` | Index สำหรับ transactions (deleted_at, txn_date + deleted_at) |

### แก้ไข
| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `lib/auth.ts` | getSessionUser ใช้ authCache ก่อน; query DB เฉพาะ session.userId แล้ว users แค่ id, username, role, isActive; invalidate cache ตอน logout |
| `lib/bootstrap.ts` | เช็ก getCachedBootstrapKeys() ก่อน; ถ้าครบไม่เข้า DB; select แค่ settings.key |
| `lib/payroll.ts` | getLatePenaltyPerMinute + getSalaryPolicySettings ใช้ getSettingValueCached; ลบ direct settings query |
| `app/api/auth/logout/route.ts` | เรียก invalidateSessionCache(sessionId) หลัง logout |
| `app/api/dashboard/route.ts` | ใช้ getSettingValueCached สำหรับ DISPLAY_CURRENCY, EXCHANGE_RATES |
| `app/api/reports/route.ts` | เหมือน dashboard — settings ผ่าน cache |
| `app/api/settings/route.ts` | GET ใช้ cache ทั้งก้อน 30s, select แค่ key/value, Cache-Control: private, max-age=30 |
| `app/api/settings/holiday-head/route.ts` | GET ใช้ getSettingValueCached(HOLIDAY_HEAD_USER_ID) |
| `app/api/holidays/route.ts` | HOLIDAY_HEAD_USER_ID ใช้ getSettingValueCached |
| `app/api/late-arrivals/route.ts` | ใช้ getSettingValueCached สำหรับ HOLIDAY_HEAD; ตรวจ user แค่ select users.id |
| `app/api/employees/route.ts` | Cache-Control: private, max-age=30 สำหรับ GET |
| `app/api/transactions/route.ts` | POST ใช้ getSettingValueCached สำหรับ DISPLAY_CURRENCY, EXCHANGE_RATES (แทน 2 query settings) |

### Health (ทำไว้แล้วใน session ก่อนหน้า)
| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `app/api/health/route.ts` | ไม่ query DB; คืน { ok: true, ts } + Cache-Control |

---

## สรุปลด D1 query / rows read ตรงไหน

1. **Auth**
   - **ก่อน:** ทุก request ที่ต้อง auth → query sessions + users
   - **หลัง:** sessionId อยู่ใน authCache (60s) → **ไม่เข้า D1**; cache miss เท่านั้นที่ query และ select แค่ session.userId แล้ว users.id, username, role, isActive (ไม่ดึง password/salt)

2. **Settings / Config**
   - **ก่อน:** หลาย endpoint query settings โดยตรง (DISPLAY_CURRENCY, EXCHANGE_RATES, HOLIDAY_HEAD_USER_ID, SALARY_*)
   - **หลัง:** ใช้ getSettingValueCached (30s TTL) → อ่าน D1 แค่ครั้งแรกต่อ key ต่อ worker; GET /api/settings ใช้ cache ทั้งก้อน 30s + select แค่ key, value

3. **Bootstrap**
   - **ก่อน:** ทุกครั้งที่เช็ก bootstrap → select จาก settings
   - **หลัง:** getCachedBootstrapKeys() ครบ required keys → return โดยไม่เข้า DB; select แค่ key เมื่อต้อง bootstrap จริง

4. **Dashboard / Reports / Transactions POST**
   - ลดการ query settings โดยใช้ getSettingValueCached สำหรับ DISPLAY_CURRENCY, EXCHANGE_RATES

5. **Payroll**
   - getLatePenaltyPerMinute, getSalaryPolicySettings ใช้ cache → ลด settings query ตอนสร้าง/คำนวณเงินเดือน

6. **Index**
   - `idx_transactions_deleted_at`, `idx_transactions_txn_date_deleted` → ลด full scan เมื่อ filter/order ตาม deleted_at, txn_date (list transactions)

7. **Health**
   - ไม่ query DB; ลด D1 read เมื่อมี health check บ่อย

8. **Rows read**
   - getSessionUser: select เฉพาะ column ที่ใช้ (id, username, role, isActive)
   - bootstrap: select เฉพาะ key
   - get-setting-cached: select เฉพาะ value
   - late-arrivals/holiday-head: ใช้ cache หรือ select เฉพาะ id ที่จำเป็น

---

## Build และ Lint

- **Lint:** ตรวจแล้วไม่มี error ในไฟล์ที่แก้
- **Build:** บนเครื่องนี้ไม่มี `npm` ใน PATH จึงไม่ได้รัน `npm run build` — **ควรรัน `npm run build` ใน CI หรือเครื่องที่มี Node ตั้งค่าแล้ว** เพื่อยืนยันว่าไม่มี type error

---

## สิ่งที่ไม่ได้เปลี่ยน (ตามข้อจำกัด)

- Business logic และ permission เหมือนเดิม
- Route paths ไม่เปลี่ยน
- ถ้าไม่ login ยัง redirect/deny เหมือนเดิม (behavior จาก getSessionUser + requireAuth ไม่เปลี่ยน)
