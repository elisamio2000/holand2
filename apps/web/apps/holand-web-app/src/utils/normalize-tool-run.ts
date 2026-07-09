// ============================================
// Tool Run Normalizer — Centralized schema normalization
// Single function to normalize tool_runs from any backend format
// to the frontend ToolRunInfo contract.
//
// ⚠️ WORKAROUND: This module exists because backend sends tool_runs
// in 3+ different schemas (SSE, done event, storage API). When backend
// standardizes to a single schema, this normalizer can be simplified
// to a direct mapping. See: v0.18.0_backend-requirements-audit.md §3
// ============================================

import type { ToolRunInfo, ToolStatus, StorageToolRun, ToolCallItem, ToolResultItem } from '@/types/chat.types';

// ==========================================
// Raw Tool Run — Union of all backend formats
// ==========================================

/**
 * Raw tool run shape from any backend source.
 *
 * Backend sends tool runs in multiple formats:
 * - SSE `tool_end`: `{ tool_name, args, result }`
 * - SSE `done`: `{ tool_id/tool_name, inputs/args, output/result }`
 * - Storage API: `{ tool_id, inputs, output, elapsed_ms }`
 *
 * ⚠️ WORKAROUND — this type covers all known backend shapes.
 * Remove when backend uses a single consistent schema.
 */
export interface RawToolRun {
  tool_id?: string;
  tool_name?: string;
  args?: Record<string, unknown>;
  inputs?: Record<string, unknown>;
  input?: Record<string, unknown>;
  result?: Record<string, unknown> | string;
  output?: Record<string, unknown> | string | null;
  step?: number;
  status?: ToolStatus;
  ok?: boolean;
  execution_time?: number;
  elapsed_ms?: number;
  error?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

// ==========================================
// Normalization Functions
// ==========================================

/**
 * Normalize a raw tool run (any backend format) to ToolRunInfo.
 *
 * Handles field name variations across 3 backend sources:
 * - `tool_id` vs `tool_name` → `tool_id`
 * - `args` vs `inputs` vs `input` → `args`
 * - `result` vs `output` → `result`
 * - `elapsed_ms` (ms) vs `execution_time` (sec) → `execution_time` (sec)
 * - `status` vs `ok` field → `status`
 *
 * ⚠️ WORKAROUND for backend schema inconsistency (audit items §5, §9, §11).
 * When backend standardizes to a single schema, simplify this to direct mapping.
 *
 * @param raw - Tool run in any backend format
 * @returns Normalized ToolRunInfo for frontend rendering
 *
 * @example
 * ```ts
 * // From SSE done event (output/inputs format)
 * normalizeToolRun({ tool_name: 'search', inputs: {q: 'test'}, output: {...} })
 * // → { tool_id: 'search', args: {q: 'test'}, result: {...}, status: 'success' }
 * ```
 */
export function normalizeToolRun(raw: RawToolRun): ToolRunInfo {
  // ── Tool identifier ──
  const tool_id = (raw.tool_id ?? raw.tool_name ?? 'unknown') as string;

  // ── Arguments: prefer `args` over `inputs` over `input` ──
  const args = (raw.args ?? raw.inputs ?? raw.input) as Record<string, unknown> | undefined;

  // ── Result: prefer `result` over `output` ──
  const rawResult = raw.result ?? raw.output;
  const result: Record<string, unknown> | string | undefined =
    rawResult != null
      ? (typeof rawResult === 'string' ? rawResult : rawResult as Record<string, unknown>)
      : undefined;

  // ── Status: prefer explicit `status`, fall back to `ok` field or result presence ──
  const status: ToolStatus =
    raw.status ??
    (raw.ok === false ? 'error' : undefined) ??
    (result != null ? 'success' : 'error');

  // ── Execution time: `execution_time` (seconds) or `elapsed_ms` / 1000 ──
  const execution_time =
    raw.execution_time != null
      ? raw.execution_time
      : raw.elapsed_ms != null
        ? raw.elapsed_ms / 1000
        : undefined;

  return {
    tool_id,
    args,
    result,
    step: raw.step,
    status,
    execution_time,
    error: (raw.error as string | null) ?? null,
    started_at: (raw.started_at ?? raw.created_at) as string | null | undefined,
    completed_at: (raw.completed_at ?? raw.created_at) as string | null | undefined,
  };
}

/**
 * Normalize a StorageToolRun (from GET /storage/tool-runs) to ToolRunInfo.
 *
 * Thin wrapper around `normalizeToolRun` for type safety with the
 * `StorageToolRun` interface.
 *
 * ⚠️ WORKAROUND — see normalizeToolRun documentation.
 *
 * @param run - StorageToolRun from backend storage API
 * @returns Normalized ToolRunInfo for frontend rendering
 *
 * @example
 * ```ts
 * const toolRuns = storageRuns.map(normalizeStorageToolRun);
 * ```
 */
export function normalizeStorageToolRun(run: StorageToolRun): ToolRunInfo {
  return normalizeToolRun({
    tool_id: run.tool_id,
    inputs: run.inputs,
    output: run.output,
    step: run.step,
    elapsed_ms: run.elapsed_ms,
    created_at: run.created_at,
  });
}

/**
 * Normalize an array of raw tool runs (from SSE done event).
 *
 * The `done` SSE event includes a `tool_runs` array in a format that
 * may differ from both the SSE stream format and the storage format.
 *
 * ⚠️ WORKAROUND — see normalizeToolRun documentation.
 *
 * @param rawRuns - Array of raw tool run objects from done event
 * @returns Array of normalized ToolRunInfo
 *
 * @example
 * ```ts
 * const normalized = normalizeDoneEventToolRuns(finalResponse.tool_runs);
 * ```
 */
export function normalizeDoneEventToolRuns(
  rawRuns: Array<Record<string, unknown>>
): ToolRunInfo[] {
  return rawRuns.map((raw) => normalizeToolRun(raw as RawToolRun));
}

/**
 * Convert backend ToolCallItem[] + ToolResultItem[] to frontend ToolRunInfo[].
 *
 * Backend now stores tool_calls and tool_results as separate arrays inside
 * each MessageResponse. This function pairs them by matching call_id/name
 * and produces the unified ToolRunInfo format that UI components expect.
 *
 * Matching strategy:
 * 1. If both call and result have ids → match by id
 * 2. Else match by name + step number
 * 3. Unmatched calls → ToolRunInfo with no result (status: 'error')
 * 4. Unmatched results → standalone ToolRunInfo
 *
 * @param calls - Tool calls from MessageResponse.tool_calls
 * @param results - Tool results from MessageResponse.tool_results
 * @returns Array of normalized ToolRunInfo for frontend rendering
 *
 * @example
 * ```ts
 * const toolRuns = normalizeToolCallsToRuns(msg.tool_calls, msg.tool_results);
 * ```
 */
export function normalizeToolCallsToRuns(
  calls: ToolCallItem[],
  results: ToolResultItem[]
): ToolRunInfo[] {
  const runs: ToolRunInfo[] = [];

  // WHY: Index results by id for O(1) lookup when matching with calls.
  // Falls back to name-based matching if ids are missing.
  const resultById = new Map<string, ToolResultItem>();
  const resultByName = new Map<string, ToolResultItem[]>();
  const matchedResultIds = new Set<string>();

  for (const r of results) {
    if (r.id) resultById.set(r.id, r);
    const name = r.name ?? r.data?.tool_id ?? 'unknown';
    if (!resultByName.has(name)) resultByName.set(name, []);
    resultByName.get(name)!.push(r);
  }

  // Match each call with its result
  for (const call of calls) {
    let matchedResult: ToolResultItem | undefined;

    // Strategy 1: Match by call id
    if (call.id && resultById.has(call.id)) {
      matchedResult = resultById.get(call.id);
    }

    // Strategy 2: Match by name + step
    if (!matchedResult) {
      const candidates = resultByName.get(call.name) ?? [];
      matchedResult = candidates.find(
        (r) => !matchedResultIds.has(r.id ?? '') &&
          (call.step == null || r.step == null || call.step === r.step)
      );
    }

    if (matchedResult?.id) matchedResultIds.add(matchedResult.id);

    // Extract result content for display
    const resultData = matchedResult?.data?.result;
    const llmSummary = resultData?.channels?.llm;
    const resultContent: Record<string, unknown> | string | undefined =
      llmSummary != null
        ? (typeof llmSummary === 'string' ? llmSummary : llmSummary)
        : resultData?.data != null
          ? resultData.data
          : undefined;

    const status: ToolStatus =
      matchedResult == null
        ? 'error'
        : matchedResult.ok
          ? 'success'
          : 'error';

    runs.push({
      tool_id: call.name,
      args: call.arguments ?? undefined,
      result: resultContent,
      step: call.step ?? matchedResult?.step ?? undefined,
      status,
      execution_time: matchedResult?.execution_time ?? undefined,
      error: matchedResult?.error ?? matchedResult?.data?.error ?? null,
    });
  }

  // Add unmatched results as standalone entries
  for (const r of results) {
    if (r.id && matchedResultIds.has(r.id)) continue;
    if (!r.id && calls.some((c) => c.name === (r.name ?? r.data?.tool_id))) continue;

    const resultData = r.data?.result;
    const llmSummary = resultData?.channels?.llm;
    const resultContent: Record<string, unknown> | string | undefined =
      llmSummary != null
        ? (typeof llmSummary === 'string' ? llmSummary : llmSummary)
        : resultData?.data != null
          ? resultData.data
          : undefined;

    runs.push({
      tool_id: r.name ?? r.data?.tool_id ?? 'unknown',
      result: resultContent,
      step: r.step ?? undefined,
      status: r.ok ? 'success' : 'error',
      execution_time: r.execution_time ?? undefined,
      error: r.error ?? r.data?.error ?? null,
    });
  }

  return runs;
}
