'use client';

import { useEffect, useState } from 'react';
import cn from '@core/utils/class-names';

export interface CompactNumFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  className?: string;
  /** inline = label left; stacked = label above (grid cells) */
  layout?: 'inline' | 'stacked';
  /** Decimal places when not editing; full value on hover via title */
  decimals?: number;
  inputWidth?: string;
}

function formatDisplay(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(decimals);
}

/** Compact number input — centered text, underline only on focus. */
export function CompactNumField({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
  className,
  layout = 'inline',
  decimals = 1,
  inputWidth,
}: CompactNumFieldProps) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!focused) setDraft('');
  }, [value, focused]);

  const display = focused ? draft : formatDisplay(value, decimals);
  const fullTitle = Number.isFinite(value) ? String(value) : undefined;
  const widthClass =
    inputWidth ?? (layout === 'stacked' ? 'w-full' : 'board-compact-value-slot');

  const inputEl = (
    <div className={cn('board-field-group group flex flex-col items-stretch', widthClass)}>
      <div className="flex items-baseline justify-center gap-0.5">
        <input
          type="text"
          inputMode="decimal"
          value={display}
          title={fullTitle}
          step={step}
          min={min}
          max={max}
          onFocus={() => {
            setFocused(true);
            setDraft(Number.isFinite(value) ? String(value) : '');
          }}
          onBlur={() => {
            setFocused(false);
            const parsed = parseFloat(draft);
            if (Number.isFinite(parsed)) onChange(parsed);
          }}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            const parsed = parseFloat(raw);
            if (Number.isFinite(parsed)) onChange(parsed);
          }}
          className={cn('board-field-input', !focused && 'truncate')}
          aria-label={label}
        />
        {suffix ? <span className="shrink-0 text-[10px] text-gray-400">{suffix}</span> : null}
      </div>
      <span className="board-field-underline" aria-hidden />
    </div>
  );

  if (layout === 'stacked') {
    return (
      <label className={cn('flex flex-col gap-0.5', className)}>
        <span className="text-center text-[10px] text-gray-500">{label}</span>
        {inputEl}
      </label>
    );
  }

  return (
    <label className={cn('flex items-center justify-between gap-3', className)}>
      <span className="shrink-0 text-xs text-gray-500">{label}</span>
      {inputEl}
    </label>
  );
}
