// ============================================
// OcrEnginePanel — انتخاب موتور OCR و تنظیمات زبان
//
// ویژگی‌ها:
// - نمایش وضعیت هر موتور (available/disabled/not_installed)
// - انتخاب سرعت یا دقت
// - انتخاب زبان (فارسی / انگلیسی / ترکیبی)
// - tooltip برای توضیح هر موتور
// ============================================
'use client';

import { Tooltip } from '@/components/tooltip';
import { Badge, Text } from 'rizzui';
import {
  PiLightningBold,
  PiCrosshairSimpleBold,
  PiInfoBold,
  PiCheckCircleBold,
  PiProhibitBold,
  PiWarningCircleBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { EngineInfo, EngineStatus } from '../../plugin-ui-types';
import { OcrEngineKey, getEngineMeta } from './ocr-types';

// ==========================================
// Types
// ==========================================

interface OcrEnginePanelProps {
  engines: Record<string, EngineInfo>;
  selectedEngine: OcrEngineKey | null;
  onSelectEngine: (engine: OcrEngineKey) => void;
  selectedLanguages: string[];
  onSelectLanguages: (langs: string[]) => void;
  disabled?: boolean;
}

// ==========================================
// Language Options
// ==========================================

const LANGUAGE_OPTIONS = [
  { code: 'fa', label: 'فارسی', flag: '🇮🇷' },
  { code: 'en', label: 'انگلیسی', flag: '🇺🇸' },
  { code: 'ar', label: 'عربی', flag: '🇸🇦' },
];

// ==========================================
// Engine Status Icon
// ==========================================

function EngineStatusIcon({ status }: { status: EngineStatus }) {
  if (status === 'available') {
    return <PiCheckCircleBold className="h-3.5 w-3.5 text-green-500" />;
  }
  if (status === 'disabled') {
    return <PiProhibitBold className="h-3.5 w-3.5 text-gray-400" />;
  }
  return <PiWarningCircleBold className="h-3.5 w-3.5 text-orange-400" />;
}

// ==========================================
// Engine Button
// ==========================================

interface EngineButtonProps {
  engineKey: string;
  info: EngineInfo;
  isSelected: boolean;
  onSelect: () => void;
  disabled: boolean;
}

function EngineButton({
  engineKey,
  info,
  isSelected,
  onSelect,
  disabled,
}: EngineButtonProps) {
  const isAvailable = info.status === 'available';
  const meta = getEngineMeta(engineKey);

  const speedLabel =
    info.speed_rank === 1
      ? 'سریع‌ترین'
      : info.speed_rank === 2
        ? 'متوسط'
        : 'کند';

  const accLabel =
    info.accuracy_rank === 1
      ? 'دقیق‌ترین'
      : info.accuracy_rank === 2
        ? 'دقت متوسط'
        : 'کم‌دقت‌ترین';

  const button = (
    <button
      type="button"
      onClick={onSelect}
      disabled={!isAvailable || disabled}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-start transition-all',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        isSelected && isAvailable
          ? 'border-primary bg-primary/5 dark:bg-primary/10'
          : isAvailable
            ? 'border-muted bg-gray-0 hover:border-primary/40 hover:bg-gray-50 dark:bg-gray-50 dark:hover:bg-gray-100/5'
            : 'cursor-not-allowed border-muted bg-gray-50 opacity-50 dark:bg-gray-100/5'
      )}
    >
      {/* Icon */}
      <span className="text-xl leading-none">{meta.icon}</span>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'text-sm font-semibold',
              isSelected && isAvailable ? 'text-primary' : 'text-gray-700 dark:text-gray-200'
            )}
          >
            {info.display_name}
          </span>
          <EngineStatusIcon status={info.status} />
        </div>
        <p className="mt-0.5 text-[11px] text-gray-400">
          {speedLabel} · {accLabel}
        </p>
      </div>

      {/* Selected dot */}
      {isSelected && isAvailable && (
        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </button>
  );

  // برای موتورهای غیرفعال — tooltip با دلیل
  if (!isAvailable && info.error) {
    return (
      <Tooltip content={<span className="text-xs">{info.error}</span>} placement="top">
        <div>{button}</div>
      </Tooltip>
    );
  }

  return button;
}

// ==========================================
// Quick Strategy Buttons
// ==========================================

function StrategyButton({
  strategy,
  label,
  icon: Icon,
  isSelected,
  onSelect,
  disabled,
}: {
  strategy: OcrEngineKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isSelected: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-all',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        isSelected
          ? 'border-primary bg-primary/5 font-semibold text-primary dark:bg-primary/10'
          : 'border-muted bg-gray-0 text-gray-600 hover:border-primary/40 dark:bg-gray-50 dark:text-gray-400'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

// ==========================================
// Main Component
// ==========================================

export default function OcrEnginePanel({
  engines,
  selectedEngine,
  onSelectEngine,
  selectedLanguages,
  onSelectLanguages,
  disabled = false,
}: OcrEnginePanelProps) {
  const engineEntries = Object.entries(engines).sort(
    (a, b) => (a[1].speed_rank ?? 99) - (b[1].speed_rank ?? 99)
  );

  const toggleLang = (code: string) => {
    if (selectedLanguages.includes(code)) {
      // حداقل یک زبان باید انتخاب باشد
      if (selectedLanguages.length > 1) {
        onSelectLanguages(selectedLanguages.filter((l) => l !== code));
      }
    } else {
      onSelectLanguages([...selectedLanguages, code]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Strategy Quick Select */}
      <div>
        <Text className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
          استراتژی
        </Text>
        <div className="flex gap-2">
          <StrategyButton
            strategy="speed"
            label="سرعت"
            icon={PiLightningBold}
            isSelected={selectedEngine === 'speed'}
            onSelect={() => onSelectEngine('speed')}
            disabled={disabled}
          />
          <StrategyButton
            strategy="accuracy"
            label="دقت"
            icon={PiCrosshairSimpleBold}
            isSelected={selectedEngine === 'accuracy'}
            onSelect={() => onSelectEngine('accuracy')}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Engine List */}
      <div>
        <div className="mb-2 flex items-center gap-1">
          <Text className="text-xs font-medium text-gray-500 dark:text-gray-400">
            موتور اختصاصی
          </Text>
          <Tooltip
            content={
              <span className="text-xs">
                موتور خاصی را انتخاب کنید. در صورت خطا، fallback خودکار انجام می‌شود.
              </span>
            }
            placement="top"
          >
            <PiInfoBold className="h-3.5 w-3.5 cursor-default text-gray-400" />
          </Tooltip>
        </div>

        <div className="space-y-2">
          {engineEntries.map(([key, info]) => (
            <EngineButton
              key={key}
              engineKey={key}
              info={info}
              isSelected={selectedEngine === key}
              onSelect={() => onSelectEngine(key as OcrEngineKey)}
              disabled={disabled}
            />
          ))}
        </div>
      </div>

      {/* Language Selection */}
      <div>
        <Text className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
          زبان تصویر
        </Text>
        <div className="flex flex-wrap gap-2">
          {LANGUAGE_OPTIONS.map((lang) => {
            const isActive = selectedLanguages.includes(lang.code);
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => !disabled && toggleLang(lang.code)}
                disabled={disabled}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-all',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  isActive
                    ? 'border-primary bg-primary/5 font-medium text-primary dark:bg-primary/10'
                    : 'border-muted bg-gray-0 text-gray-600 hover:border-primary/40 dark:bg-gray-50 dark:text-gray-400',
                  disabled && 'cursor-not-allowed opacity-60'
                )}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
                {isActive && (
                  <PiCheckCircleBold className="h-3.5 w-3.5 text-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Available count badge */}
      <div className="flex items-center gap-2 border-t border-muted pt-3">
        <Badge
          variant="flat"
          color="success"
          className="text-xs"
        >
          {engineEntries.filter(([, e]) => e.status === 'available').length} موتور فعال
        </Badge>
        {engineEntries.some(([, e]) => e.status !== 'available') && (
          <Badge variant="flat" color="secondary" className="text-xs">
            {engineEntries.filter(([, e]) => e.status !== 'available').length} غیرفعال
          </Badge>
        )}
      </div>
    </div>
  );
}
