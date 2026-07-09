'use client';

import { useState, type ReactNode } from 'react';
import { PiCaretRight } from 'react-icons/pi';

interface ContextSubmenuProps {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function ContextSubmenu({ label, icon, children }: ContextSubmenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-start text-xs hover:bg-muted"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="whitespace-nowrap">{label}</span>
        </span>
        <PiCaretRight className="size-3 shrink-0 text-gray-400" />
      </button>
      {open ? (
        <div
          className="absolute start-full top-0 z-50 min-w-[200px] rounded-md border border-muted bg-white py-1 shadow-lg dark:bg-gray-100"
          role="menu"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
