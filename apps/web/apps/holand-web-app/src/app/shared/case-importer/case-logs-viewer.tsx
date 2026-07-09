// ============================================
// CaseLogsViewer — Log viewer for case processing logs
// Displays color-coded, filterable log entries
// ============================================

'use client';

import { useMemo, useState } from 'react';
import { Text, Badge, Input } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  PiInfoBold,
  PiWarningBold,
  PiXCircleBold,
  PiBugBold,
  PiMagnifyingGlassBold,
  PiFunnelBold,
} from 'react-icons/pi';
import type { CaseLog, CaseLogLevel } from '@/types/case-importer.types';

/**
 * Log level icon and color mapping.
 */
const LOG_LEVEL_CONFIG: Record<
  CaseLogLevel,
  { icon: React.ReactNode; bgClass: string; textClass: string }
> = {
  info: {
    icon: <PiInfoBold className="h-3.5 w-3.5" />,
    bgClass: 'bg-blue-50 dark:bg-blue-950/20',
    textClass: 'text-blue-600 dark:text-blue-400',
  },
  warn: {
    icon: <PiWarningBold className="h-3.5 w-3.5" />,
    bgClass: 'bg-yellow-50 dark:bg-yellow-950/20',
    textClass: 'text-yellow-600 dark:text-yellow-400',
  },
  error: {
    icon: <PiXCircleBold className="h-3.5 w-3.5" />,
    bgClass: 'bg-red-50 dark:bg-red-950/20',
    textClass: 'text-red-600 dark:text-red-400',
  },
  debug: {
    icon: <PiBugBold className="h-3.5 w-3.5" />,
    bgClass: 'bg-gray-50 dark:bg-gray-100',
    textClass: 'text-gray-500 dark:text-gray-400',
  },
};

/**
 * Format epoch timestamp to HH:MM:SS.
 */
function formatTime(epoch: number): string {
  if (!epoch) return '--:--:--';
  const d = new Date(epoch * 1000);
  return d.toLocaleTimeString();
}

/**
 * CaseLogsViewer — Displays color-coded processing logs.
 *
 * Features:
 * - Color-coded log levels (info/warn/error/debug)
 * - Search filter for log messages
 * - Level filter
 * - Auto-scroll to latest
 * - Formatted timestamps
 *
 * @requires case-importer.types CaseLog
 *
 * @example
 * ```tsx
 * <CaseLogsViewer logs={caseDetail.logs} />
 * ```
 */
export default function CaseLogsViewer({
  logs,
  className,
}: {
  /** Array of logs to display */
  logs: CaseLog[];
  /** Additional CSS classes */
  className?: string;
}) {
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<CaseLogLevel | 'all'>('all');

  const filteredLogs = useMemo(() => {
    let result = [...logs];

    // Level filter
    if (levelFilter !== 'all') {
      result = result.filter((l) => l.level === levelFilter);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.message.toLowerCase().includes(q) ||
          l.scope.toLowerCase().includes(q)
      );
    }

    // Sort by timestamp (newest first)
    result.sort((a, b) => b.ts - a.ts);

    return result;
  }, [logs, levelFilter, search]);

  if (!logs || logs.length === 0) {
    return (
      <div className={cn('flex min-h-[100px] items-center justify-center rounded-lg border border-dashed border-muted p-6', className)}>
        <Text className="text-sm text-gray-400">
          No logs available.
        </Text>
      </div>
    );
  }

  // Count logs by level
  const levelCounts = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.level] = (acc[l.level] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className={cn('rounded-lg border border-muted', className)}>
      {/* Header with filters */}
      <div className="flex flex-col gap-2 border-b border-muted bg-gray-50 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between dark:bg-gray-100">
        <div className="flex items-center gap-2">
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Logs ({logs.length})
          </Text>
          {/* Level badges as filters */}
          {(['info', 'warn', 'error', 'debug'] as CaseLogLevel[]).map((level) => {
            const count = levelCounts[level] || 0;
            if (count === 0) return null;
            const config = LOG_LEVEL_CONFIG[level];
            const isActive = levelFilter === level;
            return (
              <button
                key={level}
                onClick={() => setLevelFilter(isActive ? 'all' : level)}
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
                  isActive ? config.bgClass + ' ' + config.textClass : 'text-gray-400 hover:text-gray-600'
                )}
              >
                {level}: {count}
              </button>
            );
          })}
        </div>

        <Input
          placeholder="Search logs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          prefix={<PiMagnifyingGlassBold className="h-3.5 w-3.5 text-gray-400" />}
          className="w-48"
          inputClassName="text-xs py-1"
        />
      </div>

      {/* Log entries */}
      <div className="max-h-[400px] overflow-y-auto font-mono text-xs">
        {filteredLogs.map((log, idx) => {
          const config = LOG_LEVEL_CONFIG[log.level] || LOG_LEVEL_CONFIG.info;
          return (
            <div
              key={`${log.ts}-${idx}`}
              className={cn(
                'flex items-start gap-2 border-b border-muted/50 px-4 py-2 last:border-b-0',
                config.bgClass
              )}
            >
              <span className={cn('mt-0.5 flex-shrink-0', config.textClass)}>
                {config.icon}
              </span>
              <span className="w-16 flex-shrink-0 text-gray-400">
                {formatTime(log.ts)}
              </span>
              <Badge
                variant="outline"
                size="sm"
                className="flex-shrink-0 text-[10px]"
              >
                {log.scope}
              </Badge>
              <span className="min-w-0 flex-1 break-words text-gray-700 dark:text-gray-300">
                {log.message}
              </span>
            </div>
          );
        })}

        {filteredLogs.length === 0 && (
          <div className="flex min-h-[80px] items-center justify-center">
            <Text className="text-xs text-gray-400">No matching logs.</Text>
          </div>
        )}
      </div>
    </div>
  );
}
