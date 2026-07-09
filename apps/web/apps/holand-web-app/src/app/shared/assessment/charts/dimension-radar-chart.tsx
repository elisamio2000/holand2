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
}

export default function DimensionRadarChart({
  title = 'نمودار ابعاد',
  dimensions,
  className,
}: DimensionRadarChartProps) {
  const data = dimensions.map((d) => ({
    dimension: d.dimension,
    label: d.label,
    امتیاز: d.normalizedScore,
  }));

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
              name="امتیاز نرمال شده"
              dataKey="امتیاز"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.35}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}
