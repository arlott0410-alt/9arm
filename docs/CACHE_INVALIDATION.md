# Cache Invalidation — กฎสำหรับผู้พัฒนา

## กฎบังคับ: เมื่อเพิ่มหรือแก้ไข mutation route

ถ้า API route ใด **สร้าง / แก้ไข / ลบ** ข้อมูลที่ส่งผลต่อ:

- **Dashboard** (ยอดฝากถอน, ยอดกระเป๋า)
- **Reports** (รายงานธุรกรรม/โอน)
- **รายการ wallets พร้อม balance** (GET /api/wallets?withBalance=1)
- **จำนวนรวม (totalCount)** ของ transactions, transfers, bonuses, credit-cuts

คุณ **ต้อง** เรียก **`invalidateDataCaches(result.env)`** หลัง mutation **สำเร็จ** (ก่อน `return NextResponse.json(...)`)

ส่ง **`result.env`** จาก `getDbAndUser(request)` เพื่อให้เมื่อมี KV ระบบจะ broadcast invalidation ไป isolate อื่นด้วย

---

## รายการ route ที่ต้องเรียก invalidateDataCaches(result.env) (ปัจจุบัน)

| ไฟล์ | Method | เมื่อไหร่ |
|------|--------|-----------|
| `app/api/transactions/route.ts` | POST | หลังสร้าง deposit หรือ withdraw สำเร็จ |
| `app/api/transactions/[id]/route.ts` | DELETE | หลัง soft-delete สำเร็จ |
| `app/api/transfers/route.ts` | POST | หลังสร้างโอนสำเร็จ |
| `app/api/transfers/[id]/route.ts` | DELETE | หลัง soft-delete สำเร็จ |
| `app/api/wallets/route.ts` | POST | หลังสร้างกระเป๋าสำเร็จ |
| `app/api/wallets/[id]/route.ts` | DELETE | หลังลบกระเป๋าสำเร็จ |
| `app/api/bonuses/route.ts` | POST | หลังสร้างโบนัสสำเร็จ |
| `app/api/bonuses/[id]/route.ts` | DELETE | หลัง soft-delete สำเร็จ |
| `app/api/credit-cuts/route.ts` | POST | หลังสร้างหักเครดิตสำเร็จ |
| `app/api/credit-cuts/[id]/route.ts` | DELETE | หลัง soft-delete สำเร็จ |

---

## Checklist เมื่อเพิ่ม mutation ใหม่

- [ ] Route สร้าง/แก้/ลบ ข้อมูลที่กระทบ dashboard, reports, wallets หรือ list count หรือไม่?
- [ ] ถ้าใช่ → หลัง success เรียก `invalidateDataCaches(result.env)` แล้วหรือยัง?
- [ ] ส่ง `result.env` (จาก `getDbAndUser`) ไม่ใช่ omit

---

## Optional array จาก API (ป้องกัน crash ตอน .map)

เมื่อใช้ array จาก API (เช่น `data?.wallets`, `data?.items`) ในฝั่ง frontend:

- **แบบที่ 1:** `(data?.wallets ?? []).map((w) => ...)` — ใช้ได้ทุกที่
- **แบบที่ 2:** ใช้ helper `safeArray(data?.wallets).map((w) => ...)` จาก `lib/utils.ts` (ฟังก์ชัน `safeArray`)

ทั้งสองแบบกันกรณี `data` หรือ `data.wallets` เป็น `undefined` ไม่ให้เกิด `undefined.map is not a function`

---

## อ้างอิง

- ฟังก์ชัน: `lib/d1-cache.ts` → `invalidateDataCaches(env?: Env)`
- JSDoc ในไฟล์เดียวกันมีรายการ route อยู่แล้ว
- Helper: `lib/utils.ts` → `safeArray(arr)`
