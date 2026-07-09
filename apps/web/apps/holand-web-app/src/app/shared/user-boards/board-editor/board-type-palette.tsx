'use client';

import { useTranslation } from 'react-i18next';
import type { BoardNodeRole } from '../lib/board-types';
import { NODE_COLORS } from '../lib/node-role-colors';

export const PALETTE_ROLES: { role: BoardNodeRole; labelKey: string; color: string }[] = [
  { role: 'person', labelKey: 'boards.palette.person', color: NODE_COLORS.person },
  { role: 'organization', labelKey: 'boards.palette.org', color: NODE_COLORS.organization },
  { role: 'evidence', labelKey: 'boards.palette.evidence', color: NODE_COLORS.evidence },
  { role: 'topic', labelKey: 'boards.palette.topic', color: NODE_COLORS.topic },
  { role: 'question', labelKey: 'boards.palette.question', color: NODE_COLORS.question },
  { role: 'custom', labelKey: 'boards.palette.custom', color: NODE_COLORS.custom },
];

export interface BoardTypePaletteProps {
  activeRole: BoardNodeRole;
  onRoleChange: (role: BoardNodeRole) => void;
}

export function BoardTypePalette({ activeRole, onRoleChange }: BoardTypePaletteProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1 p-2">
      <span className="mb-1 px-1 text-[10px] font-medium uppercase text-gray-500">
        {t('boards.palette.title', 'Node types')}
      </span>
      {PALETTE_ROLES.map(({ role, labelKey, color }) => (
        <button
          key={role}
          type="button"
          onClick={() => onRoleChange(role)}
          className="flex items-center gap-2 rounded px-2 py-1.5 text-start text-xs hover:bg-muted/60"
          style={{
            outline: activeRole === role ? `2px solid ${color}` : undefined,
          }}
        >
          <span className="size-3 rounded-full" style={{ backgroundColor: color }} />
          {t(labelKey, role)}
        </button>
      ))}
    </div>
  );
}
