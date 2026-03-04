'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZES = [10, 20, 50] as const;

export function PaginationBar({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  const pageNumbers: (number | 'ellipsis')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    pageNumbers.push(1);
    if (page > 3) pageNumbers.push('ellipsis');
    const from = Math.max(2, page - 1);
    const to = Math.min(totalPages - 1, page + 1);
    for (let i = from; i <= to; i++) {
      if (!pageNumbers.includes(i)) pageNumbers.push(i);
    }
    if (page < totalPages - 2) pageNumbers.push('ellipsis');
    if (totalPages > 1) pageNumbers.push(totalPages);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#1F2937] pt-4">
      <div className="flex items-center gap-4">
        <span className="text-sm text-[#9CA3AF]">
          แสดง {start}–{end} จากทั้งหมด {totalCount}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#9CA3AF]">แถวต่อหน้า</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger className="h-9 w-[72px] border-[#2D3748] bg-[#0F172A] text-[#E5E7EB]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex h-9 w-9 items-center justify-center rounded border border-[#2D3748] bg-[#0F172A] text-[#9CA3AF] transition-colors disabled:opacity-40 disabled:pointer-events-none hover:bg-[#111827] hover:text-[#E5E7EB]"
          aria-label="หน้าก่อน"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pageNumbers.map((n, i) =>
          n === 'ellipsis' ? (
            <span key={`e-${i}`} className="px-2 text-[#6B7280]">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onPageChange(n)}
              className={`h-9 min-w-[36px] rounded border px-2 text-sm transition-colors ${
                page === n
                  ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-[#D4AF37]'
                  : 'border-[#2D3748] bg-[#0F172A] text-[#E5E7EB] hover:bg-[#111827]'
              }`}
            >
              {n}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex h-9 w-9 items-center justify-center rounded border border-[#2D3748] bg-[#0F172A] text-[#9CA3AF] transition-colors disabled:opacity-40 disabled:pointer-events-none hover:bg-[#111827] hover:text-[#E5E7EB]"
          aria-label="หน้าถัดไป"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
