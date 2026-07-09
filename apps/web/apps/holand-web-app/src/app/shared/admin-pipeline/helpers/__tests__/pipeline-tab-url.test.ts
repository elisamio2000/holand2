import { describe, expect, it } from 'vitest';
import {
  buildPipelineUrl,
  normalizeTopologySearchParams,
  parseTopologyDensity,
  parseTopologyFilter,
  parseTopologyLens,
  parseTopologyView,
  resolvePipelineTab,
} from '../pipeline-tab-url';

describe('pipeline-tab-url', () => {
  it('defaults to overview tab', () => {
    expect(resolvePipelineTab(null)).toBe('overview');
  });

  it('maps legacy board tab to topology', () => {
    expect(resolvePipelineTab('board')).toBe('topology');
    expect(resolvePipelineTab('routes')).toBe('topology');
  });

  it('maps deprecated connections tab to topology', () => {
    expect(resolvePipelineTab('connections')).toBe('topology');
  });

  it('builds graph topology params with triage filters', () => {
    const url = buildPipelineUrl('topology', {
      lens: 'graph',
      tool: 'face_cluster',
      focus: 'tool:face_cluster',
      unbound: true,
      unassigned: true,
      required: true,
      unhealthy: true,
      modality: 'text',
      highlight: 'tool:face_cluster',
    });
    expect(url).toContain('tab=topology');
    expect(url).toContain('lens=graph');
    expect(url).toContain('view=board');
    expect(url).toContain('tool=face_cluster');
    expect(url).toContain('focus=tool%3Aface_cluster');
    expect(url).toContain('unbound=1');
    expect(url).toContain('status=needsBinding');
    expect(url).toContain('unassigned=1');
    expect(url).toContain('required=1');
    expect(url).toContain('unhealthy=1');
    expect(url).toContain('modality=text');
    expect(url).toContain('highlight=tool%3Aface_cluster');
    expect(url).not.toContain('filter=');
  });

  it('builds endpoints wizard params', () => {
    const url = buildPipelineUrl('endpoints', {
      wizard: 'external',
      endpoint: 'ep-123',
    });
    expect(url).toContain('tab=endpoints');
    expect(url).toContain('wizard=external');
    expect(url).toContain('endpoint=ep-123');
  });

  it('coerces table lens to graph in buildPipelineUrl', () => {
    const url = buildPipelineUrl('topology', { lens: 'table' });
    expect(url).toContain('lens=graph');
    expect(url).not.toContain('lens=table');
  });

  it('parses lens from view fallback', () => {
    const params = new URLSearchParams('tab=topology&view=board');
    expect(parseTopologyLens(params)).toBe('graph');
    expect(parseTopologyView(params)).toBe('board');
  });

  it('parses filter from section fallback', () => {
    const params = new URLSearchParams('tab=topology&section=assign');
    expect(parseTopologyFilter(params)).toBe('roles');
  });

  it('parses density from listMode fallback', () => {
    const params = new URLSearchParams('tab=topology&listMode=sections');
    expect(parseTopologyDensity(params)).toBe('comfortable');
  });

  it('normalizes legacy tab routes to topology focus', () => {
    const { changed, next } = normalizeTopologySearchParams(
      new URLSearchParams('tab=routes')
    );
    expect(changed).toBe(true);
    expect(next.get('tab')).toBe('topology');
    expect(next.get('focus')).toBe('routes');
    expect(next.get('lens')).toBe('graph');
  });

  it('redirects topology table lens to topology triage params', () => {
    const { changed, next } = normalizeTopologySearchParams(
      new URLSearchParams('tab=topology&lens=table&filter=routes')
    );
    expect(changed).toBe(true);
    expect(next.get('tab')).toBe('topology');
    expect(next.get('focus')).toBe('routes');
    expect(next.get('lens')).toBe('graph');
  });

  it('redirects bindings table filter to needsBinding status', () => {
    const { changed, next } = normalizeTopologySearchParams(
      new URLSearchParams('tab=topology&lens=table&filter=bindings')
    );
    expect(changed).toBe(true);
    expect(next.get('tab')).toBe('topology');
    expect(next.get('unbound')).toBe('1');
    expect(next.get('status')).toBe('needsBinding');
  });

  it('parses filter=all when neither filter nor section present', () => {
    const params = new URLSearchParams(
      'tab=topology&lens=table&view=list&density=compact&listMode=matrix'
    );
    expect(parseTopologyFilter(params)).toBe('all');
    expect(() => parseTopologyFilter(params)).not.toThrow();
  });

  it('normalizes legacy tab tools to topology graph', () => {
    const { changed, next } = normalizeTopologySearchParams(
      new URLSearchParams('tab=tools&tool=face_cluster')
    );
    expect(changed).toBe(true);
    expect(next.get('tab')).toBe('topology');
    expect(next.get('lens')).toBe('graph');
    expect(next.get('tool')).toBe('face_cluster');
  });

  it('normalizes tab=connections to topology preserving triage params', () => {
    const { changed, next } = normalizeTopologySearchParams(
      new URLSearchParams('tab=connections&unbound=1&unassigned=1&focus=roles')
    );
    expect(changed).toBe(true);
    expect(next.get('tab')).toBe('topology');
    expect(next.get('unbound')).toBe('1');
    expect(next.get('status')).toBe('needsBinding');
    expect(next.get('unassigned')).toBe('1');
    expect(next.get('focus')).toBe('roles');
  });

  it('keeps topology graph for tools table filter', () => {
    const { changed, next } = normalizeTopologySearchParams(
      new URLSearchParams('tab=topology&lens=table&filter=tools')
    );
    expect(changed).toBe(true);
    expect(next.get('tab')).toBe('topology');
    expect(next.get('lens')).toBe('graph');
    expect(next.get('filter')).toBeNull();
  });

  it('normalizes graph view aliases', () => {
    const { changed, next } = normalizeTopologySearchParams(
      new URLSearchParams('tab=topology&view=graph')
    );
    expect(changed).toBe(true);
    expect(next.get('view')).toBe('board');
    expect(next.get('lens')).toBe('graph');
  });
});
