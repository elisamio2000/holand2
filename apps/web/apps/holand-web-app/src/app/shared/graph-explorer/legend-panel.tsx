'use client';

/**
 * LegendPanel — Floating legend overlay showing entity and relation color coding.
 *
 * Displays entity types with their configured colors and optionally
 * relation types. User can toggle legend visibility.
 *
 * @requires react-icons/pi — Phosphor icons
 *
 * @example
 * ```tsx
 * <LegendPanel data={graphData} visible={showLegend} onToggle={() => setShowLegend(!showLegend)} />
 * ```
 */

import { useMemo } from 'react';
import { PiListBold, PiXBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { getEntityConfig, getRelationConfig } from '@/config/graph-config';

import type { GraphData, EntityType, RelationType } from '@/types/graph-explorer.types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LegendPanelProps {
  data: GraphData;
  visible: boolean;
  onToggle: () => void;
  className?: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LegendPanel({ data, visible, onToggle, className }: LegendPanelProps) {
  const entityTypes = useMemo(() => {
    const types = new Set<EntityType>();
    data.nodes.forEach((n) => types.add(n.type));
    return Array.from(types).sort();
  }, [data.nodes]);

  const relationTypes = useMemo(() => {
    const types = new Set<RelationType>();
    data.links.forEach((l) => types.add(l.relation));
    return Array.from(types).sort();
  }, [data.links]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        'absolute bottom-2 right-2 z-10 bg-gray-0/95 dark:bg-gray-50/95 backdrop-blur-sm',
        'border border-muted rounded-lg shadow-lg p-3 max-w-[200px] max-h-[280px] overflow-y-auto',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
          <PiListBold className="w-3.5 h-3.5" />
          Legend
        </span>
        <button onClick={onToggle} className="text-gray-400 hover:text-gray-600">
          <PiXBold className="w-3 h-3" />
        </button>
      </div>

      {/* Entity types */}
      <div className="space-y-1 mb-2">
        <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
          Entities
        </span>
        {entityTypes.map((type) => {
          const cfg = getEntityConfig(type);
          return (
            <div key={type} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0 border"
                style={{ backgroundColor: cfg.bgColor, borderColor: cfg.color }}
              />
              <span className="text-[11px] text-gray-600 dark:text-gray-400">{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {/* Relation types (show top 10 at most) */}
      {relationTypes.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-muted">
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
            Relations
          </span>
          {relationTypes.slice(0, 10).map((type) => {
            const cfg = getRelationConfig(type);
            return (
              <div key={type} className="flex items-center gap-2">
                <div className="w-4 h-0.5 flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                <span className="text-[11px] text-gray-600 dark:text-gray-400 truncate">
                  {cfg.label}
                </span>
              </div>
            );
          })}
          {relationTypes.length > 10 && (
            <span className="text-[10px] text-gray-400">
              +{relationTypes.length - 10} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
