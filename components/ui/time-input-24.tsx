'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TimeInput24Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
  required?: boolean;
}

export function TimeInput24({
  value,
  onChange,
  className,
  disabled,
  id,
  required,
}: TimeInput24Props) {
  const [h, m] = value ? value.split(':') : ['', ''];
  const hour = h === '' ? '' : String(parseInt(h, 10)).padStart(2, '0');
  const min = m === '' ? '' : String(parseInt(m, 10)).padStart(2, '0');

  const handleHourChange = (v: string) => {
    if (v === '') onChange('');
    else {
      const n = Math.min(23, Math.max(0, parseInt(v, 10) || 0));
      onChange(`${String(n).padStart(2, '0')}:${min || '00'}`);
    }
  };

  const handleMinChange = (v: string) => {
    if (v === '') onChange(hour ? `${hour}:00` : '');
    else {
      const n = Math.min(59, Math.max(0, parseInt(v, 10) || 0));
      onChange(`${hour || '00'}:${String(n).padStart(2, '0')}`);
    }
  };

  return (
    <>
      {required && (
        <input
          type="hidden"
          value={value}
          required
          tabIndex={-1}
          aria-hidden
        />
      )}
      <div
        className={cn(
        'flex items-center gap-1 rounded-md border border-[#1F2937] bg-[#0F172A] px-3 py-2',
        disabled && 'opacity-50',
        className
      )}
    >
      <input
        id={id}
        type="number"
        min={0}
        max={23}
        placeholder="00"
        value={hour}
        onChange={(e) => handleHourChange(e.target.value)}
        disabled={disabled}
        className="w-9 appearance-none bg-transparent text-center text-sm text-[#E5E7EB] [appearance:textfield] placeholder:text-[#9CA3AF] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span className="text-[#9CA3AF]">:</span>
      <input
        type="number"
        min={0}
        max={59}
        placeholder="00"
        value={min}
        onChange={(e) => handleMinChange(e.target.value)}
        disabled={disabled}
        className="w-9 appearance-none bg-transparent text-center text-sm text-[#E5E7EB] [appearance:textfield] placeholder:text-[#9CA3AF] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </div>
    </>
  );
}
