/**
 * SWR default config: ลด request ซ้ำ — ไม่ revalidate ตอน focus, dedupe ใน 5 วินาที
 */
export const SWR_CONFIG = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 5_000,
  keepPreviousData: true,
} as const;
