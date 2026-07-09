import { describe, expect, it } from 'vitest';
import type { BoardNodeObject, BoardObject } from '../../board-types';
import type { BoardDocumentState } from '../../board-snapshot';
import {
  collectLinkPairs,
  ensureConnectorsFromLinks,
  extractGraphTopology,
  graphTopologyFingerprint,
  prepareGraphForView,
  pruneGraphLayout,
  removeOrphanLinkConnectors,
  syncGraphFromLinks,
  createMinimalLinkConnector,
} from '../graph-sync';

const node = (id: string, links: string[] = []): BoardNodeObject => ({
  type: 'node',
  id,
  x: 0,
  y: 0,
  width: 100,
  height: 60,
  label: id,
  nodeRole: 'topic',
  color: '#3b82f6',
  linkedNodeIds: links,
});

describe('graph-sync', () => {
  it('collects bidirectional link pairs once', () => {
    const doc: BoardDocumentState = {
      version: 1,
      objects: [node('a', ['b']), node('b', ['a'])],
    };
    const pairs = collectLinkPairs(doc.objects);
    expect(pairs.size).toBe(1);
    expect(pairs.has('a|b')).toBe(true);
  });

  it('creates link connector when nodes are anchor-linked', () => {
    const doc: BoardDocumentState = {
      version: 1,
      objects: [node('a', ['b']), node('b', ['a'])],
    };
    const next = ensureConnectorsFromLinks(doc, createMinimalLinkConnector);
    const connectors = next.objects.filter((o) => o.type === 'connector');
    expect(connectors).toHaveLength(1);
    expect(connectors[0].kind).toBe('link');
  });

  it('dedupes existing connector between pair', () => {
    const doc: BoardDocumentState = {
      version: 1,
      objects: [
        node('a', ['b']),
        node('b'),
        {
          type: 'connector',
          id: 'c1',
          sourceId: 'a',
          targetId: 'b',
          kind: 'flow',
        },
      ],
    };
    const next = ensureConnectorsFromLinks(doc, createMinimalLinkConnector);
    expect(next.objects.filter((o) => o.type === 'connector')).toHaveLength(1);
  });

  it('removes orphan link connectors after unlink', () => {
    const doc: BoardDocumentState = {
      version: 1,
      objects: [node('a'), node('b'), createMinimalLinkConnector('a', 'b')],
    };
    const next = removeOrphanLinkConnectors(doc);
    expect(next.objects.filter((o) => o.type === 'connector')).toHaveLength(0);
  });

  it('syncGraphFromLinks adds and removes link connectors', () => {
    let doc: BoardDocumentState = {
      version: 1,
      objects: [node('a', ['b']), node('b', ['a'])],
    };
    doc = syncGraphFromLinks(doc, createMinimalLinkConnector);
    expect(doc.objects.some((o: BoardObject) => o.type === 'connector')).toBe(true);
    doc = { ...doc, objects: [node('a'), node('b')] };
    doc = syncGraphFromLinks(doc, createMinimalLinkConnector);
    expect(doc.objects.some((o: BoardObject) => o.type === 'connector')).toBe(false);
  });

  it('graphTopologyFingerprint changes when node added', () => {
    const doc: BoardDocumentState = { version: 1, objects: [node('a'), node('b')] };
    const fp1 = graphTopologyFingerprint(doc);
    const fp2 = graphTopologyFingerprint({
      version: 1,
      objects: [node('a'), node('b'), node('c')],
    });
    expect(fp1).not.toBe(fp2);
  });

  it('pruneGraphLayout removes orphan layout keys', () => {
    const doc: BoardDocumentState = {
      version: 1,
      objects: [node('a')],
      graphLayout: { a: { x: 0, y: 0 }, deleted: { x: 10, y: 10 } },
    };
    const next = pruneGraphLayout(doc);
    expect(next.graphLayout).toEqual({ a: { x: 0, y: 0 } });
  });

  it('prepareGraphForView creates link connectors and detects topology change', () => {
    const doc: BoardDocumentState = {
      version: 1,
      objects: [node('a', ['b']), node('b', ['a'])],
    };
    const result = prepareGraphForView(doc, createMinimalLinkConnector);
    expect(result.doc.objects.some((o) => o.type === 'connector')).toBe(true);
    expect(result.topologyChanged).toBe(true);
    expect(result.doc.graphTopologyFingerprint).toBeTruthy();
    expect(extractGraphTopology(result.doc).edgeCount).toBe(1);
  });

  it('prepareGraphForView reports missing layout for new nodes', () => {
    const doc: BoardDocumentState = {
      version: 1,
      objects: [node('a'), node('b')],
      graphTopologyFingerprint: graphTopologyFingerprint({
        version: 1,
        objects: [node('a')],
      }),
    };
    const result = prepareGraphForView(doc, createMinimalLinkConnector);
    expect(result.missingLayoutNodeIds).toContain('b');
  });
});
