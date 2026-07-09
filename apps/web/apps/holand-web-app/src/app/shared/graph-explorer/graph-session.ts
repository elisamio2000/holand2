// ============================================
// graph-session.ts — Session storage utility for the 3-step graph flow
// Handles persisting data between: add-data → edit-data → graph-explorer
// ============================================

import type { GraphData } from '@/types/graph-explorer.types';

const KEY_RAW_DATA = 'graph:raw_data';
const KEY_SOURCE_LABEL = 'graph:source_label';
const KEY_CASE_IDS = 'graph:case_ids';
const KEY_PROCESSED_DATA = 'graph:processed_data';
const KEY_PROCESSOR_DRAFT = 'graph:processor_draft';

// ─── In-Memory Fallback Store ─────────────────────────────────────────────────
// WHY: sessionStorage has a ~5-10MB quota which is insufficient for large graphs
// (10K nodes + 25K links can exceed 20MB serialized). For Next.js SPA navigation,
// module-level variables persist between route changes within the same tab,
// making them a reliable fallback when sessionStorage quota is exceeded.
//
// WHY window._graphMemStore: Next.js Fast Refresh in dev mode re-executes modules,
// resetting module-level variables. Using window object (which persists across
// Fast Refresh) ensures data survives hot reloads during development.
declare global {
  interface Window {
    _graphMemStore?: {
      rawData: { data: GraphData; label: string; caseIds?: string[] } | null;
      processedData: GraphData | null;
    };
  }
}

function getMemStore() {
  if (typeof window === 'undefined') return { rawData: null, processedData: null };
  if (!window._graphMemStore) {
    window._graphMemStore = { rawData: null, processedData: null };
  }
  return window._graphMemStore;
}

export interface GraphProcessorDraft {
  sourceLabel: string;
  /** Signature of the raw dataset this draft belongs to (e.g. "nodes:390|links:694"). */
  rawSignature?: string;
  excludedNodeIds: string[];
  excludedLinkIds: string[];
  filterRules: Array<Record<string, unknown>>;
  transformRules: Array<Record<string, unknown>>;
  nodeOverrides: Record<string, Record<string, unknown>>;
  linkOverrides: Record<string, Record<string, unknown>>;
  entitySearch: string;
  linkSearch: string;
  entitySort: { key: string; dir: 'asc' | 'desc' } | null;
  linkSort: { key: string; dir: 'asc' | 'desc' } | null;
  showEditPanel: boolean;
  showPreviewPanel: boolean;
  previewWidthPercent: number;
  previewSections: Record<string, boolean>;
  /** Optional preprocessing toggle: drop nodes without any relationship. */
  excludeIsolatedNodes?: boolean;
  /** Manually added relationships (not from rawData) */
  manualLinks?: Array<Record<string, unknown>>;
  /** User annotations (tags, notes, importance) keyed by node ID */
  annotations?: Record<string, Record<string, unknown>>;
}

interface GraphProcessorDraftEnvelope {
  version: 1;
  updatedAt: string;
  draft: GraphProcessorDraft;
}

// ─── Write ─────────────────────────────────────────────────────────────────

/**
 * Persist raw graph data and its source label after the upload step.
 * Called by AddDataView before navigating to /graph/edit-data.
 *
 * @param data - Raw graph data from connector
 * @param label - Human-readable source label (e.g. "File: data.json")
 */
export function saveRawData(data: GraphData, label: string, caseIds?: string[]): void {
  console.info('[GraphSession] Saving raw data:', {
    nodes: data.nodes.length,
    links: data.links.length,
    label,
  });
  // Always keep in-memory copy as primary store for large datasets
  getMemStore().rawData = { data, label, caseIds };
  try {
    sessionStorage.setItem(KEY_RAW_DATA, JSON.stringify(data));
    sessionStorage.setItem(KEY_SOURCE_LABEL, label);
    if (caseIds && caseIds.length > 0) sessionStorage.setItem(KEY_CASE_IDS, JSON.stringify(caseIds));
    else sessionStorage.removeItem(KEY_CASE_IDS);
  } catch (e) {
    // QuotaExceededError — data too large for sessionStorage; in-memory fallback used
    console.warn('[GraphSession] sessionStorage quota exceeded, raw data stored in-memory only:', e);
  }
}

/**
 * Persist processed graph data after the edit/pre-processing step.
 * Called by EditDataView before navigating to /graph/graph-explorer.
 *
 * @param data - Processed/filtered graph data ready for visualization
 */
export function saveProcessedData(data: GraphData): void {
  console.info('[GraphSession] Saving processed data:', {
    nodes: data.nodes.length,
    links: data.links.length,
  });
  // Always keep in-memory copy as primary store for large datasets
  getMemStore().processedData = data;
  try {
    sessionStorage.setItem(KEY_PROCESSED_DATA, JSON.stringify(data));
  } catch (e) {
    // QuotaExceededError — data too large for sessionStorage; in-memory fallback used
    console.warn('[GraphSession] sessionStorage quota exceeded, processed data stored in-memory only:', e);
  }
}

/**
 * Persist temporary pre-processing workspace state.
 * This keeps user edits while moving between /graph/edit-* routes.
 */
export function saveProcessorDraft(draft: GraphProcessorDraft): void {
  console.info('[GraphSession] Saving processor draft:', {
    sourceLabel: draft.sourceLabel,
    excludedNodes: draft.excludedNodeIds.length,
    excludedLinks: draft.excludedLinkIds.length,
    filters: draft.filterRules.length,
    transforms: draft.transformRules.length,
  });
  try {
    const payload: GraphProcessorDraftEnvelope = {
      version: 1,
      updatedAt: new Date().toISOString(),
      draft,
    };
    sessionStorage.setItem(KEY_PROCESSOR_DRAFT, JSON.stringify(payload));
  } catch (e) {
    console.warn('[GraphSession] sessionStorage quota exceeded, processor draft not persisted:', e);
  }
}

// ─── Read ───────────────────────────────────────────────────────────────────

/**
 * Load raw graph data and source label from session.
 * Returns null if not found (user navigated directly without upload step).
 */
export function loadRawData(): { data: GraphData; label: string; caseIds?: string[] } | null {
  // Check in-memory store first (handles large datasets that exceed sessionStorage quota)
  const memRawData = getMemStore().rawData;
  if (memRawData) {
    console.info('[GraphSession] Loaded raw data from memory:', {
      nodes: memRawData.data.nodes.length,
      links: memRawData.data.links.length,
    });
    return memRawData;
  }
  try {
    const raw = sessionStorage.getItem(KEY_RAW_DATA);
    const label = sessionStorage.getItem(KEY_SOURCE_LABEL) ?? '';
    const caseIdsRaw = sessionStorage.getItem(KEY_CASE_IDS);
    if (!raw) return null;
    const data = JSON.parse(raw) as GraphData;
    const caseIds = caseIdsRaw ? (JSON.parse(caseIdsRaw) as string[]) : undefined;
    console.info('[GraphSession] Loaded raw data:', {
      nodes: data.nodes.length,
      links: data.links.length,
    });
    return { data, label, caseIds };
  } catch (e) {
    console.error('[GraphSession] Failed to load raw data from session:', e);
    return null;
  }
}

/**
 * Load processed graph data from session.
 * Returns null if not found (user navigated directly without edit step).
 */
export function loadProcessedData(): GraphData | null {
  // Check in-memory store first (handles large datasets that exceed sessionStorage quota)
  const memProcessedData = getMemStore().processedData;
  if (memProcessedData) {
    console.info('[GraphSession] Loaded processed data from memory:', {
      nodes: memProcessedData.nodes.length,
      links: memProcessedData.links.length,
    });
    return memProcessedData;
  }
  try {
    const raw = sessionStorage.getItem(KEY_PROCESSED_DATA);
    if (!raw) return null;
    const data = JSON.parse(raw) as GraphData;
    console.info('[GraphSession] Loaded processed data:', {
      nodes: data.nodes.length,
      links: data.links.length,
    });
    return data;
  } catch (e) {
    console.error('[GraphSession] Failed to load processed data from session:', e);
    return null;
  }
}

/**
 * Load temporary pre-processing workspace state.
 */
export function loadProcessorDraft(): GraphProcessorDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY_PROCESSOR_DRAFT);
    if (!raw) return null;
    const payload = JSON.parse(raw) as GraphProcessorDraftEnvelope;
    if (!payload?.draft) return null;
    return payload.draft;
  } catch (e) {
    console.error('[GraphSession] Failed to load processor draft from session:', e);
    return null;
  }
}

// ─── Clear ──────────────────────────────────────────────────────────────────

/**
 * Clear all graph session data.
 * Call when user navigates back to the upload step to start fresh.
 */
export function clearGraphSession(): void {
  console.info('[GraphSession] Clearing session data');
  // Clear in-memory stores as well
  const mem = getMemStore();
  mem.rawData = null;
  mem.processedData = null;
  sessionStorage.removeItem(KEY_RAW_DATA);
  sessionStorage.removeItem(KEY_SOURCE_LABEL);
  sessionStorage.removeItem(KEY_CASE_IDS);
  sessionStorage.removeItem(KEY_PROCESSED_DATA);
  sessionStorage.removeItem(KEY_PROCESSOR_DRAFT);
}

/**
 * Clear only temporary processor draft state.
 * Use when user completes visualization flow and draft is no longer needed.
 */
export function clearProcessorDraft(): void {
  console.info('[GraphSession] Clearing processor draft');
  sessionStorage.removeItem(KEY_PROCESSOR_DRAFT);
}
