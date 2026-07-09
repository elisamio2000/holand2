/** Shared types for page-level dev API requirement panels. */

export type DevApiStatus =
  | 'live'
  | 'partial'
  | 'missing'
  | 'available'
  | 'unavailable'
  | 'unknown';

export type DevGapPriority = 'P0' | 'P1' | 'P2';

/** Generic capability gap row for backend handoff tables. */
export interface CapabilityGap {
  id: string;
  capability: string;
  feWorkaround: string;
  requiredApi: string;
  feRequest: string;
  expectedResponse: string;
  acceptance: string;
  priority: DevGapPriority;
  uiSurface: string;
  resolved?: boolean;
  resolvedNote?: string;
}

/** Live API requirement row for "APIs in use" tables. */
export interface LiveApiRequirement {
  id: string;
  endpoint: string;
  status: DevApiStatus;
  group?: string;
  consumer?: string;
}

export interface LiveApiColumnLabels {
  id: string;
  endpoint: string;
  status: string;
}

export interface CapabilityGapColumnLabels {
  capability: string;
  workaround: string;
  contract: string;
  api: string;
  priority: string;
  surface: string;
  acceptance: string;
}

export interface CapabilityGapsTableLabels {
  resolved: string;
  requestSample: string;
  responseSample: string;
  expandContract: string;
  collapseContract: string;
  priority: Record<DevGapPriority, string>;
  surfaces: Record<string, string>;
}

export interface LiveApisTableLabels {
  columns: LiveApiColumnLabels;
  status: Record<string, string>;
  groups?: Record<string, string>;
}
