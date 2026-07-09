'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionIcon, Modal, Text, Title } from 'rizzui';
import { PiX } from 'react-icons/pi';
import cn from '@core/utils/class-names';

export type MessagesCommandAction = {
  id: string;
  label: string;
  hint?: string;
  onSelect: () => void;
};

type MessagesCommandPaletteProps = {
  isOpen: boolean;
  onClose: () => void;
  actions: MessagesCommandAction[];
};

export default function MessagesCommandPalette({
  isOpen,
  onClose,
  actions,
}: MessagesCommandPaletteProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isOpen) setQuery('');
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.hint?.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q)
    );
  }, [actions, query]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <Title as="h6" className="text-sm font-semibold">
            {t('messages.commandPalette.title', 'Messages commands')}
          </Title>
          <ActionIcon size="sm" variant="text" onClick={onClose}>
            <PiX className="h-4 w-4" />
          </ActionIcon>
        </div>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('messages.commandPalette.search', 'Search commands…')}
          className="mb-3 w-full rounded-lg border border-muted bg-gray-0 px-3 py-2 text-sm outline-none focus:border-primary dark:bg-gray-50"
        />
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <Text className="px-2 py-4 text-center text-sm text-gray-500">
              {t('messages.commandPalette.empty', 'No matching commands')}
            </Text>
          ) : (
            filtered.map((action) => (
              <li key={action.id}>
                <button
                  type="button"
                  onClick={() => {
                    action.onSelect();
                    onClose();
                  }}
                  className={cn(
                    'flex w-full flex-col rounded-lg px-3 py-2 text-start transition-colors',
                    'hover:bg-gray-100 dark:hover:bg-gray-200/20'
                  )}
                >
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {action.label}
                  </span>
                  {action.hint ? (
                    <span className="text-xs text-gray-500">{action.hint}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </Modal>
  );
}
