'use client';

import { useTranslation } from 'react-i18next';
import { PiTrashBold, PiPaperPlaneTiltBold, PiArchiveBold, PiXBold } from 'react-icons/pi';
import { Button, Text } from 'rizzui';

type MessageSelectionBarProps = {
  count: number;
  onDelete: () => void;
  onForward: () => void;
  onArchive: () => void;
  onClear: () => void;
};

export default function MessageSelectionBar({
  count,
  onDelete,
  onForward,
  onArchive,
  onClear,
}: MessageSelectionBarProps) {
  const { t } = useTranslation();

  if (count === 0) return null;

  return (
    <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-primary/20 bg-primary/5 px-4 py-2">
      <Text className="text-sm font-medium">{t('messages.timeline.selected', { count })}</Text>
      <Button size="sm" variant="outline" onClick={onForward} className="gap-1">
        <PiPaperPlaneTiltBold className="h-3.5 w-3.5" />
        {t('messages.forward.title')}
      </Button>
      <Button size="sm" variant="outline" onClick={onArchive} className="gap-1">
        <PiArchiveBold className="h-3.5 w-3.5" />
        {t('messages.thread.archive')}
      </Button>
      <Button size="sm" variant="outline" color="danger" onClick={onDelete} className="gap-1">
        <PiTrashBold className="h-3.5 w-3.5" />
        {t('messages.thread.delete')}
      </Button>
      <button
        type="button"
        onClick={onClear}
        className="ms-auto rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
        aria-label={t('messages.bulk.clear')}
      >
        <PiXBold className="h-4 w-4" />
      </button>
    </div>
  );
}
