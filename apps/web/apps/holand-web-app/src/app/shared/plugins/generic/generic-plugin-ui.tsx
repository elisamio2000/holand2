// ============================================
// GenericPluginUI — Fallback برای پلاگین‌های بدون native renderer
//
// این component برای هر پلاگینی که در registry ثبت نشده
// یک نمایش JSON viewer + form ساده ارائه می‌دهد.
// ============================================
'use client';

import { useState } from 'react';
import {
  Button,
  Input,
  Title,
  Text,
  Badge,
  Textarea,
  Collapse,
  Loader,
} from 'rizzui';
import {
  PiPlayBold,
  PiCodeBold,
  PiCheckCircleBold,
  PiXCircleBold,
  PiWarningBold,
  PiCopyBold,
  PiCaretDownBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import toast from 'react-hot-toast';
import type { PluginUIProps } from '../plugin-ui-types';

// ==========================================
// JSON Viewer
// ==========================================

function JsonViewer({ data, label }: { data: unknown; label: string }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      toast.success('کپی شد');
    } catch {
      toast.error('خطا در کپی');
    }
  };

  return (
    <div className="rounded-lg border border-muted">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between px-4 py-3',
          'text-sm font-medium text-gray-700 hover:bg-gray-50',
          'dark:text-gray-300 dark:hover:bg-gray-100/5',
          isOpen && 'border-b border-muted'
        )}
      >
        <div className="flex items-center gap-2">
          <PiCodeBold className="h-4 w-4 text-gray-400" />
          {label}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-200/10"
            title="کپی JSON"
          >
            <PiCopyBold className="h-3.5 w-3.5 text-gray-400" />
          </button>
          <PiCaretDownBold
            className={cn(
              'h-3.5 w-3.5 text-gray-400 transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </div>
      </button>

      {isOpen && (
        <pre className="max-h-[400px] overflow-auto p-4 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ==========================================
// Status Badge
// ==========================================

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;

  const config = {
    success: { color: 'success' as const, icon: PiCheckCircleBold, label: 'موفق' },
    completed: { color: 'success' as const, icon: PiCheckCircleBold, label: 'تکمیل شد' },
    error: { color: 'danger' as const, icon: PiXCircleBold, label: 'خطا' },
    running: { color: 'warning' as const, icon: PiWarningBold, label: 'در حال اجرا' },
  };

  const cfg = config[status as keyof typeof config];
  if (!cfg) {
    return (
      <Badge variant="flat" color="secondary">
        {status}
      </Badge>
    );
  }
  const Icon = cfg.icon;
  return (
    <Badge variant="flat" color={cfg.color} className="gap-1">
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </Badge>
  );
}

// ==========================================
// Main Component
// ==========================================

/**
 * GenericPluginUI — رندرر عمومی برای هر پلاگین.
 *
 * ویژگی‌ها:
 * - فرم پویا بر اساس args schema
 * - نمایش نتیجه به صورت JSON viewer
 * - نمایش warnings و errors
 * - کپی نتیجه
 */
export default function GenericPluginUI({
  pluginId,
  result,
  isRunning,
  readOnly = false,
  onRun,
  onSendToChat,
  onCopy,
}: PluginUIProps) {
  const [args, setArgs] = useState<Record<string, string>>({});

  const handleRun = async () => {
    await onRun(args);
  };

  const handleCopyResult = async () => {
    const text = JSON.stringify(result, null, 2);
    if (onCopy) {
      onCopy(text);
    } else {
      try {
        await navigator.clipboard.writeText(text);
        toast.success('نتیجه کپی شد');
      } catch {
        toast.error('خطا در کپی');
      }
    }
  };

  const data = result?.data ?? result?.channels;
  const ok = result?.status === 'success' || result?.status === 'completed';

  return (
    <div className="space-y-4">
      {/* Run Form */}
      {!readOnly && (
        <div className="rounded-xl border border-muted bg-gray-0 p-5 dark:bg-gray-50">
          <Title as="h6" className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-200">
            اجرای پلاگین
          </Title>

          {/* Simple key-value arg inputs */}
          {Object.keys(args).length > 0 && (
            <div className="mb-4 space-y-3">
              {Object.entries(args).map(([key, value]) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    {key}
                  </label>
                  <Input
                    size="sm"
                    value={value}
                    onChange={(e) =>
                      setArgs((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder={`مقدار ${key}...`}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Path input — common arg */}
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              مسیر فایل <span className="text-red-500">*</span>
            </label>
            <Input
              size="sm"
              value={args.path || ''}
              onChange={(e) =>
                setArgs((prev) => ({ ...prev, path: e.target.value }))
              }
              placeholder="مسیر فایل را وارد کنید..."
              className="font-mono text-xs"
              dir="ltr"
            />
          </div>

          <Button
            size="sm"
            onClick={handleRun}
            disabled={isRunning || !args.path}
            className="gap-2"
          >
            {isRunning ? (
              <>
                <Loader size="sm" variant="spinner" />
                در حال اجرا...
              </>
            ) : (
              <>
                <PiPlayBold className="h-4 w-4" />
                اجرا
              </>
            )}
          </Button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          className={cn(
            'rounded-xl border p-5',
            ok
              ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20'
              : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20'
          )}
        >
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <Title as="h6" className="text-sm font-semibold">
              نتیجه اجرا
            </Title>
            <div className="flex items-center gap-2">
              <StatusBadge status={result.status} />
              <button
                type="button"
                onClick={handleCopyResult}
                className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/10"
                title="کپی نتیجه"
              >
                <PiCopyBold className="h-4 w-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Error */}
          {result.error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-white p-3 dark:border-red-800 dark:bg-gray-900/50">
              <Text className="text-sm text-red-600 dark:text-red-400">
                {result.error}
              </Text>
            </div>
          )}

          {/* Warnings */}
          {result.warnings && result.warnings.length > 0 && (
            <div className="mb-3 space-y-1">
              {result.warnings.map((w, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-lg border border-orange-200 bg-white p-2 dark:border-orange-800 dark:bg-gray-900/50"
                >
                  <PiWarningBold className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                  <Text className="text-xs text-orange-600 dark:text-orange-400">
                    {w}
                  </Text>
                </div>
              ))}
            </div>
          )}

          {/* Data JSON viewer */}
          {data && <JsonViewer data={data} label="نتیجه خروجی" />}

          {/* LLM channel summary */}
          {result.channels?.llm && (
            <div className="mt-3">
              <Text className="mb-1 text-xs font-medium text-gray-500">
                خلاصه
              </Text>
              <div className="rounded-lg border border-muted bg-white p-3 dark:bg-gray-900/50">
                <Text className="text-sm leading-relaxed">
                  {result.channels.llm}
                </Text>
              </div>
            </div>
          )}

          {/* Send to Chat */}
          {onSendToChat && ok && (
            <div className="mt-4 border-t border-muted pt-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onSendToChat({
                    summary: `نتیجه پلاگین ${pluginId}`,
                    fullText: JSON.stringify(data, null, 2),
                    contentType: 'json',
                    meta: { pluginId, status: result.status },
                  })
                }
                className="gap-2"
              >
                ارسال به هوش مصنوعی
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!result && !isRunning && !readOnly && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-muted py-12 text-center">
          <span className="mb-2 text-4xl text-gray-300 dark:text-gray-600">
            🔧
          </span>
          <Text className="text-sm text-gray-500">
            Plugin ID: <code className="font-mono text-xs">{pluginId}</code>
          </Text>
          <Text className="mt-1 text-xs text-gray-400">
            مسیر فایل را وارد کرده و اجرا کنید
          </Text>
        </div>
      )}
    </div>
  );
}
