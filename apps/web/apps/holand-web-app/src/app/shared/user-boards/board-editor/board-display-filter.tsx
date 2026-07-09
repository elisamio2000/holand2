'use client';

import { Tooltip } from '@/components/tooltip';
import { useTranslation } from 'react-i18next';
import { ActionIcon, Checkbox, Popover, Text } from 'rizzui';
import type { BoardNodeRole } from '../lib/board-types';
import { PALETTE_ROLES } from './board-type-palette';
import { PiFunnel } from 'react-icons/pi';

export interface BoardDisplayFilterProps {
  hiddenRoles: BoardNodeRole[];
  onChange: (hidden: BoardNodeRole[]) => void;
}

export function BoardDisplayFilter({ hiddenRoles, onChange }: BoardDisplayFilterProps) {
  const { t } = useTranslation();
  const hiddenSet = new Set(hiddenRoles);

  const toggle = (role: BoardNodeRole) => {
    const next = new Set(hiddenSet);
    if (next.has(role)) next.delete(role);
    else next.add(role);
    onChange([...next]);
  };

  return (
    <Popover>
      <Popover.Trigger>
        <Tooltip content={t('boards.filter.nodeRoles', 'Show node roles')} placement="bottom">
          <ActionIcon variant="outline" size="sm" className="relative" aria-label={t('boards.filter.title', 'Filter')}>
            <PiFunnel className="size-4" />
            {hiddenRoles.length ? (
              <span className="absolute -end-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[8px] text-white">
                {hiddenRoles.length}
              </span>
            ) : null}
          </ActionIcon>
        </Tooltip>
      </Popover.Trigger>
      <Popover.Content className="z-50 w-52 p-3">
        <Text className="mb-2 text-xs font-medium text-gray-600">
          {t('boards.filter.nodeRoles', 'Show node roles')}
        </Text>
        <div className="flex flex-col gap-2">
          {PALETTE_ROLES.map(({ role, labelKey, color }) => (
            <Checkbox
              key={role}
              label={t(labelKey, role)}
              checked={!hiddenSet.has(role)}
              onChange={() => toggle(role)}
              color="primary"
              className="text-xs"
              labelClassName="flex items-center gap-2"
            />
          ))}
        </div>
      </Popover.Content>
    </Popover>
  );
}
