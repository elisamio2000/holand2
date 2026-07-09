// ============================================
// OcrWordsTable — جدول کلمات شناسایی‌شده
//
// ویژگی‌ها:
// - نمایش کلمه، دقت (درصد + نوار رنگی)، موتور
// - مرتب‌سازی بر اساس اعتماد
// - محدودیت ۱۰۰ ردیف با پیام "و N کلمه دیگر"
// - Collapse/Expand
// ============================================
'use client';

import { useState } from 'react';
import { Badge, Text } from 'rizzui';
import { PiCaretDownBold, PiCaretUpBold, PiListBulletsBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { OcrWord, getConfidenceColor, formatConfidence } from './ocr-types';

// ==========================================
// Props
// ==========================================

interface OcrWordsTableProps {
  words: OcrWord[];
  maxRows?: number;
  className?: string;
}

// ==========================================
// Confidence Bar
// ==========================================

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = getConfidenceColor(confidence);
  const barClass =
    color === 'success'
      ? 'bg-green-500'
      : color === 'warning'
        ? 'bg-yellow-400'
        : 'bg-red-400';

  const badgeColor =
    color === 'success' ? 'success' : color === 'warning' ? 'warning' : 'danger';

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-200">
        <div
          className={cn('h-full rounded-full transition-all', barClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <Badge variant="flat" color={badgeColor} className="min-w-[44px] justify-center text-[11px]">
        {formatConfidence(confidence)}
      </Badge>
    </div>
  );
}

// ==========================================
// Main Component
// ==========================================

export default function OcrWordsTable({
  words,
  maxRows = 100,
  className,
}: OcrWordsTableProps) {
  const [expanded, setExpanded] = useState(false);
  const [sortByConf, setSortByConf] = useState(false);

  if (!words || words.length === 0) {
    return null;
  }

  const sorted = sortByConf
    ? [...words].sort((a, b) => b.confidence - a.confidence)
    : words;

  const displayed = sorted.slice(0, maxRows);
  const remaining = sorted.length - maxRows;

  return (
    <div className={cn('rounded-xl border border-muted', className)}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 rounded-t-xl px-4 py-3 hover:bg-gray-50/60 dark:hover:bg-gray-100/5"
      >
        <PiListBulletsBold className="h-4 w-4 text-gray-400" />
        <span className="flex-1 text-start text-sm font-medium text-gray-700 dark:text-gray-200">
          کلمات شناسایی‌شده
        </span>
        <Badge variant="flat" color="secondary" className="text-xs">
          {words.length.toLocaleString('fa-IR')} کلمه
        </Badge>
        {expanded ? (
          <PiCaretUpBold className="h-4 w-4 text-gray-400" />
        ) : (
          <PiCaretDownBold className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <>
          {/* Sort toggle */}
          <div className="flex items-center gap-2 border-t border-muted px-4 py-2">
            <Text className="text-xs text-gray-400">مرتب‌سازی:</Text>
            <button
              type="button"
              onClick={() => setSortByConf(false)}
              className={cn(
                'rounded px-2 py-0.5 text-xs transition-colors',
                !sortByConf
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-gray-400 hover:text-gray-600'
              )}
            >
              ترتیب متن
            </button>
            <button
              type="button"
              onClick={() => setSortByConf(true)}
              className={cn(
                'rounded px-2 py-0.5 text-xs transition-colors',
                sortByConf
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-gray-400 hover:text-gray-600'
              )}
            >
              بیشترین دقت
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border-t border-muted">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-muted bg-gray-50/50 dark:bg-gray-100/5">
                  <th className="w-10 px-4 py-2 text-center text-xs font-medium text-gray-400">
                    #
                  </th>
                  <th className="px-4 py-2 text-start text-xs font-medium text-gray-400">
                    متن
                  </th>
                  <th className="px-4 py-2 text-start text-xs font-medium text-gray-400">
                    دقت
                  </th>
                  <th className="px-4 py-2 text-start text-xs font-medium text-gray-400">
                    موتور
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted">
                {displayed.map((word, idx) => (
                  <tr
                    key={`${word.text}-${idx}`}
                    className="hover:bg-gray-50/40 dark:hover:bg-gray-100/5"
                  >
                    <td className="px-4 py-2 text-center text-xs text-gray-300">
                      {(idx + 1).toLocaleString('fa-IR')}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        dir="auto"
                        className="font-[Vazirmatn,sans-serif] text-gray-700 dark:text-gray-200"
                      >
                        {word.text}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <ConfidenceBar confidence={word.confidence} />
                    </td>
                    <td className="px-4 py-2">
                      {word.engine ? (
                        <Badge variant="outline" color="secondary" className="text-[11px]">
                          {word.engine}
                        </Badge>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Remaining message */}
          {remaining > 0 && (
            <div className="rounded-b-xl border-t border-muted bg-gray-50/40 px-4 py-2.5 text-center text-xs text-gray-400 dark:bg-gray-100/5">
              و {remaining.toLocaleString('fa-IR')} کلمه دیگر (بیش از حد نمایش)
            </div>
          )}
        </>
      )}
    </div>
  );
}
