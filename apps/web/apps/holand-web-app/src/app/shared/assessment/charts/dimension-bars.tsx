// ============================================
// DimensionBars — horizontal bar breakdown per dimension with certainty
// indicator. Complements the radar chart with precise, sortable values.
// ============================================

'use client';

import { Text } from 'rizzui';
import cn from '@/lib/cn';
import type { DimensionScore } from '@/types/assessment.types';

interface DimensionBarsProps {
  dimensions: DimensionScore[];
  className?: string;
  barColorClassName?: string;
}

export default function DimensionBars({
  dimensions,
  className,
  barColorClassName = 'bg-emerald-500',
}: DimensionBarsProps) {
  const sorted = [...dimensions].sort((a, b) => b.normalizedScore - a.normalizedScore);

  return (
    <div className={cn('space-y-4', className)}>
      {sorted.map((dim) => (
        <div key={dim.dimension}>
          <div className="mb-1.5 flex items-center justify-between">
            <Text className="text-sm font-medium text-gray-800">{dim.label}</Text>
            <Text className="text-sm font-semibold text-gray-600">
              {dim.normalizedScore.toFixed(0)}%
            </Text>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={cn('h-full rounded-full transition-all', barColorClassName)}
              style={{ width: `${Math.min(100, Math.max(0, dim.normalizedScore))}%` }}
            />
          </div>
          {typeof dim.certainty === 'number' && (
            <Text className="mt-1 text-xs text-gray-400">
              میزان قطعیت: {Math.round(dim.certainty * 100)}%
            </Text>
          )}
        </div>
      ))}
    </div>
  );
}
