'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type {
  LegacyPipelineTabKey,
  PipelineTabKey,
  TopologyDensity,
  TopologyFilter,
  TopologyLens,
  TopologyListSection,
  TopologyViewMode,
} from '@/types/pipeline-admin.types';

const VALID_TABS: PipelineTabKey[] = [
  'overview',
  'models',
  'endpoints',
  'topology',
  'simulator',
];

const LEGACY_TABS: LegacyPipelineTabKey[] = ['roles', 'routes', 'tools', 'board'];

const VALID_SECTIONS: TopologyListSection[] = ['routes', 'tools', 'bindings', 'assign'];

const VALID_VIEWS: TopologyViewMode[] = ['list', 'board'];

const VALID_LENSES: TopologyLens[] = ['graph', 'table'];

const VALID_FILTERS: TopologyFilter[] = ['all', 'routes', 'tools', 'roles', 'bindings'];

const VALID_DENSITIES: TopologyDensity[] = ['compact', 'comfortable'];

export function isPipelineTabKey(value: string | null): value is PipelineTabKey {
  return value != null && VALID_TABS.includes(value as PipelineTabKey);
}

export function isLegacyTabKey(value: string | null): value is LegacyPipelineTabKey {
  return value != null && LEGACY_TABS.includes(value as LegacyPipelineTabKey);
}

export function resolvePipelineTab(tabParamRaw: string | null): PipelineTabKey {
  if (tabParamRaw === 'board' || tabParamRaw === 'connections') return 'topology';
  if (isLegacyTabKey(tabParamRaw)) return 'topology';
  if (isPipelineTabKey(tabParamRaw)) return tabParamRaw;
  return 'overview';
}

export interface TopologyUrlParams {
  /** @deprecated use lens */
  view?: TopologyViewMode;
  /** @deprecated use filter */
  section?: TopologyListSection;
  lens?: TopologyLens;
  filter?: TopologyFilter;
  density?: TopologyDensity;
  tool?: string | null;
  focus?: string | null;
  highlight?: string | null;
  /** @deprecated matrix always compact; use density */
  listMode?: 'matrix' | 'sections';
  /** Maps to display filter status=needsBinding on topology board */
  unbound?: boolean;
  status?: 'needsBinding' | null;
  unhealthy?: boolean;
  unassigned?: boolean;
  required?: boolean;
  modality?: string | null;
  /** Endpoints tab: open edit drawer for endpoint id */
  endpoint?: string | null;
  /** Endpoints tab: open external server wizard */
  wizard?: 'external' | null;
}

function sectionToFilter(section: TopologyListSection): TopologyFilter {
  switch (section) {
    case 'assign':
      return 'roles';
    case 'bindings':
      return 'bindings';
    case 'tools':
      return 'tools';
    case 'routes':
    default:
      return 'routes';
  }
}

function viewToLens(view: TopologyViewMode | null | undefined): TopologyLens {
  return view === 'board' ? 'graph' : 'table';
}

function lensToView(lens: TopologyLens): TopologyViewMode {
  return lens === 'graph' ? 'board' : 'list';
}

export function parseTopologyLens(searchParams: URLSearchParams): TopologyLens {
  const lens = searchParams.get('lens');
  if (lens === 'table') return 'graph';
  if (lens && VALID_LENSES.includes(lens as TopologyLens)) {
    return lens as TopologyLens;
  }
  const view = searchParams.get('view');
  if (view === 'board' || view === 'graph' || view === '3d' || view === 'rack') {
    return 'graph';
  }
  if (view === 'list') return 'graph';
  return 'graph';
}

function parseSectionParam(searchParams: URLSearchParams): TopologyListSection | null {
  const section = searchParams.get('section');
  if (section && VALID_SECTIONS.includes(section as TopologyListSection)) {
    return section as TopologyListSection;
  }
  return null;
}

function parseFilterParam(searchParams: URLSearchParams): TopologyFilter | null {
  const filter = searchParams.get('filter');
  if (filter && VALID_FILTERS.includes(filter as TopologyFilter)) {
    return filter as TopologyFilter;
  }
  return null;
}

export function parseTopologyFilter(searchParams: URLSearchParams): TopologyFilter {
  const filter = parseFilterParam(searchParams);
  if (filter) return filter;
  const section = parseSectionParam(searchParams);
  if (section) return sectionToFilter(section);
  return 'all';
}

export function parseTopologyDensity(searchParams: URLSearchParams): TopologyDensity {
  const density = searchParams.get('density');
  if (density && VALID_DENSITIES.includes(density as TopologyDensity)) {
    return density as TopologyDensity;
  }
  const listMode = searchParams.get('listMode');
  if (listMode === 'sections') return 'comfortable';
  return 'compact';
}

export function buildPipelineUrl(
  tab: PipelineTabKey,
  extra?: TopologyUrlParams & { route_key?: string | null }
): string {
  const params = new URLSearchParams();
  params.set('tab', tab);

  if (tab === 'topology' && extra) {
    const lens = extra.lens ?? (extra.view ? viewToLens(extra.view) : 'graph');

    params.set('lens', lens === 'table' ? 'graph' : lens);
    params.set('view', lens === 'table' ? 'board' : lensToView(lens));

    if (extra.tool) params.set('tool', extra.tool);
    if (extra.focus) params.set('focus', extra.focus);
    if (extra.highlight) params.set('highlight', extra.highlight);
    if (extra.unbound || extra.status === 'needsBinding') {
      params.set('unbound', '1');
      params.set('status', 'needsBinding');
    }
    if (extra.unassigned) params.set('unassigned', '1');
    if (extra.required) params.set('required', '1');
    if (extra.unhealthy) params.set('unhealthy', '1');
    if (extra.modality) params.set('modality', extra.modality);
  }

  if (tab === 'simulator' && extra?.route_key) {
    params.set('route_key', extra.route_key);
  }

  if (tab === 'endpoints' && extra) {
    if (extra.endpoint) params.set('endpoint', extra.endpoint);
    if (extra.wizard === 'external') params.set('wizard', 'external');
  }

  return `/admin/pipeline?${params.toString()}`;
}

export function buildTopologyUrl(extra?: TopologyUrlParams): string {
  return buildPipelineUrl('topology', {
    lens: extra?.lens ?? 'graph',
    filter: extra?.filter ?? 'all',
    density: extra?.density ?? 'compact',
    section: extra?.section,
    tool: extra?.tool,
    focus: extra?.focus,
    highlight: extra?.highlight,
    view: extra?.view,
    listMode: extra?.listMode,
    unbound: extra?.unbound,
    status: extra?.status,
    unassigned: extra?.unassigned,
    required: extra?.required,
    unhealthy: extra?.unhealthy,
    modality: extra?.modality,
  });
}

/** Map legacy ?tab= values to canonical topology URL params. */
export function legacyTabToTopologyParams(
  legacy: LegacyPipelineTabKey,
  tool?: string | null
): TopologyUrlParams & { tab?: 'topology' } {
  switch (legacy) {
    case 'roles':
      return { tab: 'topology', focus: 'roles', unassigned: true };
    case 'routes':
      return { tab: 'topology', focus: 'routes' };
    case 'tools':
      return {
        tab: 'topology',
        lens: 'graph',
        view: 'board',
        tool: tool ?? undefined,
      };
    case 'board':
      return { tab: 'topology', lens: 'graph', view: 'board' };
    default:
      return { tab: 'topology', lens: 'graph', view: 'board' };
  }
}

function tableFilterToTopologyParams(
  filter: TopologyFilter | null,
  section: TopologyListSection | null
): TopologyUrlParams {
  const effective = filter ?? (section ? sectionToFilter(section) : null);
  switch (effective) {
    case 'roles':
      return { focus: 'roles' };
    case 'routes':
      return { focus: 'routes' };
    case 'tools':
      return {};
    case 'bindings':
      return { unbound: true, status: 'needsBinding' };
    case 'all':
    default:
      return {};
  }
}

function applyTopologyUrlParams(next: URLSearchParams, mapped: TopologyUrlParams): void {
  next.set('tab', 'topology');
  next.set('lens', 'graph');
  next.set('view', 'board');
  if (mapped.focus) next.set('focus', mapped.focus);
  if (mapped.tool) next.set('tool', mapped.tool);
  if (mapped.unbound || mapped.status === 'needsBinding') {
    next.set('unbound', '1');
    next.set('status', 'needsBinding');
  }
  if (mapped.unassigned) next.set('unassigned', '1');
  if (mapped.required) next.set('required', '1');
  if (mapped.unhealthy) next.set('unhealthy', '1');
  if (mapped.modality) next.set('modality', mapped.modality);
  if (mapped.highlight) next.set('highlight', mapped.highlight);
  next.delete('filter');
  next.delete('section');
  next.delete('density');
  next.delete('listMode');
}

export function normalizeTopologySearchParams(
  searchParams: URLSearchParams
): { changed: boolean; next: URLSearchParams } {
  const next = new URLSearchParams(searchParams.toString());
  let changed = false;

  const tabRaw = next.get('tab');
  if (!tabRaw) {
    next.set('tab', 'overview');
    changed = true;
  } else if (tabRaw === 'connections') {
    next.set('tab', 'topology');
    next.set('lens', 'graph');
    next.set('view', 'board');
    if (next.get('focus') === 'tools') next.delete('focus');
    if (next.get('unbound') === '1' && !next.get('status')) {
      next.set('status', 'needsBinding');
    }
    next.delete('filter');
    next.delete('section');
    next.delete('density');
    next.delete('listMode');
    changed = true;
  } else if (isLegacyTabKey(tabRaw) || tabRaw === 'board') {
    const legacy = tabRaw === 'board' ? 'board' : tabRaw;
    const tool = next.get('tool');
    const mapped = legacyTabToTopologyParams(legacy, tool);
    applyTopologyUrlParams(next, mapped);
    changed = true;
  }

  const tab = next.get('tab');
  const lensRaw = next.get('lens');
  const filterRaw = parseFilterParam(next);
  const sectionRaw = parseSectionParam(next);

  const effectiveTableFilter =
    filterRaw ?? (sectionRaw ? sectionToFilter(sectionRaw) : null);

  if (tab === 'topology' && (lensRaw === 'table' || filterRaw || sectionRaw)) {
    if (effectiveTableFilter === 'tools') {
      next.set('tab', 'topology');
      next.set('lens', 'graph');
      next.set('view', 'board');
      next.delete('filter');
      next.delete('section');
      next.delete('density');
      next.delete('listMode');
      changed = true;
    } else {
      const mapped = tableFilterToTopologyParams(filterRaw, sectionRaw);
      applyTopologyUrlParams(next, mapped);
      changed = true;
    }
  }

  const currentTab = next.get('tab');
  const viewRaw = next.get('view');
  if (viewRaw === 'graph' || viewRaw === '3d' || viewRaw === 'rack') {
    next.set('view', 'board');
    if (currentTab === 'topology') next.set('lens', 'graph');
    changed = true;
  } else if (viewRaw === 'list' && currentTab === 'topology') {
    next.set('view', 'board');
    next.set('lens', 'graph');
    changed = true;
  } else if (viewRaw && !VALID_VIEWS.includes(viewRaw as TopologyViewMode)) {
    next.delete('view');
    changed = true;
  }

  if (currentTab === 'topology' && !next.get('lens')) {
    next.set('lens', 'graph');
    changed = true;
  }

  if (currentTab === 'topology' && !next.get('view')) {
    next.set('view', 'board');
    changed = true;
  }

  if (currentTab === 'topology' && next.get('lens') === 'table') {
    next.set('lens', 'graph');
    changed = true;
  }

  if (currentTab === 'topology') {
    if (next.has('filter')) {
      next.delete('filter');
      changed = true;
    }
    if (next.has('section')) {
      next.delete('section');
      changed = true;
    }
    if (next.has('density')) {
      next.delete('density');
      changed = true;
    }
    if (next.has('listMode')) {
      next.delete('listMode');
      changed = true;
    }
  }

  return { changed, next };
}

/** Redirect legacy tab URLs to canonical scheme. */
export function usePipelineTabRedirect(): void {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const { changed, next } = normalizeTopologySearchParams(
      new URLSearchParams(searchParams.toString())
    );
    if (!changed) return;
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);
}

export function parseTopologyView(searchParams: URLSearchParams): TopologyViewMode {
  return lensToView(parseTopologyLens(searchParams));
}

export function isTopologyGraphLens(searchParams: URLSearchParams): boolean {
  return parseTopologyLens(searchParams) === 'graph';
}
