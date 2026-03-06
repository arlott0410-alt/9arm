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
   - **หลัง:** ใช้ getSettingValueCached (30s TTL) ใน dashboard, reports, transactions POST, **transfers POST**, **bonuses POST**, **credit-cuts POST**, **reports/bonuses**, **reports/credit-cuts** → ลด D1 read ต่อ key ต่อ worker; GET /api/settings ใช้ cache ทั้งก้อน 30s

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

---

## รอบปรับปรุงล่าสุด (D1 row reads + cache invalidation)

### Indexes (migration 0013)
- **db/migrations/0013_add_performance_indexes.sql**: Indexes for transactions (type, deleted_at, txn_date), (website_id, deleted_at, txn_date), (wallet_id, deleted_at); transfers (type, deleted_at, txn_date), (from_wallet_id, deleted_at), (to_wallet_id, deleted_at), (deleted_at, txn_date); bonuses (website_id, deleted_at, bonus_time), (deleted_at, bonus_time); credit_cuts (website_id, deleted_at, cut_time), (deleted_at, cut_time); late_arrivals (user_id, late_date); holiday_entries (user_id, holiday_date); employee_salaries (user_id, effective_from). All `CREATE INDEX IF NOT EXISTS` — safe on existing DB.

### Response + count caches (lib/d1-cache.ts)
- **dashboardResponseCache**, **reportsResponseCache**, **walletsBalanceResponseCache** (45s TTL); **listCountCache** (25s TTL).
- **walletDetailCache** (45s): GET /api/wallets/[id] — แต่ละ request เดิมทำ 5 query (1 wallet + 4 aggregate); cache ลด row read เมื่อเปิดดู wallet เดิมซ้ำ; ล้างเมื่อ invalidateDataCaches()
- **invalidateDataCaches(env?)**: Clears all four; ต้องส่ง **env** จาก getDbAndUser เพื่อให้เมื่อมี KV ระบบจะเขียน `data-cache:version` ลง KV ทำให้ isolate อื่นเห็นว่ามีการ invalidate และไม่ใช้ cache เก่า (ลดผลเสียแบบ cache ต่อ isolate).

### KV สัญญาณ invalidate ข้าม isolate (ลดผลเสีย)
- เมื่อมี **KV binding**: หลัง mutation เรียก **invalidateDataCaches(result.env)** → เขียน timestamp ลง KV key `data-cache:version` → GET dashboard/reports/wallets/list จะเช็ก version นี้ (cache ใน memory 5s ต่อ isolate เพื่อไม่ให้ยิง KV ทุก request) ถ้า version ใหม่กว่า cache ที่เก็บไว้ จะไม่ใช้ cache และ query ใหม่
- เมื่อ**ไม่มี KV**: ทำงานเหมือนเดิม (ล้างแค่ in-memory ใน isolate เดียว); ไม่มีผลกระทบ

### Cache invalidation on mutations (Phase 11) — รายการที่ต้องเรียก
- **invalidateDataCaches(result.env)** เรียกหลัง: transactions POST (deposit/withdraw), transactions [id] DELETE; transfers POST, transfers [id] DELETE (soft-delete); wallets POST, wallets [id] DELETE; bonuses POST, bonuses [id] DELETE; credit-cuts POST, credit-cuts [id] DELETE.  
- **ถ้าเพิ่ม mutation route ใหม่ที่กระทบ dashboard/reports/wallets/lists ต้องไม่ลืมเรียก invalidateDataCaches(env)** — ดู JSDoc ใน lib/d1-cache.ts ฟังก์ชัน invalidateDataCaches
- **invalidateSettingsCaches()** เรียกหลัง: settings display-currency PUT, exchange-rates PUT, holiday-head PUT (และ delete), allowance-types PUT.
- **invalidateWebsitesListCache()** เรียกหลัง: settings/websites POST, settings/websites [id] PATCH.
- **invalidateBonusCategoriesListCache()** เรียกหลัง: settings/bonus-categories POST, PUT [id], DELETE [id].

### Semi-static list caches (Phase 7)
- **allSettingsCache** (GET /api/settings) — ใช้จาก d1-cache; invalidate ผ่าน invalidateSettingsCaches() เมื่ออัปเดต settings ใดๆ
- **websitesListCache**, **bonusCategoriesListCache** (30s) — GET /api/settings/websites, GET /api/settings/bonus-categories; invalidate เมื่อสร้าง/แก้/ลบ websites หรือ bonus-categories

### Auth / bootstrap (Phase 8)
- **KV**: เมื่อมี binding KV — session อ่านจาก KV ก่อน (ไม่เข้า D1); bootstrap เช็ก KV ก่อน (bootstrapped:v1) ไม่เข้า D1
- **ไม่มี KV**: ใช้ in-memory authCache + getSessionUser และ bootstrapSettings + getCachedBootstrapKeys ตามเดิม — fallback ปลอดภัย

### Summary layer (Phase 12)
- **ไม่ได้เพิ่ม** daily_transaction_summary / wallet_balance_snapshot — เลือกใช้ index + cache + tight selects แทน เพื่อไม่ให้ซับซ้อนและรักษา semantics เดิม; ถ้าอนาคตต้องการลด scan อีกสามารถพิจารณา summary table แยก

### Environment / bindings
- **DB**, **APP_SECRET** ตามเดิม
- **KV** (optional): สำหรับ bootstrap + session cache; ไม่มีก็ยังทำงานได้ (fallback ไป D1 + in-memory cache)

### การตรวจสอบว่าไม่กระทบงานเดิม (Verification)
- **API response shape**: Dashboard, reports, wallets (withBalance), list (transactions/transfers/bonuses/credit-cuts) คืน payload รูปแบบเดิม — ใช้แค่ cache เป็นตัวกลาง ไม่เปลี่ยนโครงสร้าง JSON
- **Auth / bootstrap**: ไม่ได้แก้ flow; getDbAndUser ยังคืน { db, user, env } เหมือนเดิม
- **Mutation routes**: ยัง return inserted / { ok: true } เหมือนเดิม; เพิ่มแค่ invalidateDataCaches(result.env) หลัง success
- **เมื่อไม่มี KV**: getDataCacheVersion คืน 0, ไม่เขียน KV, ใช้แค่ in-memory cache + invalidation ใน isolate เดียว
- **เมื่อ KV ล้มชั่วคราว**: getDataCacheVersion มี try/catch — ถ้า KV.get throw จะคืน 0 แทน ไม่ให้ request ล้ม (degrade เป็นไม่ใช้ version check ใน request นั้น)
- **List count = 0**: unwrapDataCacheValue คืน 0 ได้; ใช้เช็กแค่ totalCount === undefined จึงไม่ไป re-query เมื่อ count จริงเป็น 0
- **Cache เก่า (ไม่มี _v)**: unwrapDataCacheValue ถ้าไม่มี _v/data จะคืน raw ตามเดิม — backward compatible กับ cache ที่ set ไว้ก่อน deploy
