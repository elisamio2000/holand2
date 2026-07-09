'use client';

import { IconTooltip } from '@/components/tooltip';
import cn from '@core/utils/class-names';

import type { ReactNode } from 'react';

export interface BoardIconToolProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}

export function BoardIconTool({ icon, label, onClick, disabled, active }: BoardIconToolProps) {
  return (
    <IconTooltip content={label} preset="toolbar">
      <button
        type="button"
        disabled={disabled}
        aria-label={label}
        onClick={onClick}
        className={cn(
          'flex size-7 items-center justify-center rounded border transition-colors',
          active ? 'border-primary bg-primary/10' : 'border-muted hover:bg-muted/60',
          disabled && 'cursor-not-allowed opacity-40'
        )}
      >
        {icon}
      </button>
    </IconTooltip>
  );
}

export function BoardIconToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-1', className)}>{children}</div>;
}
