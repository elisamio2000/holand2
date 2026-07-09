// ============================================
// DimensionRadarChart — six/four-axis radar for Holland (RIASEC) or MBTI
// dimension scores. Used by both the quick result summary and the full
// report page.
// ============================================

'use client';

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import WidgetCard from '@core/components/cards/widget-card';
import { CustomTooltip } from '@core/components/charts/custom-tooltip';
import type { DimensionScore } from '@/types/assessment.types';

interface DimensionRadarChartProps {
  title?: string;
  dimensions: DimensionScore[];
  className?: string;
  /** Label for the primary series — only shown when a comparison series is present. */
  seriesLabel?: string;
  /** Optional second set of dimension scores to overlay (e.g. a prior assessment). */
  compareDimensions?: DimensionScore[];
  /** Label for the comparison series. */
  compareLabel?: string;
}

export default function DimensionRadarChart({
  title = 'نمودار ابعاد',
  dimensions,
  className,
  seriesLabel = 'امتیاز نرمال شده',
  compareDimensions,
  compareLabel = 'آزمون قبلی',
}: DimensionRadarChartProps) {
  const data = dimensions.map((d) => {
    const compareMatch = compareDimensions?.find((c) => c.dimension === d.dimension);
    return {
      dimension: d.dimension,
      label: d.label,
      [seriesLabel]: d.normalizedScore,
      ...(compareDimensions ? { [compareLabel]: compareMatch?.normalizedScore ?? 0 } : {}),
    };
  });

  return (
    <WidgetCard title={title} className={className}>
      <div className="mt-5 aspect-square w-full max-w-md sm:mx-auto lg:mt-7">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="75%">
            <PolarGrid />
            <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
            <Tooltip content={<CustomTooltip postfix="%" />} />
            <Radar
              name={seriesLabel}
              dataKey={seriesLabel}
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.35}
            />
            {compareDimensions && (
              <Radar
                name={compareLabel}
                dataKey={compareLabel}
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.2}
              />
            )}
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}
