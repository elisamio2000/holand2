// ============================================
// OcrResultPanel — نمایش و ویرایش متن استخراج‌شده
//
// ویژگی‌ها:
// - نمایش متن با قابلیت ویرایش
// - کپی متن
// - نمایش آمار (تعداد کلمات، کاراکترها، دقت)
// - ارسال به هوش مصنوعی / چت
// - نمایش نتایج چند موتور (engine_results)
// ============================================
'use client';

import { useState } from 'react';
import { Badge, Button, Text, Title } from 'rizzui';
import {
  PiCopyBold,
  PiPencilBold,
  PiCheckBold,
  PiChatCircleTextBold,
  PiTextTBold,
  PiHashStraightBold,
  PiChartBarBold,
  PiCaretDownBold,
  PiCaretUpBold,
  PiClockCountdownBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { OcrResultData, OcrEngineResult, getConfidenceColor, formatConfidence, formatDuration } from './ocr-types';
import type { PluginChatPayload } from '../../plugin-ui-types';

// ==========================================
// Props
// ==========================================

interface OcrResultPanelProps {
  data: OcrResultData | null;
  isRunning: boolean;
  readOnly?: boolean;
  onSendToChat?: (payload: PluginChatPayload) => void;
  onCopy?: (text: string) => void;
  className?: string;
}

// ==========================================
// Stat Card
// ==========================================

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-muted bg-gray-50/50 px-3 py-2 dark:bg-gray-100/5">
      <Icon className="h-4 w-4 shrink-0 text-gray-400" />
      <div className="min-w-0">
        <p className="text-[10px] text-gray-400">{label}</p>
        <p className="truncate text-sm font-semibold text-gray-700 dark:text-gray-200">
          {value}
        </p>
      </div>
    </div>
  );
}

// ==========================================
// Engine Result Row
// ==========================================

function EngineResultRow({ result }: { result: OcrEngineResult }) {
  const [expanded, setExpanded] = useState(false);
  const color = getConfidenceColor(result.confidence_avg);
  const badgeColor =
    color === 'success' ? 'success' : color === 'warning' ? 'warning' : 'danger';

  return (
    <div className="rounded-lg border border-muted bg-gray-0 dark:bg-gray-50">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 px-3 py-2 text-start hover:bg-gray-50/60 dark:hover:bg-gray-100/5"
      >
        <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200">
          {result.engine_display}
        </span>
        {result.success ? (
          <>
            <Badge variant="flat" color={badgeColor} className="text-xs">
              {formatConfidence(result.confidence_avg)}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <PiClockCountdownBold className="h-3 w-3" />
              {formatDuration(result.duration_ms)}
            </span>
          </>
        ) : (
          <Badge variant="flat" color="danger" className="text-xs">
            خطا
          </Badge>
        )}
        {expanded ? (
          <PiCaretUpBold className="h-3.5 w-3.5 text-gray-400" />
        ) : (
          <PiCaretDownBold className="h-3.5 w-3.5 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-muted px-3 pb-3 pt-2">
          {result.success && result.text ? (
            <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-600 dark:text-gray-400">
              {result.text}
            </pre>
          ) : (
            <p className="text-xs text-danger">{result.error || 'خطای ناشناخته'}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// Main Component
// ==========================================

export default function OcrResultPanel({
  data,
  isRunning,
  readOnly = false,
  onSendToChat,
  onCopy,
  className,
}: OcrResultPanelProps) {
  const [editedText, setEditedText] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showEngines, setShowEngines] = useState(false);

  const displayText = editedText ?? data?.text ?? '';
  const confidenceColor = data ? getConfidenceColor(data.confidence_avg) : null;
  const badgeColor =
    confidenceColor === 'success'
      ? 'success'
      : confidenceColor === 'warning'
        ? 'warning'
        : 'danger';

  // ----------------------------------------
  // Handlers
  // ----------------------------------------

  const handleCopy = async () => {
    if (!displayText) return;
    try {
      await navigator.clipboard.writeText(displayText);
      onCopy?.(displayText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleSend = () => {
    if (!data || !onSendToChat) return;
    onSendToChat({
      summary: `متن استخراج‌شده با دقت ${formatConfidence(data.confidence_avg)}`,
      fullText: displayText,
      contentType: 'ocr_result',
      meta: {
        word_count: data.word_count,
        char_count: data.char_count,
        confidence_avg: data.confidence_avg,
        engine: data.primary_engine_display,
        language: data.detected_language,
      },
    });
  };

  const toggleEdit = () => {
    if (isEditing) {
      setIsEditing(false);
    } else {
      if (editedText === null && data?.text) {
        setEditedText(data.text);
      }
      setIsEditing(true);
    }
  };

  // ----------------------------------------
  // Empty / loading state
  // ----------------------------------------

  if (!data && !isRunning) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border border-dashed border-muted bg-gray-50/40 py-10 dark:bg-gray-100/5',
          className
        )}
      >
        <PiTextTBold className="mb-2 h-8 w-8 text-gray-300" />
        <Text className="text-sm text-gray-400">
          متنی برای نمایش وجود ندارد
        </Text>
        <Text className="mt-1 text-xs text-gray-300">
          تصویر را آپلود کرده و OCR را اجرا کنید
        </Text>
      </div>
    );
  }

  if (isRunning) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border border-dashed border-primary/30 bg-primary/5 py-10',
          className
        )}
      >
        <div className="mb-3 flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 animate-bounce rounded-full bg-primary"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <Text className="text-sm text-primary">در حال پردازش تصویر...</Text>
      </div>
    );
  }

  // ----------------------------------------
  // Result state
  // ----------------------------------------

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <Title as="h6" className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          متن استخراج‌شده
        </Title>
        {data?.primary_engine_display && (
          <Badge variant="flat" color="primary" className="text-xs font-normal">
            {data.primary_engine_display}
          </Badge>
        )}
        {data && (
          <Badge variant="flat" color={badgeColor} className="text-xs font-normal">
            دقت {formatConfidence(data.confidence_avg)}
          </Badge>
        )}
        {data?.detected_language && (
          <Badge variant="flat" color="secondary" className="text-xs font-normal">
            {data.detected_language}
          </Badge>
        )}
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-3 gap-2">
          <StatCard icon={PiHashStraightBold} label="کلمه" value={data.word_count?.toLocaleString('fa-IR') ?? '—'} />
          <StatCard icon={PiTextTBold} label="کاراکتر" value={data.char_count?.toLocaleString('fa-IR') ?? '—'} />
          <StatCard icon={PiChartBarBold} label="دقت" value={formatConfidence(data.confidence_avg)} />
        </div>
      )}

      {/* Text Area */}
      <div className="relative rounded-xl border border-muted bg-gray-0 dark:bg-gray-50">
        {isEditing && !readOnly ? (
          <textarea
            dir="auto"
            value={displayText}
            onChange={(e) => setEditedText(e.target.value)}
            className={cn(
              'min-h-[160px] w-full resize-y rounded-xl bg-transparent p-3 font-[Vazirmatn,sans-serif] text-sm',
              'text-gray-700 outline-none dark:text-gray-200',
              'placeholder:text-gray-400'
            )}
            placeholder="متن استخراج‌شده اینجا نمایش داده می‌شود..."
          />
        ) : (
          <div
            dir="auto"
            className={cn(
              'min-h-[120px] whitespace-pre-wrap break-words p-3 font-[Vazirmatn,sans-serif] text-sm leading-relaxed',
              'text-gray-700 dark:text-gray-200',
              !displayText && 'text-gray-400 italic'
            )}
          >
            {displayText || 'بدون متن'}
          </div>
        )}

        {/* Floating action bar */}
        <div className="flex items-center gap-1 border-t border-muted px-2 py-1.5">
          {!readOnly && (
            <Button
              variant="text"
              size="sm"
              onClick={toggleEdit}
              className="h-7 gap-1 px-2 text-xs text-gray-500 hover:text-gray-700"
            >
              {isEditing ? (
                <>
                  <PiCheckBold className="h-3.5 w-3.5" /> ذخیره
                </>
              ) : (
                <>
                  <PiPencilBold className="h-3.5 w-3.5" /> ویرایش
                </>
              )}
            </Button>
          )}

          <Button
            variant="text"
            size="sm"
            onClick={handleCopy}
            disabled={!displayText}
            className="h-7 gap-1 px-2 text-xs text-gray-500 hover:text-gray-700"
          >
            {copied ? (
              <>
                <PiCheckBold className="h-3.5 w-3.5 text-success" /> کپی شد
              </>
            ) : (
              <>
                <PiCopyBold className="h-3.5 w-3.5" /> کپی
              </>
            )}
          </Button>

          {onSendToChat && data && (
            <Button
              variant="text"
              size="sm"
              onClick={handleSend}
              className="ms-auto h-7 gap-1 px-2 text-xs text-primary hover:text-primary/80"
            >
              <PiChatCircleTextBold className="h-3.5 w-3.5" />
              ارسال به هوش مصنوعی
            </Button>
          )}
        </div>
      </div>

      {/* Engine Results (collapsible) */}
      {data?.engine_results && data.engine_results.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowEngines((s) => !s)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {showEngines ? (
              <PiCaretUpBold className="h-3.5 w-3.5" />
            ) : (
              <PiCaretDownBold className="h-3.5 w-3.5" />
            )}
            جزئیات موتورها ({data.engine_results.length})
          </button>

          {showEngines && (
            <div className="mt-2 space-y-2">
              {data.engine_results.map((r) => (
                <EngineResultRow key={r.engine} result={r} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
