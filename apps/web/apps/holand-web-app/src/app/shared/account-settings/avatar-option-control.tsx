'use client';

import cn from '@core/utils/class-names';
import { HexColorPicker } from 'react-colorful';
import { Input, Select, Switch, Text } from 'rizzui';
import { useTranslation } from 'react-i18next';
import {
  DICEBEAR_RANDOM,
  type DiceBearFieldDefinition,
} from '@/utils/dicebear/dicebear-schema-utils';
import type { DiceBearStyleKey } from '@/utils/dicebear/dicebear-registry';
import AvatarVisualOptionGrid from '@/app/shared/account-settings/avatar-visual-option-grid';

function normalizeHexColor(value: string): string {
  return value.replace('#', '').toLowerCase();
}

export default function AvatarOptionControl({
  field,
  styleKey,
  fieldValues,
  fields,
  value,
  onChange,
}: {
  field: DiceBearFieldDefinition;
  styleKey: DiceBearStyleKey;
  fieldValues: Record<string, unknown>;
  fields: DiceBearFieldDefinition[];
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const { t } = useTranslation();

  if (field.kind === 'seed') {
    return (
      <Input
        value={String(value ?? '')}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('account.avatarBuilder.seedPlaceholder')}
      />
    );
  }

  if (field.kind === 'boolean') {
    return (
      <Switch
        checked={Boolean(value)}
        onChange={(event) => onChange(event.target.checked)}
      />
    );
  }

  if (field.kind === 'integer' || field.kind === 'probability') {
    const min = field.min ?? 0;
    const max = field.max ?? 100;
    const numeric = Number(value ?? field.defaultValue ?? min);

    return (
      <div className="space-y-2">
        <input
          type="range"
          min={min}
          max={max}
          value={numeric}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-2 w-full cursor-pointer accent-primary"
        />
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={min}
            max={max}
            value={numeric}
            onChange={(event) => onChange(Number(event.target.value))}
            className="w-24"
          />
          <Text className="text-xs text-gray-500">
            {min} – {max}
          </Text>
        </div>
      </div>
    );
  }

  if (field.kind === 'enum' && field.enumValues?.length) {
    return (
      <AvatarVisualOptionGrid
        field={field}
        styleKey={styleKey}
        fieldValues={fieldValues}
        fields={fields}
        value={value}
        onChange={onChange}
      />
    );
  }

  if (field.kind === 'integerMulti') {
    const defaults = Array.isArray(field.defaultValue)
      ? (field.defaultValue as number[])
      : [0, 360];
    const current = Array.isArray(value) ? (value as number[]) : defaults;
    const min = field.min ?? -360;
    const max = field.max ?? 360;

    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => onChange(DICEBEAR_RANDOM)}
          className={cn(
            'rounded-md border px-2 py-1 text-xs font-medium transition',
            value === DICEBEAR_RANDOM
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-gray-200 text-gray-600 hover:border-gray-300'
          )}
        >
          {t('account.avatarBuilder.randomOption')}
        </button>
        {value !== DICEBEAR_RANDOM ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((index) => (
              <div key={index} className="space-y-2">
                <Text className="text-xs text-gray-500">
                  {index === 0
                    ? t('account.avatarBuilder.rangeStart')
                    : t('account.avatarBuilder.rangeEnd')}
                </Text>
                <Input
                  type="number"
                  min={min}
                  max={max}
                  value={current[index] ?? defaults[index]}
                  onChange={(event) => {
                    const next = [...current];
                    next[index] = Number(event.target.value);
                    onChange(next);
                  }}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (field.kind === 'colorMulti') {
    const presetColors = Array.isArray(field.defaultValue)
      ? (field.defaultValue as string[])
      : ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf'];
    const current = normalizeHexColor(String(value ?? presetColors[0] ?? 'b6e3f4'));

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange(DICEBEAR_RANDOM)}
            className={cn(
              'rounded-md border px-2 py-1 text-xs font-medium transition',
              value === DICEBEAR_RANDOM
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            )}
          >
            {t('account.avatarBuilder.randomOption')}
          </button>
          {presetColors.map((color) => {
            const normalized = normalizeHexColor(color);
            return (
              <button
                key={normalized}
                type="button"
                title={`#${normalized}`}
                onClick={() => onChange(normalized)}
                className={cn(
                  'h-8 w-8 rounded-full border-2 transition',
                  current === normalized && value !== DICEBEAR_RANDOM
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-white shadow-sm'
                )}
                style={{ backgroundColor: `#${normalized}` }}
              />
            );
          })}
        </div>
        {value !== DICEBEAR_RANDOM ? (
          <div className="max-w-[220px]">
            <HexColorPicker
              color={`#${current}`}
              onChange={(hex) => onChange(normalizeHexColor(hex))}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}
