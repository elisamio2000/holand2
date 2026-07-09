'use client';

import { useMemo, useState } from 'react';
import { ActionIcon, Button, Popover, Text } from 'rizzui';
import { PiDotsThreeVerticalBold } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';

export type NodeHeaderActionKind =
  | 'edit'
  | 'deploy'
  | 'viewOnBoard'
  | 'viewPoolOnBoard'
  | 'drain'
  | 'delete';

interface NodeHeaderMenuProps {
  showPoolOnBoard?: boolean;
  nodeOnline?: boolean;
  onAction: (kind: NodeHeaderActionKind) => void;
}

export default function NodeHeaderMenu({
  showPoolOnBoard,
  nodeOnline = true,
  onAction,
}: NodeHeaderMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const actions = useMemo(() => {
    const list: NodeHeaderActionKind[] = ['edit', 'deploy', 'viewOnBoard'];
    if (showPoolOnBoard) list.push('viewPoolOnBoard');
    list.push('drain', 'delete');
    return list;
  }, [showPoolOnBoard]);

  const labelFor = (kind: NodeHeaderActionKind): string => {
    switch (kind) {
      case 'edit':
        return t('adminNodes.edit');
      case 'deploy':
        return t('adminNodes.deploy');
      case 'viewOnBoard':
        return t('adminNodes.viewOnBoard');
      case 'viewPoolOnBoard':
        return t('adminNodes.viewPoolOnBoard');
      case 'drain':
        return t('adminNodes.drainLabel');
      case 'delete':
        return t('common.delete');
      default:
        return kind;
    }
  };

  const isDanger = (kind: NodeHeaderActionKind) => kind === 'drain' || kind === 'delete';

  const isDisabled = (kind: NodeHeaderActionKind) =>
    !nodeOnline && (kind === 'deploy' || kind === 'drain');

  return (
    <Popover isOpen={open} setIsOpen={setOpen} shadow="sm" placement="bottom-end">
      <Popover.Trigger>
        <ActionIcon
          size="sm"
          variant="outline"
          aria-label={t('adminNodes.nodeActions')}
        >
          <PiDotsThreeVerticalBold className="h-4 w-4" />
        </ActionIcon>
      </Popover.Trigger>
      <Popover.Content className="z-50 w-52 p-1">
        <div className="flex flex-col gap-0.5">
          {actions.map((kind) => (
            <Button
              key={kind}
              size="sm"
              variant="text"
              color={isDanger(kind) ? 'danger' : undefined}
              className="justify-start px-2"
              disabled={isDisabled(kind)}
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
