'use client';

import cn from '@core/utils/class-names';

const ROLE_STYLES: Record<string, string> = {
  owner: 'text-amber-600 dark:text-amber-500',
  admin: 'text-violet-600 dark:text-violet-400',
  analyst: 'text-sky-600 dark:text-sky-400',
  member: 'text-gray-500',
  viewer: 'text-gray-400',
};

interface WorkspaceRoleBadgeProps {
  role?: string | null;
  className?: string;
}

/**
 * Subtle role indicator — dot + label, aligned with app typography (not rizzui Badge).
 */
export default function WorkspaceRoleBadge({ role, className }: WorkspaceRoleBadgeProps) {
  if (!role) return null;

  const normalized = role.toLowerCase();
  const colorClass = ROLE_STYLES[normalized] ?? ROLE_STYLES.member;
  const label = role.replace(/_/g, ' ');

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 truncate text-[10px] font-medium capitalize leading-none',
        colorClass,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70')} />
      <span className="truncate">{label}</span>
    </span>
  );
}
