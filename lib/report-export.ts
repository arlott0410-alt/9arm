import { formatDateThailand, formatMinorToDisplay } from '@/lib/utils';

const PERIOD_TH: Record<string, string> = {
  daily: 'รายวัน',
  monthly: 'รายเดือน',
  yearly: 'รายปี',
  custom: 'กำหนดช่วงวันที่',
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** จำนวน + สกุลเงิน ให้สอดคล้องการ์ดโบนัส (เช่น 72,244 THB) */
function fmtMinorWithCurrency(minor: number, currency: string): string {
  return `${escapeHtml(formatMinorToDisplay(minor, currency))} ${escapeHtml(currency)}`;
}

export type ReportExportData = {
  period: string;
  dateFrom: string;
  dateTo: string;
  displayCurrency?: string;
  transactions: {
    deposits: number;
    withdraws: number;
    net: number;
  };
  transfers: {
    internalByCurrency: Record<string, number>;
    externalInByCurrency: Record<string, number>;
    externalOutByCurrency: Record<string, number>;
  };
  withdrawFeesByCurrency?: Record<string, number>;
};

export type BonusExportData = {
  displayCurrency: string;
  byCategory: Record<string, number>;
  total: number;
} | null;

export type CreditCutExportData = {
  displayCurrency: string;
  total: number;
} | null;

const cell = (content: string, extra = '') =>
  `<td style="border:1px solid #334155;padding:8px 10px;vertical-align:middle;${extra}">${content}</td>`;

const sectionRow = (title: string, colspan = 2) =>
  `<tr><td colspan="${colspan}" style="border:1px solid #334155;background:#0f172a;color:#d4af37;font-weight:700;padding:10px 12px;font-size:13px;">${escapeHtml(title)}</td></tr>`;

const pairRow = (label: string, value: string, valueStyle = 'text-align:right;font-weight:600;color:#0f172a;') =>
  `<tr>${cell(escapeHtml(label), 'color:#64748b;width:38%;')}${cell(value, valueStyle)}</tr>`;

const dashRow = () =>
  `<tr><td colspan="2" style="border:1px solid #334155;padding:8px 10px;text-align:center;color:#94a3b8;">—</td></tr>`;

function sortedEntries(rec: Record<string, number> | undefined, filter: (n: number) => boolean) {
  return Object.entries(rec ?? {})
    .filter(([, v]) => filter(v))
    .sort(([a], [b]) => a.localeCompare(b));
}

/** สร้าง HTML ที่ Excel / Google Sheets เปิดเป็นตารางได้ (นามสกุล .xls) */
export function buildReportSummaryHtml(opts: {
  periodKey: string;
  websiteLabel: string;
  data: ReportExportData | null;
  bonusData: BonusExportData;
  creditCutData: CreditCutExportData;
}): string {
  const { periodKey, websiteLabel, data, bonusData, creditCutData } = opts;
  const dispCur = data?.displayCurrency || 'THB';
  const periodLabel = PERIOD_TH[periodKey] ?? periodKey;
  const range =
    data?.dateFrom === data?.dateTo
      ? formatDateThailand(data?.dateFrom ?? '')
      : `${formatDateThailand(data?.dateFrom ?? '')} – ${formatDateThailand(data?.dateTo ?? '')}`;

  const rows: string[] = [];

  rows.push(
    `<tr><td colspan="2" style="border:1px solid #334155;background:#1e293b;color:#fbbf24;font-weight:700;padding:14px 14px;font-size:16px;text-align:center;">Admin — รายงานสรุป</td></tr>`
  );
  rows.push(pairRow('ช่วงเวลา', escapeHtml(periodLabel)));
  rows.push(pairRow('วันที่ / ช่วงที่เลือก', escapeHtml(range)));
  rows.push(pairRow('เว็บ', escapeHtml(websiteLabel)));
  rows.push(
    `<tr><td colspan="2" style="border:1px solid #334155;padding:4px;background:#f8fafc;"></td></tr>`
  );

  if (data) {
    rows.push(sectionRow('ธุรกรรม'));
    rows.push(
      pairRow(
        'ฝาก',
        `${escapeHtml(formatMinorToDisplay(data.transactions.deposits, dispCur))} ${escapeHtml(dispCur)}`
      )
    );
    rows.push(
      pairRow(
        'ถอน',
        `${escapeHtml(formatMinorToDisplay(data.transactions.withdraws, dispCur))} ${escapeHtml(dispCur)}`
      )
    );
    const net = data.transactions.net;
    const netLabel = net < 0 ? ' (ถอนออก)' : '';
    rows.push(
      pairRow(
        'สุทธิ',
        `${escapeHtml(formatMinorToDisplay(Math.abs(net), dispCur))} ${escapeHtml(dispCur)}${escapeHtml(netLabel)}`,
        `text-align:right;font-weight:700;color:${net >= 0 ? '#b45309' : '#b91c1c'};`
      )
    );
  }

  if (bonusData) {
    rows.push(sectionRow('โบนัส'));
    const cats = sortedEntries(bonusData.byCategory, (v) => v > 0);
    if (cats.length === 0) {
      rows.push(pairRow('แยกตามหมวดหมู่', '—'));
    } else {
      rows.push(
        `<tr><td colspan="2" style="border:1px solid #334155;padding:6px 10px;color:#64748b;font-size:11px;">แยกตามหมวดหมู่</td></tr>`
      );
      for (const [name, amt] of cats) {
        rows.push(
          pairRow(
            `  ${name}`,
            `${escapeHtml(formatMinorToDisplay(amt, bonusData.displayCurrency))} ${escapeHtml(bonusData.displayCurrency)}`
          )
        );
      }
    }
    rows.push(
      pairRow(
        'รวมโบนัส',
        `${escapeHtml(formatMinorToDisplay(bonusData.total, bonusData.displayCurrency))} ${escapeHtml(bonusData.displayCurrency)}`,
        'text-align:right;font-weight:700;color:#b45309;'
      )
    );
  }

  if (creditCutData) {
    rows.push(sectionRow('ตัดเครดิต'));
    rows.push(
      pairRow(
        'รวมตัดเครดิต',
        `${escapeHtml(formatMinorToDisplay(creditCutData.total, creditCutData.displayCurrency))} ${escapeHtml(creditCutData.displayCurrency)}`
      )
    );
  }

  if (data) {
    rows.push(sectionRow('ค่าธรรมเนียมถอน'));
    const fees = sortedEntries(data.withdrawFeesByCurrency, (v) => v > 0);
    if (fees.length === 0) {
      rows.push(pairRow('แยกตามสกุลเงิน', '—'));
    } else {
      rows.push(
        `<tr><td colspan="2" style="border:1px solid #334155;padding:6px 10px;color:#64748b;font-size:11px;">แยกตามสกุลเงิน</td></tr>`
      );
      for (const [cur, amt] of fees) {
        rows.push(pairRow(`  ${cur}`, fmtMinorWithCurrency(amt, cur)));
      }
    }

    rows.push(sectionRow('โอนเงิน'));
    const internal = sortedEntries(data.transfers.internalByCurrency, (v) => v !== 0);
    rows.push(
      `<tr><td colspan="2" style="border:1px solid #334155;padding:6px 10px;color:#64748b;font-size:11px;">รวมภายใน</td></tr>`
    );
    if (internal.length === 0) {
      rows.push(dashRow());
    } else {
      for (const [cur, amt] of internal) {
        rows.push(pairRow(`  ${cur}`, fmtMinorWithCurrency(amt, cur)));
      }
    }

    const extIn = sortedEntries(data.transfers.externalInByCurrency, (v) => v !== 0);
    rows.push(
      `<tr><td colspan="2" style="border:1px solid #334155;padding:6px 10px;color:#64748b;font-size:11px;">รวมรับจากภายนอก</td></tr>`
    );
    if (extIn.length === 0) {
      rows.push(dashRow());
    } else {
      for (const [cur, amt] of extIn) {
        rows.push(pairRow(`  ${cur}`, fmtMinorWithCurrency(amt, cur)));
      }
    }

    const extOut = sortedEntries(data.transfers.externalOutByCurrency, (v) => v !== 0);
    rows.push(
      `<tr><td colspan="2" style="border:1px solid #334155;padding:6px 10px;color:#64748b;font-size:11px;">รวมโอนออกภายนอก</td></tr>`
    );
    if (extOut.length === 0) {
      rows.push(dashRow());
    } else {
      for (const [cur, amt] of extOut) {
        rows.push(pairRow(`  ${cur}`, fmtMinorWithCurrency(amt, cur)));
      }
    }

    const allCur = Array.from(
      new Set([
        ...Object.keys(data.transfers.externalInByCurrency ?? {}),
        ...Object.keys(data.transfers.externalOutByCurrency ?? {}),
      ])
    ).sort();
    rows.push(
      `<tr><td colspan="2" style="border:1px solid #334155;padding:6px 10px;color:#64748b;font-size:11px;">สุทธิภายนอก</td></tr>`
    );
    const netItems = allCur
      .map((cur) => {
        const inAmt = data.transfers.externalInByCurrency?.[cur] ?? 0;
        const outAmt = data.transfers.externalOutByCurrency?.[cur] ?? 0;
        return { cur, net: inAmt - outAmt };
      })
      .filter((x) => x.net !== 0);
    if (netItems.length === 0) {
      rows.push(dashRow());
    } else {
      for (const { cur, net } of netItems) {
        const suffix = net < 0 ? ' (ถอนออก)' : ' (รับเข้า)';
        rows.push(
          pairRow(
            `  ${cur}`,
            `${fmtMinorWithCurrency(Math.abs(net), cur)}${escapeHtml(suffix)}`,
            `text-align:right;font-weight:600;color:${net >= 0 ? '#b45309' : '#b91c1c'};`
          )
        );
      }
    }
  }

  const table = `<table style="border-collapse:collapse;width:100%;max-width:560px;">${rows.join('')}</table>`;

  return `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/><meta name="ExcelCreated" content="Admin"/><style>body{margin:16px;background:#f1f5f9;font-family:Calibri,'Segoe UI',sans-serif;}</style></head><body>${table}<p style="color:#94a3b8;font-size:11px;margin-top:12px;">สร้างจาก Admin — นำเข้า Google Sheets: เมนู ไฟล์ → นำเข้า → อัปโหลด แล้วเลือกไฟล์นี้</p></body></html>`;
}

export function downloadReportSummaryXls(opts: Parameters<typeof buildReportSummaryHtml>[0]): void {
  const html = buildReportSummaryHtml(opts);
  const df = opts.data?.dateFrom ?? 'report';
  const dt = opts.data?.dateTo ?? df;
  const safe = (s: string) => s.replace(/[^\d-]/g, '');
  const name =
    df === dt ? `admin-รายงาน-${safe(df)}.xls` : `admin-รายงาน-${safe(df)}_${safe(dt)}.xls`;

  const blob = new Blob([`\ufeff${html}`], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
