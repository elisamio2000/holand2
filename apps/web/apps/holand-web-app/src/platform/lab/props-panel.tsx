'use client';

import cn from '@core/utils/class-names';

export interface PropsPanelField<T extends string = string> {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

export interface PropsPanelToggle {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

interface PropsPanelProps {
  title?: string;
  fields?: PropsPanelField[];
  toggles?: PropsPanelToggle[];
  className?: string;
}

export function PropsPanel({
  title = 'Live props',
  fields = [],
  toggles = [],
  className,
}: PropsPanelProps) {
  if (fields.length === 0 && toggles.length === 0) return null;

  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 dark:bg-primary/10',
        className
      )}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">{title}</p>
      <div className="flex flex-wrap gap-3">
        {fields.map((field) => (
          <label key={field.id} className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-300">
            <span className="font-medium">{field.label}</span>
            <select
              value={field.value}
              onChange={(e) => field.onChange(e.target.value as typeof field.value)}
              className="rounded border border-muted bg-gray-0 px-2 py-1 text-xs dark:bg-gray-50"
            >
              {field.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        {toggles.map((toggle) => (
          <label
            key={toggle.id}
            className="flex cursor-pointer items-center gap-2 text-xs text-gray-600 dark:text-gray-300"
          >
            <input
              type="checkbox"
              checked={toggle.checked}
              onChange={(e) => toggle.onChange(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>{toggle.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
