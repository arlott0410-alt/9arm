# KV + D1 Optimization และ Analytics Engine

## 1) รายชื่อไฟล์ที่แก้ทั้งหมด + เหตุผล

### A) Wrangler และ Env types
| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `wrangler.jsonc` | เพิ่ม `kv_namespaces` binding ชื่อ "KV" (id ต้องสร้างใน Dashboard แล้วใส่), เพิ่ม `analytics_engine_datasets` binding "AE" dataset "9arm_ae" |
| `lib/cf-env.ts` | เพิ่ม `Env.KV?: KVNamespace`, `Env.AE?: AnalyticsEngineDataset` |
| `env.d.ts` | เพิ่ม `KV?`, `AE?` ใน `CloudflareEnv` |

### B) Bootstrap ไม่แตะ D1 ทุก request
| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `lib/bootstrap.ts` | เพิ่ม `ensureBootstrapped(db, env)`: ถ้ามี `env.KV` แล้ว `KV.get("bootstrapped:v1")` มีค่า → return ทันที; ไม่มีถึงค่อยเรียก `bootstrapSettings(db)` แล้ว `KV.put("bootstrapped:v1", "1", { expirationTtl: 86400 })` |
| `lib/api-helpers.ts` | เรียก `ensureBootstrapped(db, env)` แทน `bootstrapSettings(db)`; ใช้ `getCachedSessionUser(db, sessionId, env)` แทน `getSessionUser` |

### C) Cache session → user ใน KV
| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `lib/auth.ts` | เพิ่ม `getCachedSessionUser(db, sessionId, env)`: ถ้ามี `env.KV` แล้ว `KV.get("sess:"+sessionId)` hit → คืน user จาก JSON; miss ถึงเรียก `getSessionUser` แล้ว `KV.put` ด้วย TTL (จาก SESSION_TTL_HOURS หรือ 30 นาที). เพิ่ม `deleteSessionFromKV(sessionId, env)` |
| `app/api/auth/logout/route.ts` | เรียก `deleteSessionFromKV(sessionId, env)` ก่อนลบ session ใน D1 |
| `app/api/auth/me/route.ts` | ใช้ `getCachedSessionUser(db, sessionId, env)` แทน `getSessionUser` |

### D) ลด request ฝั่ง UI
| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| Sidebar / MobileDrawer | มี `prefetch={false}` อยู่แล้ว |
| AuthProvider | ใช้ module-level `authPromise` + `getAuth()` เรียก `/api/auth/me` ครั้งเดียวแล้วแชร์; ทุกหน้าใช้ context ไม่ยิงซ้ำ |
| Link อื่นใน list/detail | ตรวจแล้วมี `prefetch={false}` ครบ |

### E) Analytics Engine
| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `lib/analytics.ts` | สร้างใหม่: `logRouteMetric(env, { pathname, status, durationMs })` เขียนลง `env.AE.writeDataPoint` (indexes/blobs/doubles) ไม่ log ข้อมูล sensitive |
| `middleware.ts` | หลัง `next()` วัด duration, ถ้ามี `getCloudflareContext()?.env?.AE` เรียก `logRouteMetric` |

### F) UI premium
| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `app/dashboard/page.tsx` | เพิ่ม `dataLoading` state, โหลดข้อมูลแสดง skeleton การ์ด + ตาราง; empty state ยอดกระเป๋าเงินใช้ไอคอน + ข้อความ |
| `app/employees/page.tsx` | โหลดตารางแสดง skeleton แถว; empty state อยู่ใน tbody พร้อมไอคอน; แถวตารางมี `hover:bg-[#1E293B]/50`, ปรับ spacing (py-3) |

---

## 2) อธิบายว่าลด D1 rows read ได้จากอะไร

### Bootstrap (ผลกระทบใหญ่)
- **ก่อน:** ทุก API request ผ่าน `getDbAndUser()` เรียก `bootstrapSettings(db)` → ทุกครั้งที่ cache ใน memory ไม่ครบจะ `db.select({ key: settings.key }).from(settings)` = อ่านทุกแถวในตาราง settings
- **หลัง:** เรียก `ensureBootstrapped(db, env)` แทน; ถ้ามี KV และ `KV.get("bootstrapped:v1")` มีค่า → **ไม่เข้า D1 เลย**; มีแต่ request แรกหลัง deploy หรือหลัง TTL 24h ถึงจะเข้า D1 แล้วตั้งค่า bootstrapped ใน KV

### Session / Auth
- **ก่อน:** ทุก request ที่ต้อง auth → query `sessions` + `users` (หรือใช้แค่ in-memory cache 60s)
- **หลัง:** ใช้ `getCachedSessionUser`: ถ้า `env.KV` และ `KV.get("sess:"+sessionId)"` hit → **ไม่เข้า D1**; miss ถึง query D1 แล้วเก็บใน KV (TTL ตาม SESSION_TTL_HOURS หรือ 30 นาที). Logout ลบ key ใน KV ด้วย

ดังนั้น:
- **Bootstrap:** ลด D1 read ได้เกือบทุก request (ยกเว้นเมื่อยังไม่ bootstrapped หรือหลัง TTL)
- **Session cache ใน KV:** ลดการ query sessions + users ใน D1 เมื่อ session hit cache ใน KV

---

## 3) Build และ type / lint

- **TypeScript:** ตรวจด้วย `npx tsc --noEmit` (บนเครื่องที่ติดตั้ง Node แล้ว)
- **Lint:** ตรวจแล้วไม่มี error ในไฟล์ที่แก้
- **Build:** รัน `npm run build` หรือ `npm run build:cf` ใน CI/เครื่องที่มี Node เพื่อยืนยัน

---

## 4) สิ่งที่ต้องตั้งค่าใน Cloudflare Dashboard

- **KV:** สร้าง KV namespace ที่ Workers & Pages → KV → Create แล้วนำ **id** ไปใส่ใน `wrangler.jsonc` แทน `YOUR_KV_NAMESPACE_ID`
- **Analytics Engine:** dataset "9arm_ae" จะถูกสร้างอัตโนมัติเมื่อมี binding และมีการเขียนข้อมูลครั้งแรก (ไม่ต้องสร้าง dataset ล่วงหน้า)
- **Environment variables:** ไม่ต้องเพิ่มสำหรับ KV/AE; binding มาจาก wrangler

---

## 5) สิ่งที่ไม่ได้เปลี่ยน

- Business logic และ permission เหมือนเดิม
- Route paths ไม่เปลี่ยน
- พฤติกรรม auth: ไม่ login ยัง redirect/deny เหมือนเดิม
