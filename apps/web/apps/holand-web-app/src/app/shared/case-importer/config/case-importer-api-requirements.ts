// ============================================
// Case Importer API Requirements
// Live API inventory used by case-importer pages/dev panel
// ============================================

import type { CaseImporterApiHealthEndpointStatus } from '@/hooks/use-case-importer-api-health';
import type { LiveApiRequirement } from '@/platform/dev-panels';

export type CaseImporterApiRequirementStatus = 'live' | 'partial' | 'missing';

export type CaseImporterApiGroup =
  | 'queue'
  | 'cases'
  | 'import'
  | 'staging'
  | 'preferences'
  | 'realtime'
  | 'meta';

export interface CaseImporterApiRequirement extends LiveApiRequirement {
  status: CaseImporterApiRequirementStatus;
  group: CaseImporterApiGroup;
  /** When set, merged with live probe from useCaseImporterApiHealth */
  healthKey?:
    | 'queueStatus'
    | 'toolsCatalog'
    | 'preferences'
    | 'wsInfo'
    | 'frontendFlow';
}

/** Display order for grouped live API sections in dev panel. */
export const CASE_IMPORTER_API_GROUP_ORDER: CaseImporterApiGroup[] = [
  'queue',
  'cases',
  'import',
  'staging',
  'preferences',
  'realtime',
  'meta',
];

/** APIs actively used by Case Importer pages — for dev panel "APIs in use" section. */
export const CASE_IMPORTER_API_REQUIREMENTS: CaseImporterApiRequirement[] = [
  {
    id: 'queue-status',
    group: 'queue',
    endpoint: 'GET /import/queue/status',
    status: 'live',
    consumer: 'queue-status-dashboard.tsx, use-import-queue-websocket.ts',
    healthKey: 'queueStatus',
  },
  {
    id: 'queue-pause',
    group: 'queue',
    endpoint: 'POST /import/queue/pause',
    status: 'live',
    consumer: 'queue-status-dashboard.tsx',
  },
  {
    id: 'queue-resume',
    group: 'queue',
    endpoint: 'POST /import/queue/resume',
    status: 'live',
    consumer: 'queue-status-dashboard.tsx',
  },
  {
    id: 'queue-cancel',
    group: 'queue',
    endpoint: 'POST /import/queue/cancel',
    status: 'live',
    consumer: 'queue-status-dashboard.tsx',
  },
  {
    id: 'cases-list',
    group: 'cases',
    endpoint: 'GET /import/list',
    status: 'live',
    consumer: 'use-case-import-list.ts',
  },
  {
    id: 'case-detail',
    group: 'cases',
    endpoint: 'GET /import/{case_id}',
    status: 'live',
    consumer: 'case-detail-view.tsx',
  },
  {
    id: 'case-delete',
    group: 'cases',
    endpoint: 'DELETE /import/{case_id}',
    status: 'live',
    consumer: 'case-import-list.tsx, case-actions.tsx',
  },
  {
    id: 'import-folder',
    group: 'import',
    endpoint: 'POST /import',
    status: 'live',
    consumer: 'import-form.tsx',
  },
  {
    id: 'import-upload',
    group: 'import',
    endpoint: 'POST /import/upload',
    status: 'live',
    consumer: 'import-form.tsx',
  },
  {
    id: 'import-server-path',
    group: 'import',
    endpoint: 'POST /import/server-path',
    status: 'live',
    consumer: 'import-form.tsx',
  },
  {
    id: 'import-batch',
    group: 'import',
    endpoint: 'POST /import/batch',
    status: 'live',
    consumer: 'import-form.tsx',
  },
  {
    id: 'staging-create-session',
    group: 'staging',
    endpoint: 'POST /import/staging/session',
    status: 'live',
    consumer: 'staging-upload-form.tsx',
  },
  {
    id: 'staging-upload-chunk',
    group: 'staging',
    endpoint: 'PUT /import/staging/{session_id}/upload',
    status: 'live',
    consumer: 'staging-upload-form.tsx',
  },
  {
    id: 'staging-complete',
    group: 'staging',
    endpoint: 'POST /import/staging/{session_id}/complete',
    status: 'live',
    consumer: 'staging-upload-form.tsx',
  },
  {
    id: 'staging-ws',
    group: 'realtime',
    endpoint: 'WS /import/ws/staging/{session_id}',
    status: 'live',
    consumer: 'staging-upload-form.tsx',
  },
  {
    id: 'queue-ws',
    group: 'realtime',
    endpoint: 'WS /import/ws/queue',
    status: 'live',
    consumer: 'use-import-queue-websocket.ts',
  },
  {
    id: 'case-progress-ws',
    group: 'realtime',
    endpoint: 'WS /import/ws/{case_id}',
    status: 'live',
    consumer: 'use-case-progress-websocket.ts',
  },
  {
    id: 'preferences-get',
    group: 'preferences',
    endpoint: 'GET /import/preferences',
    status: 'live',
    consumer: 'import-form.tsx, case-importer-settings.tsx',
    healthKey: 'preferences',
  },
  {
    id: 'preferences-set',
    group: 'preferences',
    endpoint: 'PUT /import/preferences',
    status: 'live',
    consumer: 'case-importer-settings.tsx',
  },
  {
    id: 'tools-catalog',
    group: 'meta',
    endpoint: 'GET /import/tools',
    status: 'live',
    consumer: 'import-form.tsx',
    healthKey: 'toolsCatalog',
  },
  {
    id: 'frontend-flow',
    group: 'meta',
    endpoint: 'GET /import/frontend-flow',
    status: 'live',
    consumer: 'case-importer-dev-requirements-panel.tsx',
    healthKey: 'frontendFlow',
  },
  {
    id: 'ws-info',
    group: 'meta',
    endpoint: 'GET /import/ws-info',
    status: 'live',
    consumer: 'case-importer-dev-requirements-panel.tsx',
    healthKey: 'wsInfo',
  },
];

export function resolveLiveApiStatus(
  req: CaseImporterApiRequirement,
  health: {
    queueStatus: CaseImporterApiHealthEndpointStatus;
    toolsCatalog: CaseImporterApiHealthEndpointStatus;
    preferences: CaseImporterApiHealthEndpointStatus;
    wsInfo: CaseImporterApiHealthEndpointStatus;
    frontendFlow: CaseImporterApiHealthEndpointStatus;
  }
): CaseImporterApiHealthEndpointStatus | CaseImporterApiRequirementStatus {
  if (req.status === 'live') return 'live';
  if (!req.healthKey) return req.status;
  const probed = health[req.healthKey];
  if (probed === 'unknown') return req.status;
  return probed;
}

/** Groups requirements by domain for dev panel sections. */
export function groupCaseImporterApiRequirements(
  requirements: CaseImporterApiRequirement[] = CASE_IMPORTER_API_REQUIREMENTS
): Map<CaseImporterApiGroup, CaseImporterApiRequirement[]> {
  const map = new Map<CaseImporterApiGroup, CaseImporterApiRequirement[]>();
  for (const req of requirements) {
    const list = map.get(req.group) ?? [];
    list.push(req);
    map.set(req.group, list);
  }
  return map;
}
