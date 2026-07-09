'use client';

import { Tooltip } from '@/components/tooltip';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionIcon, Drawer, Popover, Text, Title } from 'rizzui';
import { PiKeyboard } from 'react-icons/pi';
import { COMMAND_DEFS } from '../lib/shortcuts/registry';
import { formatBindings } from '../lib/shortcuts/format';

const CATEGORY_ORDER = ['tools', 'edit', 'view', 'history', 'system'] as const;

export function ShortcutsHelpContent() {
  const { t } = useTranslation();

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: COMMAND_DEFS.filter((c) => c.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="max-h-80 space-y-3 overflow-y-auto">
      {grouped.map(({ cat, items }) => (
        <div key={cat}>
          <Text className="mb-1 text-[10px] font-semibold uppercase text-gray-500">
            {t(`boards.shortcuts.${cat}`, cat)}
          </Text>
          <ul className="space-y-1">
            {items.map((cmd) => (
              <li key={cmd.id} className="flex items-center justify-between gap-2 text-xs">
                <span>{cmd.label}</span>
                <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                  {formatBindings(cmd.defaults)}
                </kbd>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function ShortcutsHelpPanel({ className }: { className?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Popover isOpen={open} setIsOpen={setOpen} placement="bottom-end">
      <Popover.Trigger>
        <Tooltip content={t('boards.shortcuts.title', 'Keyboard shortcuts')} placement="bottom">
          <ActionIcon
            variant="outline"
            size="sm"
            className={className}
            aria-label={t('boards.shortcuts.title', 'Keyboard shortcuts')}
          >
            <PiKeyboard className="size-4" />
          </ActionIcon>
        </Tooltip>
      </Popover.Trigger>
      <Popover.Content className="z-50 w-72 p-3">
        <Title as="h6" className="mb-2 text-sm">
          {t('boards.shortcuts.title', 'Keyboard shortcuts')}
        </Title>
        <ShortcutsHelpContent />
      </Popover.Content>
    </Popover>
  );
}

export function ShortcutsHelpDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Drawer isOpen={open} onClose={onClose} placement="bottom" size="md">
      <div className="p-4">
        <Title as="h6" className="mb-3 text-sm">
          {t('boards.shortcuts.title', 'Keyboard shortcuts')}
        </Title>
        <ShortcutsHelpContent />
      </div>
    </Drawer>
  );
}