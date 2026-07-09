/**
 * One Search live API manifest — maps static requirements to @/platform/dev-panels rows.
 */

import type { DevApiStatus, LiveApiRequirement } from '@/platform/dev-panels';
import type { OneSearchMode } from '@/types/one-search.types';
import {
  ONE_SEARCH_API_REQUIREMENTS,
  type OneSearchDataSourceDescriptor,
} from './search-api-requirements';

export type OneSearchApiGroup =
  | 'core'
  | 'lanes'
  | 'visual'
  | 'playback'
  | 'media-meta'
  | 'voice'
  | 'admin';

export interface OneSearchLiveApiRequirement extends LiveApiRequirement {
  group: OneSearchApiGroup;
  /** Modes where this API applies (includes `any`). */
  modes: (OneSearchMode | 'any')[];
  lane: string;
  toolId: string;
  notes?: string;
}

export const ONE_SEARCH_API_GROUP_ORDER: OneSearchApiGroup[] = [
  'core',
  'lanes',
  'visual',
  'playback',
  'media-meta',
  'voice',
  'admin',
];

/** Map footprint requirement status → dev panel badge status. */
export function mapOneSearchRequirementStatus(
  status?: OneSearchDataSourceDescriptor['requirementStatus']
): DevApiStatus {
  switch (status) {
    case 'live':
    case 'resolved':
      return 'live';
    case 'workaround':
    case 'optional':
    case 'binding':
      return 'partial';
    case 'missing':
      return 'missing';
    default:
      return 'unknown';
  }
}

function inferGroup(row: OneSearchDataSourceDescriptor): OneSearchApiGroup {
  const endpoint = row.endpoint.toLowerCase();
  const tool = row.toolId.toLowerCase();

  if (tool === 'search.stt') return 'voice';
  if (tool === 'search.metrics') return 'admin';
  if (
    tool.includes('upload') ||
    tool.includes('delete') ||
    tool.includes('exclude') ||
    endpoint.includes('temp-upload')
  ) {
    return 'visual';
  }
  if (
    endpoint.includes('transcript') ||
    endpoint.includes('chapters') ||
    endpoint.includes('subtitles') ||
    endpoint.includes('filmstrip') ||
    endpoint.includes('waveform') ||
    (endpoint.includes('/artifacts/{') && !endpoint.includes('download'))
  ) {
    return 'media-meta';
  }
  if (
    endpoint.includes('download') ||
    endpoint.includes('presigned') ||
    endpoint.includes('thumbnail')
  ) {
    return 'playback';
  }
  if (endpoint.includes('/search/query') && !endpoint.includes('plugin_smart_search')) {
    return 'core';
  }
  if (row.lane !== 'any' && (tool.startsWith('plugin.') || tool.startsWith('admin.'))) {
    return 'lanes';
  }
  return 'core';
}

function stableRequirementId(row: OneSearchDataSourceDescriptor, index: number): string {
  const slug = row.toolId.replace(/\./g, '-').replace(/[^a-z0-9-]/gi, '') || 'api';
  const mode = row.mode === 'any' ? 'any' : row.mode;
  const lane = row.lane === 'any' ? 'any' : row.lane;
  return `${mode}-${lane}-${slug}`.slice(0, 72) || `req-${index}`;
}

function toLiveRow(
  row: OneSearchDataSourceDescriptor,
  index: number
): OneSearchLiveApiRequirement {
  const endpoint =
    row.targetApi && row.targetApi !== row.endpoint
      ? `${row.endpoint} → ${row.targetApi}`
      : row.endpoint;

  return {
    id: stableRequirementId(row, index),
    endpoint,
    status: mapOneSearchRequirementStatus(row.requirementStatus),
    group: inferGroup(row),
    consumer: `${row.mode}/${row.lane}`,
    modes: [row.mode],
    lane: row.lane,
    toolId: row.toolId,
    notes: row.notes,
  };
}

/** Full manifest for dev panel (deduped by id). */
export function buildOneSearchLiveApiManifest(): OneSearchLiveApiRequirement[] {
  const seen = new Set<string>();
  const rows: OneSearchLiveApiRequirement[] = [];
  ONE_SEARCH_API_REQUIREMENTS.forEach((row, index) => {
    const live = toLiveRow(row, index);
    if (seen.has(live.id)) return;
    seen.add(live.id);
    rows.push(live);
  });
  return rows;
}

/** APIs relevant to the active mode tab (all | text | image | audio | video | file). */
export function liveApisForMode(mode: OneSearchMode): OneSearchLiveApiRequirement[] {
  return buildOneSearchLiveApiManifest().filter(
    (row) => row.modes.includes('any') || row.modes.includes(mode)
  );
}

/** Group live APIs for DevPanelSection headers. */
export function groupOneSearchLiveApis(
  rows: OneSearchLiveApiRequirement[] = buildOneSearchLiveApiManifest()
): Map<OneSearchApiGroup, OneSearchLiveApiRequirement[]> {
  const map = new Map<OneSearchApiGroup, OneSearchLiveApiRequirement[]>();
  for (const row of rows) {
    const list = map.get(row.group) ?? [];
    list.push(row);
    map.set(row.group, list);
  }
  return map;
}
