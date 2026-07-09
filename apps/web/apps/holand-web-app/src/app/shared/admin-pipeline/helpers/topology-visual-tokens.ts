import type { StatusDotColor } from '../components/status-dot';
import type { ModelHealthKind } from '@/utils/model-health';
import type { TopologyEntityKind } from '../topology-board/helpers/topology-board-types';

/** Entity kind colors shared by graph nodes and table badges */
export const ENTITY_KIND_COLORS: Record<TopologyEntityKind, string> = {
  tool: '#3b82f6',
  plugin: '#6366f1',
  service: '#8b5cf6',
  route: '#22c55e',
  role: '#10b981',
  model: '#f97316',
  endpoint: '#6366f1',
  remoteNode: '#06b6d4',
  group: '#a855f7',
};

export const HEALTH_DOT_COLOR: Record<ModelHealthKind, StatusDotColor> = {
  healthy: 'green',
  unhealthy: 'red',
  disabled: 'gray',
  unknown: 'amber',
};

export interface HealthLegendItem {
  color: StatusDotColor;
  labelKey: string;
  fallback: string;
}

export const HEALTH_LEGEND: HealthLegendItem[] = [
  { color: 'green', labelKey: 'pipeline.topology.healthLegend.healthy', fallback: 'Healthy' },
  { color: 'amber', labelKey: 'pipeline.topology.healthLegend.unknown', fallback: 'Unknown / unbound' },
  { color: 'red', labelKey: 'pipeline.topology.healthLegend.unhealthy', fallback: 'Unhealthy' },
  { color: 'gray', labelKey: 'pipeline.topology.healthLegend.disabled', fallback: 'Disabled' },
];

export function healthKindToStatusDot(kind: ModelHealthKind): StatusDotColor {
  return HEALTH_DOT_COLOR[kind] ?? 'gray';
}

export function healthKindAriaLabel(
  kind: ModelHealthKind,
  t: (key: string, fallback?: string) => string
): string {
  const item = HEALTH_LEGEND.find((l) => HEALTH_DOT_COLOR[kind] === l.color);
  return item ? t(item.labelKey, item.fallback) : kind;
}
