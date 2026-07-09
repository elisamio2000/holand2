'use client';

import cn from '@core/utils/class-names';
import { useMemo, useState } from 'react';
import { PiMagnifyingGlassBold, PiXBold } from 'react-icons/pi';
import { Button, Input, Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { useModal } from '@/app/shared/modal-views/use-modal';
import {
  DICEBEAR_STYLE_KEYS,
  getDiceBearStyleTitle,
  type DiceBearStyleKey,
} from '@/utils/dicebear/dicebear-registry';
import { createStylePreviewDataUri } from '@/utils/dicebear/dicebear-avatar-url';

interface AvatarStylePickerModalProps {
  currentStyle: DiceBearStyleKey;
  seed: string;
  onSelect: (styleKey: DiceBearStyleKey) => void;
}

export default function AvatarStylePickerModal({
  currentStyle,
  seed,
  onSelect,
}: AvatarStylePickerModalProps) {
  const { t } = useTranslation();
  const { closeModal } = useModal();
  const [query, setQuery] = useState('');

  const styles = useMemo(
    () =>
      DICEBEAR_STYLE_KEYS.map((key) => ({
        key,
        title: getDiceBearStyleTitle(key),
        preview: createStylePreviewDataUri(key, seed, 56),
      })),
    [seed]
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return styles;
    return styles.filter(
      (item) =>
        item.title.toLowerCase().includes(normalized) ||
        item.key.toLowerCase().includes(normalized)
    );
  }, [query, styles]);

  return (
    <div className="flex max-h-[80vh] flex-col p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <Title as="h3" className="text-lg font-semibold">
            {t('account.avatarBuilder.changeStyle')}
          </Title>
          <Text className="mt-1 text-sm text-gray-500">
            {t('account.avatarBuilder.changeStyleDesc')}
          </Text>
        </div>
        <button
          type="button"
          onClick={closeModal}
          className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
          aria-label={t('common.close')}
        >
          <PiXBold className="h-5 w-5" />
        </button>
      </div>

      <Input
        prefix={<PiMagnifyingGlassBold className="h-4 w-4 text-gray-400" />}
        placeholder={t('account.avatarBuilder.searchStyle')}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="mb-4"
      />

      <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
        {filtered.map(({ key, title, preview }) => (
          <button
            key={key}
            type="button"
            title={title}
            onClick={() => {
              onSelect(key);
              closeModal();
            }}
            className={cn(
              'flex flex-col items-center gap-1 rounded-xl border p-2 transition hover:border-primary/50',
              currentStyle === key
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'border-gray-200 bg-white dark:border-gray-300 dark:bg-gray-0'
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt={title} className="h-12 w-12 rounded-full" />
            <span className="line-clamp-2 text-center text-[10px] font-medium leading-tight text-gray-600">
              {title}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Text className="py-8 text-center text-sm text-gray-500">
          {t('account.avatarBuilder.noStyleResults')}
        </Text>
      ) : null}

      <div className="mt-4 flex justify-end">
        <Button variant="outline" onClick={closeModal}>
          {t('account.profileSettings.cancelBtn')}
        </Button>
      </div>
    </div>
  );
}

export function useAvatarStylePicker() {
  const { openModal } = useModal();

  return (props: AvatarStylePickerModalProps) => {
    openModal({
      view: <AvatarStylePickerModal {...props} />,
      size: 'lg',
      customSize: '720px',
    });
  };
}
