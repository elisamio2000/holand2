'use client';

import { Tooltip } from '@/components/tooltip';
import cn from '@core/utils/class-names';
import { useEffect, useMemo, useState } from 'react';
import {
  PiArrowCounterClockwiseBold,
  PiCaretDownBold,
  PiCopyBold,
  PiDiceFiveBold,
  PiPaletteBold,
} from 'react-icons/pi';
import { Button, Input, Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import AvatarOptionControl from '@/app/shared/account-settings/avatar-option-control';
import { useAvatarStylePicker } from '@/app/shared/account-settings/avatar-style-picker-modal';
import {
  AVATAR_BUILDER_TABS,
  DICEBEAR_RANDOM,
  getFieldsByCategory,
  getDefaultFieldValues,
  getDiceBearFieldsForStyle,
  humanizeEnumValue,
  type AvatarBuilderTab,
  type DiceBearFieldDefinition,
} from '@/utils/dicebear/dicebear-schema-utils';
import {
  getDiceBearStyleTitle,
  type DiceBearStyleKey,
} from '@/utils/dicebear/dicebear-registry';
import {
  clearOptionPreviewCache,
  createDiceBearConfigFromValues,
  createStylePreviewDataUri,
  encodeDiceBearAvatarUrl,
  loadAvatarBuilderState,
  renderDiceBearFromValues,
} from '@/utils/dicebear/dicebear-avatar-url';

interface AvatarBuilderProps {
  value: string;
  onChange: (avatarUrl: string) => void;
  defaultSeed: string;
  className?: string;
}

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 12);
}

function TabFields({
  fields,
  styleKey,
  fieldValues,
  allFields,
  onFieldChange,
}: {
  fields: DiceBearFieldDefinition[];
  styleKey: DiceBearStyleKey;
  fieldValues: Record<string, unknown>;
  allFields: DiceBearFieldDefinition[];
  onFieldChange: (key: string, value: unknown) => void;
}) {
  const { t } = useTranslation();
  const [expandedKey, setExpandedKey] = useState<string | null>(fields[0]?.key ?? null);

  useEffect(() => {
    setExpandedKey(fields[0]?.key ?? null);
  }, [fields]);

  if (fields.length === 0) {
    return (
      <Text className="py-6 text-center text-sm text-gray-500">
        {t('account.avatarBuilder.emptyTab')}
      </Text>
    );
  }

  return (
    <div className="space-y-2">
      {fields.map((field) => {
        const isOpen = expandedKey === field.key;
        const rawValue = fieldValues[field.key];
        const summary =
          field.kind === 'enum' && rawValue && rawValue !== DICEBEAR_RANDOM
            ? humanizeEnumValue(String(rawValue))
            : null;

        return (
          <div
            key={field.key}
            className={cn(
              'overflow-hidden rounded-xl border transition',
              isOpen
                ? 'border-primary/30 bg-primary/[0.02]'
                : 'border-gray-200 bg-white dark:border-gray-300 dark:bg-gray-0'
            )}
          >
            <button
              type="button"
              onClick={() => setExpandedKey(isOpen ? null : field.key)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-start hover:bg-gray-50/80 dark:hover:bg-gray-50/40"
            >
              <PiCaretDownBold
                className={cn(
                  'h-4 w-4 shrink-0 text-gray-400 transition',
                  isOpen ? 'rotate-0' : '-rotate-90'
                )}
              />
              <span className="min-w-0 flex-1 text-sm font-medium text-gray-800">
                {field.label}
              </span>
              {!isOpen && summary ? (
                <span className="truncate text-xs text-gray-500">{summary}</span>
              ) : null}
            </button>
            {isOpen ? (
              <div className="border-t border-gray-100 px-3 py-3 dark:border-gray-200">
                <AvatarOptionControl
                  field={field}
                  styleKey={styleKey}
                  fieldValues={fieldValues}
                  fields={allFields}
                  value={fieldValues[field.key]}
                  onChange={(next) => onFieldChange(field.key, next)}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function IconToolButton({
  label,
  onClick,
  children,
  variant = 'outline',
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'outline' | 'text';
}) {
  return (
    <Tooltip content={label} placement="top">
      <Button
        type="button"
        variant={variant}
        size="sm"
        onClick={onClick}
        title={label}
        aria-label={label}
        className="shrink-0 px-2.5"
      >
        {children}
      </Button>
    </Tooltip>
  );
}

export default function AvatarBuilder({
  value,
  onChange,
  defaultSeed,
  className,
}: AvatarBuilderProps) {
  const { t } = useTranslation();
  const openStylePicker = useAvatarStylePicker();
  const initial = useMemo(
    () => loadAvatarBuilderState(value, defaultSeed),
    [value, defaultSeed]
  );

  const [activeTab, setActiveTab] = useState<AvatarBuilderTab>('face');
  const [styleKey, setStyleKey] = useState<DiceBearStyleKey>(initial.styleKey);
  const [fields, setFields] = useState(initial.fields);
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>(
    initial.fieldValues
  );

  useEffect(() => {
    if (!value) {
      const config = createDiceBearConfigFromValues(styleKey, fieldValues, fields);
      onChange(encodeDiceBearAvatarUrl(config));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previewUri = useMemo(
    () => renderDiceBearFromValues(styleKey, fieldValues, fields),
    [styleKey, fieldValues, fields]
  );

  const tabFields = useMemo(() => {
    const map: Record<AvatarBuilderTab, DiceBearFieldDefinition[]> = {
      style: [],
      face: getFieldsByCategory(fields, 'face'),
      hair: getFieldsByCategory(fields, 'hair'),
      outfit: getFieldsByCategory(fields, 'outfit'),
      background: getFieldsByCategory(fields, 'background'),
      advanced: getFieldsByCategory(fields, 'advanced'),
    };
    return map;
  }, [fields]);

  const visibleTabs = useMemo(
    () =>
      AVATAR_BUILDER_TABS.filter(
        (tab) => tab !== 'style' && (tab === 'advanced' || (tabFields[tab]?.length ?? 0) > 0)
      ),
    [tabFields]
  );

  const persist = (
    nextStyle: DiceBearStyleKey,
    nextValues: Record<string, unknown>,
    nextFields: DiceBearFieldDefinition[]
  ) => {
    const config = createDiceBearConfigFromValues(nextStyle, nextValues, nextFields);
    onChange(encodeDiceBearAvatarUrl(config));
  };

  const handleStyleChange = (nextStyle: DiceBearStyleKey) => {
    clearOptionPreviewCache();
    const nextFields = getDiceBearFieldsForStyle(nextStyle);
    const nextValues = {
      ...getDefaultFieldValues(nextFields, String(fieldValues.seed ?? defaultSeed)),
      seed: fieldValues.seed ?? defaultSeed,
    };
    setStyleKey(nextStyle);
    setFields(nextFields);
    setFieldValues(nextValues);
    persist(nextStyle, nextValues, nextFields);
  };

  const handleFieldChange = (key: string, nextValue: unknown) => {
    const nextValues = { ...fieldValues, [key]: nextValue };
    setFieldValues(nextValues);
    persist(styleKey, nextValues, fields);
  };

  const handleRandomize = () => {
    clearOptionPreviewCache();
    const nextSeed = randomSeed();
    const nextValues = { ...fieldValues, seed: nextSeed };
    setFieldValues(nextValues);
    persist(styleKey, nextValues, fields);
  };

  const handleResetOptions = () => {
    clearOptionPreviewCache();
    const nextValues = getDefaultFieldValues(fields, String(fieldValues.seed ?? defaultSeed));
    setFieldValues(nextValues);
    persist(styleKey, nextValues, fields);
  };

  const handleCopyPreview = async () => {
    try {
      await navigator.clipboard.writeText(previewUri);
      toast.success(t('account.avatarBuilder.copySuccess'));
    } catch {
      toast.error(t('account.avatarBuilder.copyError'));
    }
  };

  const stylePreview = useMemo(
    () => createStylePreviewDataUri(styleKey, String(fieldValues.seed ?? defaultSeed), 72),
    [styleKey, fieldValues.seed, defaultSeed]
  );

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-300 dark:bg-gray-0',
        className
      )}
    >
      <div className="grid min-w-0 grid-cols-1 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)] lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-gray-200 p-4 sm:p-5 md:border-b-0 md:border-e">
          <div className="flex w-full flex-col gap-4">
            <div className="flex items-center justify-center gap-2 sm:justify-start md:justify-center">
              <div className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUri}
                  alt={t('account.avatarBuilder.previewAlt')}
                  className="h-28 w-28 rounded-2xl border-4 border-white bg-white shadow-profilePic xs:h-32 xs:w-32 md:h-40 md:w-40 lg:h-44 lg:w-44"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <IconToolButton
                  label={t('account.avatarBuilder.randomize')}
                  onClick={handleRandomize}
                >
                  <PiDiceFiveBold className="h-4 w-4" />
                </IconToolButton>
                <IconToolButton
                  label={t('account.avatarBuilder.resetOptions')}
                  onClick={handleResetOptions}
                >
                  <PiArrowCounterClockwiseBold className="h-4 w-4" />
                </IconToolButton>
              </div>
            </div>

            <div className="w-full min-w-0 space-y-2">
              <Text className="text-xs font-medium text-gray-600">
                {t('account.avatarBuilder.seedLabel')}
              </Text>
              <div className="flex items-center gap-2">
                <Input
                  size="sm"
                  className="min-w-0 flex-1"
                  value={String(fieldValues.seed ?? '')}
                  onChange={(event) => handleFieldChange('seed', event.target.value)}
                  placeholder={t('account.avatarBuilder.seedPlaceholder')}
                />
                <IconToolButton
                  label={t('account.avatarBuilder.copyPreview')}
                  onClick={handleCopyPreview}
                >
                  <PiCopyBold className="h-4 w-4" />
                </IconToolButton>
              </div>
            </div>

            <Text className="text-center text-xs text-gray-500 sm:text-start md:text-center">
              {t('account.avatarBuilder.localHint')}
            </Text>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-300">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={stylePreview}
              alt=""
              className="h-11 w-11 shrink-0 rounded-full border-2 border-white shadow-sm"
            />
            <div className="min-w-0 flex-1">
              <Text className="text-xs text-gray-500">{t('account.avatarBuilder.currentStyle')}</Text>
              <Title as="h4" className="truncate text-sm font-semibold">
                {getDiceBearStyleTitle(styleKey)}
              </Title>
            </div>
            <IconToolButton
              label={t('account.avatarBuilder.changeStyle')}
              onClick={() =>
                openStylePicker({
                  currentStyle: styleKey,
                  seed: String(fieldValues.seed ?? defaultSeed),
                  onSelect: handleStyleChange,
                })
              }
            >
              <PiPaletteBold className="h-4 w-4" />
            </IconToolButton>
          </div>

          <div className="-mx-1 mb-3 flex gap-1 overflow-x-auto border-b border-gray-200 px-1 pb-px">
            {visibleTabs.map((tab) => {
              const count = tabFields[tab]?.length ?? 0;

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'shrink-0 rounded-t-lg px-3 py-2 text-sm font-medium transition',
                    activeTab === tab
                      ? 'border border-b-0 border-gray-200 bg-white text-primary dark:bg-gray-0'
                      : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  {t(`account.avatarBuilder.tabs.${tab}`)}
                  {count > 0 ? (
                    <span className="ms-1 text-xs text-gray-400">({count})</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="min-w-0">
            <TabFields
              fields={tabFields[activeTab]}
              styleKey={styleKey}
              fieldValues={fieldValues}
              allFields={fields}
              onFieldChange={handleFieldChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
