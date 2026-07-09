'use client';

import type { ReactNode } from 'react';
import { Text } from 'rizzui';
import cn from '@core/utils/class-names';
import { BoardIconTool, BoardIconToolbar } from './board-icon-toolbar';

export interface IconChoiceOption<T extends string> {
  value: T;
  label: string;
  icon: ReactNode;
}

export interface IconChoiceFieldProps<T extends string> {
  label?: string;
  value: T;
  options: IconChoiceOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}

/** Icon toolbar for enum-like inspector choices (stroke, route, arrows, …). */
export function IconChoiceField<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  className,
}: IconChoiceFieldProps<T>) {
  return (
    <div className={cn('space-y-1', className)}>
      {label ? <Text className="text-xs text-gray-500">{label}</Text> : null}
      <BoardIconToolbar>
        {options.map((opt) => (
          <BoardIconTool
            key={opt.value}
            icon={opt.icon}
            label={opt.label}
            active={value === opt.value}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
          />
        ))}
      </BoardIconToolbar>
    </div>
  );
}
