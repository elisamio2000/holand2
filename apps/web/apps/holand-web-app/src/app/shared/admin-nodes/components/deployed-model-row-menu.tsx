'use client';

import { useMemo, useState } from 'react';
import { ActionIcon, Button, Popover, Text } from 'rizzui';
import { PiDotsThreeVerticalBold } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import type { DeployedRowActionKind } from '@/services/admin-remote-nodes.service';

interface DeployedModelRowMenuProps {
  actions: DeployedRowActionKind[];
  disabled?: boolean;
  onAction: (kind: DeployedRowActionKind) => void;
}

export default function DeployedModelRowMenu({
  actions,
  disabled = false,
  onAction,
}: DeployedModelRowMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const labelFor = useMemo(
    () =>
      (kind: DeployedRowActionKind): string => {
        switch (kind) {
          case 'stop':
            return t('adminNodes.stop');
          case 'restart':
            return t('adminNodes.restart');
          case 'remove':
            return t('adminNodes.removeModel');
          case 'logs':
            return t('adminNodes.modelLogs');
          case 'probe':
            return t('adminNodes.probeModel');
          default:
            return kind;
        }
      },
    [t]
  );

  const isDanger = (kind: DeployedRowActionKind) =>
    kind === 'stop' || kind === 'remove';

  if (!actions.length) return null;

  return (
    <Popover isOpen={open} setIsOpen={setOpen} shadow="sm" placement="bottom-end">
      <Popover.Trigger>
        <ActionIcon
          size="sm"
          variant="outline"
          disabled={disabled}
          aria-label={t('adminNodes.modelActions')}
        >
          <PiDotsThreeVerticalBold className="h-4 w-4" />
        </ActionIcon>
      </Popover.Trigger>
      <Popover.Content className="z-50 w-44 p-1">
        <div className="flex flex-col gap-0.5">
          {actions.map((kind) => (
            <Button
              key={kind}
              size="sm"
              variant="text"
              color={isDanger(kind) ? 'danger' : undefined}
              className="justify-start px-2"
              disabled={disabled}
              onClick={() => {
                setOpen(false);
                onAction(kind);
              }}
            >
              <Text className="text-sm">{labelFor(kind)}</Text>
            </Button>
          ))}
        </div>
      </Popover.Content>
    </Popover>
  );
}
