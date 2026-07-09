'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PiLinkBold } from 'react-icons/pi';
import { Button, Popover, Text } from 'rizzui';
import { routes } from '@/config/routes';
import type { EntityRef } from '@/types/messages.types';

const ENTITY_PICKER_ENABLED =
  typeof process !== 'undefined' &&
  process.env.NEXT_PUBLIC_MESSAGES_ENTITY_PICKER === 'true';

type EntityAttachPickerProps = {
  selected: EntityRef[];
  onChange: (refs: EntityRef[]) => void;
};

/** Stub entity picker — enabled via NEXT_PUBLIC_MESSAGES_ENTITY_PICKER=true */
export default function EntityAttachPicker({ selected, onChange }: EntityAttachPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (!ENTITY_PICKER_ENABLED) return null;

  const addSample = (type: EntityRef['type']) => {
    const id = `demo-${type}-${Date.now()}`;
    const ref: EntityRef = {
      type,
      id,
      label: t(`messages.entityPicker.sample.${type}`, type),
      href:
        type === 'project'
          ? routes.projects.detail(id)
          : type === 'task'
            ? routes.projects.task('demo-project', id)
            : type === 'calendar_event'
              ? routes.eventCalendar
              : undefined,
    };
    onChange([...selected, ref]);
    setOpen(false);
  };

  return (
    <Popover isOpen={open} setIsOpen={setOpen} placement="top-start">
      <Popover.Trigger>
        <button
          type="button"
          className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          title={t('messages.entityPicker.attach', 'Attach record')}
          aria-label={t('messages.entityPicker.attach', 'Attach record')}
        >
          <PiLinkBold className="h-3.5 w-3.5" />
        </button>
      </Popover.Trigger>
      <Popover.Content className="z-50 w-56 p-2">
        <Text className="mb-2 px-1 text-xs font-medium text-gray-500">
          {t('messages.entityPicker.title', 'Link a record')}
        </Text>
        <div className="flex flex-col gap-1">
          {(['task', 'project', 'calendar_event'] as const).map((type) => (
            <Button
              key={type}
              size="sm"
              variant="text"
              className="justify-start"
              onClick={() => addSample(type)}
            >
              {t(`messages.entityPicker.${type}`, type)}
            </Button>
          ))}
        </div>
        {selected.length > 0 && (
          <Text className="mt-2 px-1 text-[10px] text-gray-400">
            {t('messages.entityPicker.attached', { count: selected.length })}
          </Text>
        )}
      </Popover.Content>
    </Popover>
  );
}
