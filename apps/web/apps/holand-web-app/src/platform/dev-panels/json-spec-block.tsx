'use client';

import { useCallback } from 'react';
import { Button, Text } from 'rizzui';
import { PiCopyBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';

export interface JsonSpecBlockProps {
  /** Block title (e.g. "Request sample"). */
  label: string;
  /** Raw text or object — objects are JSON-stringified. */
  data: string | unknown;
  /** Copy button label. */
  copyLabel?: string;
  className?: string;
  maxHeightClassName?: string;
}

/**
 * Collapsible-friendly JSON/text spec block with copy — used in dev API panels.
 */
export function JsonSpecBlock({
  label,
  data,
  copyLabel = 'Copy',
  className,
  maxHeightClassName = 'max-h-64',
}: JsonSpecBlockProps) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(text);
  }, [text]);

  return (
    <div
      className={cn(
        'rounded-md border border-slate-200 dark:border-slate-700',
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900/40">
        <Text className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</Text>
        <Button size="sm" variant="text" onClick={copy} className="h-7 px-2">
          <PiCopyBold className="me-1 size-3.5" />
          {copyLabel}
        </Button>
      </div>
      <pre
        className={cn(
          'overflow-auto break-words p-3 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300',
          maxHeightClassName
        )}
      >
        {text}
      </pre>
    </div>
  );
}
