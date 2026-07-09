'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';

export type UserPresenceStatus = 'online' | 'away' | 'busy' | 'offline';

export const STATUS_CONFIG: Record<
  UserPresenceStatus,
  { dot: string; label: string; i18nKey: string }
> = {
  online: { dot: 'bg-green-500', label: 'Online', i18nKey: 'messages.status.online' },
  away:   { dot: 'bg-amber-400', label: 'Away',   i18nKey: 'messages.status.away' },
  busy:   { dot: 'bg-red-500',   label: 'Busy',   i18nKey: 'messages.status.busy' },
  offline:{ dot: 'bg-gray-400',  label: 'Offline',i18nKey: 'messages.status.offline' },
};

/** Small coloured dot showing presence status. */
export function PresenceDot({
  status,
  className,
}: {
  status: UserPresenceStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-gray-50',
        STATUS_CONFIG[status].dot,
        className
      )}
      title={STATUS_CONFIG[status].label}
      aria-label={STATUS_CONFIG[status].label}
    />
  );
}

type UserStatusPickerProps = {
  status: UserPresenceStatus;
  onChange: (status: UserPresenceStatus) => void;
  /** Render as a small dot-only trigger (for avatar overlays) */
  compact?: boolean;
  className?: string;
};

/**
 * User status picker — shows current status dot and opens a dropdown
 * to switch between Online / Away / Busy / Offline.
 */
export default function UserStatusPicker({
  status,
  onChange,
  compact = false,
  className,
}: UserStatusPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const cfg = STATUS_CONFIG[status];

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuW = 160;
    let left = rect.left;
    if (left + menuW > window.innerWidth - 8) left = rect.right - menuW;
    setMenuPos({ top: rect.bottom + 4, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const menu = open && menuPos ? (
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: menuPos.top, left: menuPos.left }}
      className="z-[10200] min-w-[160px] overflow-hidden rounded-lg border border-muted bg-gray-0 py-1 shadow-xl dark:bg-gray-50"
    >
      {(Object.keys(STATUS_CONFIG) as UserPresenceStatus[]).map((s) => {
        const c = STATUS_CONFIG[s];
        return (
          <button
            key={s}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onChange(s);
              setOpen(false);
            }}
            className={cn(
              'flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-200/20',
              s === status ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'
            )}
          >
            <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', c.dot)} />
            {t(c.i18nKey, c.label)}
            {s === status && (
              <span className="ms-auto text-xs text-primary">✓</span>
            )}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('messages.status.change', 'Change status')}
        aria-expanded={open}
        className={cn(
          'flex items-center gap-1.5 rounded-full transition-colors',
          compact
            ? 'p-0'
            : 'border border-muted bg-gray-0 px-2 py-1 hover:bg-gray-100 dark:bg-gray-50 dark:hover:bg-gray-100/30',
          className
        )}
      >
        <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', cfg.dot)} />
        {!compact && (
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {t(cfg.i18nKey, cfg.label)}
          </span>
        )}
      </button>
      {typeof document !== 'undefined' && menu && createPortal(menu, document.body)}
    </>
  );
}
