'use client';

/**
 * StatsBar — Bottom statistics bar for the graph explorer.
 *
 * Displays node count, link count, cluster count, and other graph stats.
 *
 * @requires react-icons/pi — Phosphor icons
 *
 * @example
 * ```tsx
 * <StatsBar stats={graphData.stats} visibleNodes={100} visibleLinks={200} />
 * ```
 */

import {
  PiLinkBold,
  PiCirclesThreeBold,
  PiFileTextBold,
  PiEyeBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';

import type { GraphStats } from '@/types/graph-explorer.types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatsBarProps {
  stats: GraphStats | null;
  visibleNodes: number;
  visibleLinks: number;
  className?: string;
}

// ─── Sub-component ────────────────────────────────────────────────────────────

function StatItem({
  icon,
  label,
  value,
  subValue,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={cn('text-gray-400', color && `text-${color}`)}>{icon}</span>
      <span className="text-gray-500 hidden sm:inline">{label}:</span>
      <span className="font-medium text-gray-700 dark:text-gray-300">{value}</span>
      {subValue && <span className="text-gray-400 text-[10px]">{subValue}</span>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StatsBar({ stats, visibleNodes, visibleLinks, className }: StatsBarProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between flex-wrap gap-x-4 gap-y-1 px-3 py-1.5',
        'bg-gray-0 dark:bg-gray-50 border-t border-muted text-xs',
        className
      )}
    >
      <div className="flex items-center gap-4">
        <StatItem
          icon={<PiEyeBold className="w-3.5 h-3.5" />}
          label="Visible"
          value={visibleNodes}
          subValue={stats ? `/ ${stats.entity_count}` : undefined}
        />
        <StatItem
          icon={<PiLinkBold className="w-3.5 h-3.5" />}
          label="Links"
          value={visibleLinks}
          subValue={stats ? `/ ${stats.relationship_count}` : undefined}
        />
        {stats && stats.community_count > 0 && (
          <StatItem
            icon={<PiCirclesThreeBold className="w-3.5 h-3.5" />}
            label="Clusters"
            value={stats.community_count}
          />
        )}
        {stats && stats.report_count > 0 && (
          <StatItem
            icon={<PiFileTextBold className="w-3.5 h-3.5" />}
            label="Reports"
            value={stats.report_count}
          />
        )}
      </div>

      <div className="flex items-center gap-4">
        {stats && (
          <div className="hidden lg:flex items-center gap-2 text-[10px] text-gray-400">
            {stats.person_count != null && <span>Person: {stats.person_count}</span>}
            {stats.organization_count != null && <span>Org: {stats.organization_count}</span>}
            {stats.location_count != null && <span>Location: {stats.location_count}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
