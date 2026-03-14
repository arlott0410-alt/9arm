/**
 * Payroll actions - call API routes. SUPER_ADMIN only for delete/finalize.
 */

export type PayrollActionResult =
  | { ok: true; data?: unknown }
  | { ok: false; error: string };

/** Soft delete a draft payroll run. SUPER_ADMIN only. */
export async function deletePayroll(id: number): Promise<PayrollActionResult> {
  try {
    const res = await fetch(`/api/payroll/${id}`, { method: 'DELETE' });
    const data = (await res.json()) as { error?: string; deleted?: boolean };
    if (!res.ok) {
      return { ok: false, error: data.error ?? 'ลบไม่สำเร็จ' };
    }
    return { ok: true, data };
  } catch (e) {
    console.error(e);
    return { ok: false, error: 'เกิดข้อผิดพลาด' };
  }
}

/** Finalize a draft payroll run (status → CONFIRMED). SUPER_ADMIN only. */
export async function finalizePayroll(id: number): Promise<PayrollActionResult> {
  try {
    const res = await fetch(`/api/payroll/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CONFIRMED' }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      return { ok: false, error: data.error ?? 'ยืนยันไม่สำเร็จ' };
    }
    return { ok: true, data };
  } catch (e) {
    console.error(e);
    return { ok: false, error: 'เกิดข้อผิดพลาด' };
  }
}
