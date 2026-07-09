'use client';

import { Tooltip } from '@/components/tooltip';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, Popover, Text, Title } from 'rizzui';
import {
  PiArchiveBold,
  PiTrashBold,
  PiPhoneBold,
  PiVideoCameraBold,
  PiChecks,
  PiDotsThreeVerticalBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { useMedia } from '@core/hooks/use-media';
import PresenceBadge, { mockPresenceFromUserId } from './components/presence-badge';
import type { MessageDetail } from '@/types/messages.types';

type PeopleThreadHeaderProps = {
  message: MessageDetail;
  partnerId?: string;
  onArchive: () => void;
  onDelete: () => void;
  onVoiceCall?: () => void;
  onVideoCall?: () => void;
  onToggleSelectionMode?: () => void;
  selectionMode?: boolean;
  busy?: boolean;
  searchSlot?: ReactNode;
};

type ActionItem = {
  key: string;
  icon: ReactNode;
  label: string;
  danger?: boolean;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export default function PeopleThreadHeader({
  message,
  partnerId,
  onArchive,
  onDelete,
  onVoiceCall,
  onVideoCall,
  onToggleSelectionMode,
  selectionMode,
  busy,
  searchSlot,
}: PeopleThreadHeaderProps) {
  const { t } = useTranslation();
  const partner = message.from.id === partnerId ? message.from : message.to;
  const presence = mockPresenceFromUserId(partner.id);
  const isCompact = useMedia('(max-width: 767px)', false);
  const [menuOpen, setMenuOpen] = useState(false);

  const iconBtn = (active?: boolean, danger?: boolean) =>
    cn(
      'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
      danger
        ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
        : active
        ? 'bg-primary/10 text-primary dark:bg-primary/20'
        : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20'
    );

  const actions: ActionItem[] = [
    onToggleSelectionMode && {
      key: 'select',
      icon: <PiChecks className="h-4 w-4" />,
      label: t('messages.bulk.toggle'),
      active: selectionMode,
      disabled: busy,
      onClick: () => { onToggleSelectionMode(); setMenuOpen(false); },
    },
    onVoiceCall && {
      key: 'voice',
      icon: <PiPhoneBold className="h-4 w-4" />,
      label: t('messages.call.voice', 'Voice call'),
      disabled: busy,
      onClick: () => { onVoiceCall(); setMenuOpen(false); },
    },
    onVideoCall && {
      key: 'video',
      icon: <PiVideoCameraBold className="h-4 w-4" />,
      label: t('messages.call.video', 'Video call'),
      disabled: busy,
      onClick: () => { onVideoCall(); setMenuOpen(false); },
    },
    {
      key: 'archive',
      icon: <PiArchiveBold className="h-4 w-4" />,
      label: t('messages.actions.archive', 'Archive'),
      disabled: busy,
      onClick: () => { onArchive(); setMenuOpen(false); },
    },
    {
      key: 'delete',
      icon: <PiTrashBold className="h-4 w-4" />,
      label: t('messages.actions.delete', 'Delete'),
      danger: true,
      disabled: busy,
      onClick: () => { onDelete(); setMenuOpen(false); },
    },
  ].filter(Boolean) as ActionItem[];

  return (
    <div className="border-b border-muted bg-gray-0 px-4 py-2.5 dark:bg-gray-50 sm:px-5 sm:py-3">
      <div className="flex items-center justify-between gap-2">
        {/* ── Identity ─────────────────────────────────────── */}
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative shrink-0">
            <Avatar name={partner.name} src={partner.avatar} size="md" />
            <PresenceBadge status={presence} size="md" className="bottom-0 end-0" />
          </div>
          <div className="min-w-0">
            <Title
              as="h3"
              className="truncate text-sm font-semibold text-gray-900 sm:text-base dark:text-gray-100"
            >
              {partner.name}
            </Title>
            <Text className="text-xs text-gray-500">
              {t(`messages.lens.people.presence.${presence}`)}
            </Text>
          </div>
        </div>

        {/* ── Right side ───────────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Search slot — always visible */}
          {searchSlot && (
            <div className="hidden sm:block">{searchSlot}</div>
          )}

          {isCompact ? (
            /* Small screens: collapse all actions into ⋯ menu */
            <Popover
              isOpen={menuOpen}
              setIsOpen={setMenuOpen}
              shadow="md"
              placement="bottom-end"
            >
              <Popover.Trigger>
                <button
                  type="button"
                  aria-label={t('messages.moreActions', 'More actions')}
                  className={iconBtn()}
                >
                  <PiDotsThreeVerticalBold className="h-4 w-4" />
                </button>
              </Popover.Trigger>
              <Popover.Content className="z-[9999] min-w-[10rem] p-1 dark:bg-gray-100 [&>svg]:hidden">
                {/* Search slot inside menu on very small */}
                {searchSlot && (
                  <div className="mb-1 px-1 sm:hidden">{searchSlot}</div>
                )}
                {actions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    disabled={action.disabled}
                    onClick={action.onClick}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                      action.disabled
                        ? 'cursor-not-allowed text-gray-300 dark:text-gray-600'
                        : action.danger
                        ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
                        : action.active
                        ? 'bg-primary/10 text-primary dark:bg-primary/20'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20'
                    )}
                  >
                    {action.icon}
                    <span>{action.label}</span>
                  </button>
                ))}
              </Popover.Content>
            </Popover>
          ) : (
            /* Large screens: inline action buttons */
            <div className="flex items-center gap-1">
              {actions.map((action) => (
                <Tooltip key={action.key} content={action.label} placement="bottom">
                  <button
                    type="button"
                    disabled={action.disabled}
                    onClick={action.onClick}
                    className={iconBtn(action.active, action.danger)}
                    aria-label={action.label}
                  >
                    {action.icon}
                  </button>
                </Tooltip>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
