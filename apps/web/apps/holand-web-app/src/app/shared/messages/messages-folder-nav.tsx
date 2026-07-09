'use client';

import { Tooltip } from '@/components/tooltip';
import { useTranslation } from 'react-i18next';
import {
  PiTrayBold,
  PiPaperPlaneTiltBold,
  PiNotePencilBold,
  PiArchiveBold,
  PiTrashBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';

import type { MessageFolder } from '@/types/messages.types';

const ALL_FOLDERS: { key: MessageFolder; icon: typeof PiTrayBold }[] = [
  { key: 'inbox',    icon: PiTrayBold },
  { key: 'sent',     icon: PiPaperPlaneTiltBold },
  { key: 'drafts',   icon: PiNotePencilBold },
  { key: 'archived', icon: PiArchiveBold },
  { key: 'trash',    icon: PiTrashBold },
];

type MessagesFolderNavProps = {
  folder: MessageFolder;
  unreadCount: number;
  onFolderSelect: (folder: MessageFolder) => void;
  className?: string;
};

export default function MessagesFolderNav({
  folder,
  unreadCount,
  onFolderSelect,
  className,
}: MessagesFolderNavProps) {
  const { t } = useTranslation();

  const btnBase =
    'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/20 dark:hover:text-gray-300';
  const btnActive = 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary dark:bg-primary/15';

  return (
    <div className={cn('flex w-full items-center justify-between', className)}>
      {ALL_FOLDERS.map((f) => {
        const Icon = f.icon;
        const active = folder === f.key;
        const count = f.key === 'inbox' ? unreadCount : 0;
        return (
          <Tooltip key={f.key} content={t(`messages.folders.${f.key}`)} placement="bottom">
            <button
              type="button"
              onClick={() => onFolderSelect(f.key)}
              className={cn(btnBase, active && btnActive)}
              aria-label={t(`messages.folders.${f.key}`)}
              aria-current={active ? 'true' : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {count > 0 && (
                <span className="absolute -end-0.5 -top-0.5 flex h-3.5 min-w-3.5 shrink-0 items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold leading-none text-white">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
