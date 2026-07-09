// ============================================
// PluginRenderer — Orchestrator Component
//
// نقطه تکین ورود به Plugin UI System.
// این component تنها import لازم برای نمایش هر پلاگین است.
//
// استفاده:
//   <PluginRenderer pluginId="image.ocr" result={...} onRun={...} isRunning={false} />
//
// هم در صفحه مستقل، هم در modal، هم در sidebar چت کار می‌کند.
// ============================================
'use client';

import { Suspense } from 'react';
import { Loader } from 'rizzui';
import cn from '@core/utils/class-names';
import { getPluginRenderer, hasNativeRenderer } from './plugin-registry';
import type { PluginUIProps } from './plugin-ui-types';

// ==========================================
// Loading Skeleton
// ==========================================

function PluginLoadingFallback({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex min-h-[200px] flex-col items-center justify-center gap-3',
        'rounded-xl border border-muted bg-gray-0 dark:bg-gray-50',
        className
      )}
    >
      <Loader size="lg" variant="spinner" />
      <span className="text-sm text-gray-500 dark:text-gray-400">
        در حال بارگذاری رابط پلاگین...
      </span>
    </div>
  );
}

// ==========================================
// Error Boundary (simple)
// ==========================================

function PluginErrorFallback({
  pluginId,
  className,
}: {
  pluginId: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-h-[200px] flex-col items-center justify-center gap-3 p-6 text-center',
        'rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20',
        className
      )}
    >
      <span className="text-3xl">⚠️</span>
      <p className="font-medium text-red-700 dark:text-red-400">
        خطا در بارگذاری رابط پلاگین
      </p>
      <p className="text-sm text-red-500 dark:text-red-500/80">
        Plugin ID: <code className="font-mono">{pluginId}</code>
      </p>
    </div>
  );
}

// ==========================================
// Native Renderer Badge
// ==========================================

function NativeBadge() {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
        'bg-primary/10 text-[11px] font-medium text-primary'
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      UI اختصاصی
    </span>
  );
}

// ==========================================
// Main Component
// ==========================================

export interface PluginRendererProps extends PluginUIProps {
  /**
   * نمایش badge "UI اختصاصی" برای پلاگین‌هایی که native renderer دارند.
   * پیش‌فرض: false
   */
  showNativeBadge?: boolean;
}

/**
 * PluginRenderer — Orchestrator اصلی Plugin UI System.
 *
 * @param pluginId - شناسه پلاگین
 * @param result - نتیجه آخرین اجرا
 * @param isRunning - آیا در حال اجراست
 * @param readOnly - حالت فقط خواندنی
 * @param onRun - callback اجرای پلاگین
 * @param onSendToChat - ارسال به چت (اختیاری)
 * @param onCopy - کپی به clipboard (اختیاری)
 * @param showNativeBadge - نمایش badge UI اختصاصی
 * @param className - کلاس CSS اضافی
 *
 * @example
 * // در صفحه مستقل:
 * <PluginRenderer
 *   pluginId="image.ocr"
 *   result={result}
 *   isRunning={isRunning}
 *   onRun={handleRun}
 * />
 *
 * @example
 * // در sidebar چت (read-only):
 * <PluginRenderer
 *   pluginId="image.ocr"
 *   result={chatMessage.toolResult}
 *   isRunning={false}
 *   readOnly={true}
 *   onRun={async () => {}}
 *   onSendToChat={handleSendToChat}
 * />
 */
export default function PluginRenderer({
  showNativeBadge = false,
  className,
  ...props
}: PluginRendererProps) {
  const PluginUI = getPluginRenderer(props.pluginId);
  const isNative = hasNativeRenderer(props.pluginId);

  return (
    <div className={cn('relative', className)}>
      {/* Badge UI اختصاصی — فقط در marketplace نمایش داده می‌شود */}
      {showNativeBadge && isNative && (
        <div className="absolute end-3 top-3 z-10">
          <NativeBadge />
        </div>
      )}

      <Suspense
        fallback={
          <PluginLoadingFallback
            className={cn(isNative ? '' : 'border-dashed')}
          />
        }
      >
        <PluginUI {...props} />
      </Suspense>
    </div>
  );
}
