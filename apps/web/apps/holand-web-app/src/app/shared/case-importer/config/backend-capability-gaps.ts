// ============================================
// Case Importer — backend capability gaps for dev handoff panel
// Source of truth for gateway contract requests (FE -> BE)
// ============================================

import type { CapabilityGap } from '@/platform/dev-panels';

export type CaseImporterBackendGapPriority = 'P0' | 'P1' | 'P2';

export type CaseImporterUiSurface =
  | 'dashboard'
  | 'import'
  | 'upload'
  | 'server-path'
  | 'batch'
  | 'detail'
  | 'settings'
  | 'realtime';

export interface CaseImporterBackendCapabilityGap extends CapabilityGap {
  priority: CaseImporterBackendGapPriority;
  uiSurface: CaseImporterUiSurface;
}

/**
 * Open backend gaps derived from current case-importer FE behavior and gateway contract.
 * These rows power the dev panel handoff table and backend-requests documentation.
 */
export const CASE_IMPORTER_BACKEND_CAPABILITY_GAPS: CaseImporterBackendCapabilityGap[] = [
  {
    id: 'queue-timeout-snapshot',
    capability: 'Queue status endpoint remains responsive under load spikes',
    feWorkaround: 'Fallback polling with slower retry and stale UI hints',
    requiredApi: 'GET /import/queue/status (bounded latency profile)',
    feRequest: `GET /import/queue/status\nAuthorization: Bearer <token>\nAccept: application/json`,
    expectedResponse: `200 {\n  "status": "running",\n  "position": 0,\n  "active_jobs": 2,\n  "queued_jobs": 5\n}`,
    acceptance:
      'P95 response time <= 5s for authenticated users during normal load, no repeated 30s client timeouts',
    priority: 'P0',
    uiSurface: 'dashboard',
  },
  {
    id: 'queue-history-observability',
    capability: 'Queue endpoint exposes simple processing health counters',
    feWorkaround: 'FE infers health from transient status snapshots only',
    requiredApi:
      'GET /import/queue/status should include recent_failures_5m and avg_wait_seconds',
    feRequest: `GET /import/queue/status`,
    expectedResponse: `200 {\n  "status": "running",\n  "recent_failures_5m": 1,\n  "avg_wait_seconds": 42\n}`,
    acceptance:
      'FE can show if queue is degraded without custom heuristics or extra endpoints',
    priority: 'P1',
    uiSurface: 'dashboard',
  },
  {
    id: 'server-path-preflight',
    capability: 'Server-path import preflight validation endpoint',
    feWorkaround: 'Import call fails late after submit; no deterministic preview',
    requiredApi: 'POST /import/server-path/preflight',
    feRequest: `POST /import/server-path/preflight\n{\n  "path": "/data/cases/batch-a",\n  "recursive": true\n}`,
    expectedResponse: `200 {\n  "exists": true,\n  "readable": true,\n  "file_count": 128,\n  "estimated_bytes": 987654321\n}`,
    acceptance: 'FE validates path and shows estimated payload before enqueue/import',
    priority: 'P1',
    uiSurface: 'server-path',
  },
  {
    id: 'batch-transaction-summary',
    capability: 'Batch import result summary with deterministic per-item outcomes',
    feWorkaround: 'FE tracks each request client-side and merges partial failures manually',
    requiredApi: 'POST /import/batch returns normalized item_results[]',
    feRequest: `POST /import/batch\n{\n  "items": [\n    { "source": "server_path", "path": "/data/a" },\n    { "source": "server_path", "path": "/data/b" }\n  ]\n}`,
    expectedResponse: `200 {\n  "accepted": 2,\n  "rejected": 0,\n  "item_results": [\n    { "index": 0, "case_id": "cas_a", "status": "queued" },\n    { "index": 1, "case_id": "cas_b", "status": "queued" }\n  ]\n}`,
    acceptance: 'FE receives exact per-item backend status without reconciliation heuristics',
    priority: 'P1',
    uiSurface: 'batch',
  },
  {
    id: 'staging-session-resume-snapshot',
    capability: 'Staging session resume endpoint with server-side chunk map',
    feWorkaround: 'Client trusts local upload progress and retries uncertain offsets',
    requiredApi: 'GET /import/staging/{session_id}/resume',
    feRequest: `GET /import/staging/{session_id}/resume`,
    expectedResponse: `200 {\n  "session_id": "stg_123",\n  "files": [\n    { "file_name": "doc.pdf", "received_chunks": [0,1,2], "next_chunk": 3 }\n  ]\n}`,
    acceptance: 'Interrupted uploads resume from authoritative backend chunk state',
    priority: 'P1',
    uiSurface: 'upload',
  },
  {
    id: 'case-detail-consistency',
    capability: 'Case detail endpoint should not return 404 for list-visible case IDs',
    feWorkaround: 'Ghost-case fallback from cached list row + warning banner',
    requiredApi: 'GET /import/{case_id} consistency with GET /import/list',
    feRequest: `GET /import/list -> pick case_id\nGET /import/{case_id}`,
    expectedResponse: `200 {\n  "case_id": "cas_...",\n  "status": "analyzing",\n  "files_total": 20\n}`,
    acceptance:
      'A case returned in /import/list remains fetchable from /import/{case_id} unless explicitly deleted',
    priority: 'P0',
    uiSurface: 'detail',
  },
  {
    id: 'ws-event-schema-version',
    capability: 'WebSocket payload schema versioning for queue/case updates',
    feWorkaround: 'FE parser tolerates shape drift with defensive checks only',
    requiredApi: 'WS events include schema_version and event_type contracts',
    feRequest: `WS /import/ws/queue\nWS /import/ws/{case_id}`,
    expectedResponse: `{\n  "schema_version": "1.0",\n  "event_type": "queue_update",\n  "payload": { ... }\n}`,
    acceptance: 'FE can validate and evolve WS handlers without silent breakage',
    priority: 'P2',
    uiSurface: 'realtime',
  },
  {
    id: 'preferences-shape-contract',
    capability: 'Stable preferences schema for import defaults',
    feWorkaround: 'FE applies permissive parsing and default coercion',
    requiredApi: 'GET/PUT /import/preferences documented response schema',
    feRequest: `GET /import/preferences\nPUT /import/preferences`,
    expectedResponse: `200 {\n  "default_source": "upload",\n  "auto_embed": false,\n  "auto_store": false\n}`,
    acceptance: 'No ambiguous keys; FE form maps 1:1 to backend payload',
    priority: 'P2',
    uiSurface: 'settings',
  },
];

/** i18n key suffix under caseImporter.devRequirements.gaps.{id} */
export function caseImporterGapI18nKey(id: string): string {
  return `caseImporter.devRequirements.gaps.${id}`;
}

export function caseImporterGapsByPriority(
  priority: CaseImporterBackendGapPriority
): CaseImporterBackendCapabilityGap[] {
  return CASE_IMPORTER_BACKEND_CAPABILITY_GAPS.filter((gap) => gap.priority === priority);
}

export function caseImporterGapsBySurface(
  surface: CaseImporterUiSurface
): CaseImporterBackendCapabilityGap[] {
  return CASE_IMPORTER_BACKEND_CAPABILITY_GAPS.filter((gap) => gap.uiSurface === surface);
}
