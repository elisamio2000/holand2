'use client';

import cn from '@core/utils/class-names';
import { useEffect, useRef, useState } from 'react';
import { PiDiceFiveBold } from 'react-icons/pi';
import { Text } from 'rizzui';
import { useTranslation } from 'react-i18next';
import {
  DICEBEAR_RANDOM,
  humanizeEnumValue,
  type DiceBearFieldDefinition,
} from '@/utils/dicebear/dicebear-schema-utils';
import type { DiceBearStyleKey } from '@/utils/dicebear/dicebear-registry';
import { renderOptionPreview } from '@/utils/dicebear/dicebear-avatar-url';

interface AvatarVisualOptionGridProps {
  field: DiceBearFieldDefinition;
  styleKey: DiceBearStyleKey;
  fieldValues: Record<string, unknown>;
  fields: DiceBearFieldDefinition[];
  value: unknown;
  onChange: (next: unknown) => void;
}

function LazyPreviewTile({
  src,
  alt,
  label,
  selected,
  onClick,
}: {
  src?: string;
  alt: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '80px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <button
      ref={ref}
      type="button"
      title={label}
      onClick={onClick}
      className={cn(
        'flex w-[72px] shrink-0 flex-col items-center gap-1 rounded-xl border p-1.5 transition hover:border-primary/40',
        selected
          ? 'border-primary bg-primary/5 ring-2 ring-primary/25'
          : 'border-gray-200 bg-white dark:border-gray-300 dark:bg-gray-0'
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gray-50">
        {visible && src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full animate-pulse rounded-full bg-gray-100" />
        )}
      </div>
      <span className="line-clamp-2 w-full text-center text-[10px] font-medium leading-tight text-gray-600">
        {label}
      </span>
    </button>
  );
}

export default function AvatarVisualOptionGrid({
  field,
  styleKey,
  fieldValues,
  fields,
  value,
  onChange,
}: AvatarVisualOptionGridProps) {
  const { t } = useTranslation();
  const current = String(value ?? DICEBEAR_RANDOM);

  if (!field.enumValues?.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-1 pt-0.5">
        <button
          type="button"
          title={t('account.avatarBuilder.randomOption')}
          onClick={() => onChange(DICEBEAR_RANDOM)}
          className={cn(
            'flex w-[72px] shrink-0 flex-col items-center gap-1 rounded-xl border p-1.5 transition',
            current === DICEBEAR_RANDOM
              ? 'border-primary bg-primary/5 ring-2 ring-primary/25'
              : 'border-gray-200 bg-white hover:border-primary/40 dark:border-gray-300 dark:bg-gray-0'
          )}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <PiDiceFiveBold className="h-6 w-6 text-gray-500" />
          </div>
          <span className="text-center text-[10px] font-medium text-gray-600">
            {t('account.avatarBuilder.randomOption')}
          </span>
        </button>

        {field.enumValues.map((enumValue) => {
          const label = humanizeEnumValue(enumValue);
          const preview = renderOptionPreview(
            styleKey,
            fieldValues,
            fields,
            field.key,
            enumValue
          );

          return (
            <LazyPreviewTile
              key={enumValue}
              src={preview}
              alt={label}
              label={label}
              selected={current === enumValue}
              onClick={() => onChange(enumValue)}
            />
          );
        })}
      </div>
      {current !== DICEBEAR_RANDOM ? (
        <Text className="text-xs text-gray-500">
          {t('account.avatarBuilder.selectedOption', {
            value: humanizeEnumValue(current),
          })}
        </Text>
      ) : null}
    </div>
  );
}
