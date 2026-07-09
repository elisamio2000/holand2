'use client';

import type { CSSProperties } from 'react';
import cn from '@core/utils/class-names';

export interface OpacityFieldProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/** Two-row opacity: label + percent on top, full-width slider below. */
export function OpacityField({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  className,
}: OpacityFieldProps) {
  const safe = clamp(value, min, max);
  const pct = Math.round(safe * 100);
  const rangePct = max === min ? '0%' : `${((safe - min) / (max - min)) * 100}%`;

  const commit = (next: number) => onChange(clamp(next, min, max));
  const commitPct = (raw: number) => commit((Number.isFinite(raw) ? raw : 0) / 100);

  const rangeStyle = { '--range-pct': rangePct } as CSSProperties;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        {label ? <span className="text-xs text-gray-500">{label}</span> : null}
        <label className="board-field-group group board-compact-value-slot flex flex-col items-stretch">
          <div className="flex items-baseline justify-center gap-px">
            <input
              type="number"
              min={Math.round(min * 100)}
              max={Math.round(max * 100)}
              value={pct}
              onChange={(e) => commitPct(Number(e.target.value))}
              onBlur={(e) => commitPct(Number(e.target.value))}
              className="board-field-input w-9"
              aria-label={label ? `${label} percent` : 'Opacity percent'}
            />
            <span className="text-[10px] text-gray-500">%</span>
          </div>
          <span className="board-field-underline" aria-hidden />
        </label>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={safe}
        style={rangeStyle}
        onChange={(e) => commit(parseFloat(e.target.value))}
        className="board-opacity-range w-full"
        aria-label={label ?? 'Opacity'}
      />
    </div>
  );
}
