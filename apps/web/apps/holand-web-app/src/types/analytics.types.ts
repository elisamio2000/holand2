// ============================================
// Analytics (funnel instrumentation) types — mirrors apps/api/app/schemas.py
// ============================================

export interface FunnelEventCreateInput {
  session_id: string;
  event_name: string;
  step: string;
  duration_ms?: number;
  metadata_json?: string;
}

export interface FunnelEvent {
  id: string;
  session_id: string;
  event_name: string;
  step: string;
  duration_ms: number | null;
  created_at: string;
}

export interface FunnelStepSummary {
  step: string;
  event_count: number;
  unique_sessions: number;
  avg_duration_ms: number | null;
}

export interface FunnelSummaryResponse {
  total_sessions: number;
  steps: FunnelStepSummary[];
  drop_off_rate: Record<string, number>;
}

export interface ReportQualityStepSummary {
  step: string;
  event_count: number;
  unique_sessions: number;
  avg_duration_ms: number | null;
}

export interface ReportQualitySummaryResponse {
  total_sessions: number;
  steps: ReportQualityStepSummary[];
}
