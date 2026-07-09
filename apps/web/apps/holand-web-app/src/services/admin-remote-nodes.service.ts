// ============================================
// Admin Remote Nodes Service — GPU node ops API
// Backend: /admin/nodes/*
// ============================================

import { gatewayClient } from '@/lib/api-client';
import { AxiosError } from 'axios';
import type {
  DeployInspectResult,
  DeploySchema,
  DeploySchemaField,
  DeployStreamEvent,
  SplitDeployPayload,
} from '@/services/deploy-schema-types';
import {
  DEPLOY_TOP_LEVEL_KEYS,
} from '@/services/deploy-schema-types';

export type { DeployStreamEvent } from '@/services/deploy-schema-types';

const LOG_TAG = '[AdminRemoteNodesService]';

export interface RemoteNodeGpuSnapshot {
  vendor?: string;
  devices?: Array<Record<string, unknown>>;
  device_nodes?: Array<Record<string, unknown>>;
  summary?: Record<string, unknown>;
  device_count?: number;
  [key: string]: unknown;
}

export interface RemoteDeployedModel {
  name: string;
  served_name?: string;
  storage_path?: string;
  runtime?: string;
  task?: string;
  port?: number;
  is_active?: boolean;
  running?: boolean;
  container_status?: string;
  status?: string;
  logical_id?: string;
  inference_url?: string;
  container_name?: string;
  vram_used_mb?: number | null;
  vram_source?: string;
  vram_shared_container?: boolean;
  [key: string]: unknown;
}

export interface RemoteNodeContainer {
  name: string;
  status?: string;
  running?: boolean;
  [key: string]: unknown;
}

export interface RemoteNodeRow {
  id: string;
  display_name?: string;
  models_root?: string;
  has_gpu?: boolean;
  is_active?: boolean;
  online?: boolean;
  agent_url?: string;
  metadata?: {
    kind?: string;
    host?: string;
    port?: number;
    last_seen?: string;
    gpu_snapshot?: RemoteNodeGpuSnapshot;
    models_count?: number;
    models_deployed?: RemoteDeployedModel[];
    pending_models?: unknown[];
    capabilities?: string[];
    [key: string]: unknown;
  };
}

export interface ScannedModelRow {
  name: string;
  storage_path: string;
  location_category?: string;
  suggested_runtime?: string;
  suggested_task?: string;
  routing_confidence?: number;
  routing_reason?: string;
  deploy_status?: string;
}

export interface DeployRemoteModelPayload {
  storage_path: string;
  served_name?: string;
  logical_id?: string;
  runtime?: string;
  task?: string;
  gpu_memory_fraction?: number;
  is_active?: boolean;
  set_as_default?: boolean;
  bind_route?: string;
  priority?: number;
  upstream_model?: string;
  deploy_options?: Record<string, unknown>;
  process_options?: Record<string, unknown>;
}

export interface GpuDeviceSummary {
  name: string;
  vramTotal?: number;
  vramUsed?: number;
  deviceCount: number;
  displayText: string;
}

function normalizeList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['data', 'history', 'points', 'items'] as const) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

const GPU_INDEXED_MB_KEY = /^gpu\d+_mb$/i;
const GPU_INDEXED_UTIL_KEY = /^gpu\d+_(?:util(?:ization)?(?:_pct)?|util_pct)$/i;

function sumGpuIndexedMb(row: Record<string, unknown>): number {
  let sum = 0;
  for (const [key, value] of Object.entries(row)) {
    if (!GPU_INDEXED_MB_KEY.test(key)) continue;
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) sum += n;
  }
  return sum;
}

function avgGpuIndexedUtil(row: Record<string, unknown>): number | undefined {
  const values: number[] = [];
  for (const [key, value] of Object.entries(row)) {
    if (!GPU_INDEXED_UTIL_KEY.test(key)) continue;
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) values.push(n);
  }
  if (!values.length) return undefined;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function aggregateDeviceMemoryMb(devices: Record<string, unknown>[]): number {
  return devices.reduce((sum, device) => {
    const normalized = normalizeGpuDevice(device);
    return sum + (Number(normalized.memory_used_mb) || 0);
  }, 0);
}

function aggregateDeviceUtilPct(devices: Record<string, unknown>[]): number | undefined {
  const values = devices
    .map((device) => Number(normalizeGpuDevice(device).utilization_pct))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!values.length) return undefined;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export function isRemoteAgentNode(node: RemoteNodeRow): boolean {
  return node.metadata?.kind === 'remote_agent' || Boolean(node.agent_url);
}

export function formatVramMb(mb: unknown): string {
  const n = Number(mb);
  if (!n || n <= 0) return '—';
  if (n >= 1024) return `${(n / 1024).toFixed(1)} GB`;
  return `${n} MB`;
}

export function normalizeGpuStatus(raw: Record<string, unknown> | null | undefined): {
  devices: Record<string, unknown>[];
  summary: Record<string, unknown>;
} {
  if (!raw || typeof raw !== 'object') {
    return { devices: [], summary: {} };
  }
  const pick = (obj: Record<string, unknown> | undefined): Record<string, unknown> | null => {
    if (!obj || typeof obj !== 'object') return null;
    if (Array.isArray(obj.devices) && obj.devices.length) return obj;
    if (obj.device_count || obj.summary || obj.device_nodes) return obj;
    return null;
  };
  const nested =
    pick(raw.primary as Record<string, unknown> | undefined) ??
    pick(raw.nvidia as Record<string, unknown> | undefined) ??
    pick(raw.amd as Record<string, unknown> | undefined) ??
    pick(raw);
  const snap = nested ?? raw;
  const devices = (
    Array.isArray(snap.devices)
      ? snap.devices
      : Array.isArray(snap.device_nodes)
        ? snap.device_nodes
        : []
  ) as Record<string, unknown>[];
  const summary = (snap.summary as Record<string, unknown>) ?? {};
  return {
    devices: devices.map((d) => normalizeGpuDevice(d)),
    summary,
  };
}

export interface NormalizedGpuDevice {
  name: string;
  index?: number;
  memoryUsedMb?: number;
  memoryTotalMb?: number;
  memoryFreeMb?: number;
  utilizationPct?: number;
  temperatureC?: number;
  powerW?: number;
  powerLimitW?: number;
  driverVersion?: string;
  fanSpeedPct?: number;
  clockMhz?: number;
}

/** Map nvidia-smi / agent field names to a stable UI shape. */
export function normalizeGpuDevice(dev: Record<string, unknown>): Record<string, unknown> {
  const out = { ...dev };
  const util = Number(
    dev.utilization_pct ?? dev['utilization.gpu'] ?? dev.gpu_utilization ?? dev.utilization
  );
  if (util > 0) out.utilization_pct = util;
  const tempRaw = dev.temperature_c ?? dev['temperature.gpu'] ?? dev.temperature;
  const temp = Number(tempRaw);
  if (temp > 0 && String(tempRaw) !== 'N/A') out.temperature_c = temp;
  const power = Number(dev.power_w ?? dev['power.draw'] ?? dev.power_draw_w);
  if (power > 0) out.power_w = power;
  const used = Number(dev.memory_used_mb ?? dev['memory.used'] ?? dev.used_vram_mb);
  const total = Number(dev.memory_total_mb ?? dev['memory.total'] ?? dev.total_vram_mb);
  if (used > 0) out.memory_used_mb = used;
  if (total > 0) out.memory_total_mb = total;
  const free = Number(dev.memory_free_mb ?? dev['memory.free'] ?? dev.free_vram_mb);
  if (free > 0) out.memory_free_mb = free;
  const idx = dev.index ?? dev.gpu_index;
  if (idx != null && idx !== '') out.index = idx;
  const fan = Number(dev.fan_speed_pct ?? dev['fan.speed'] ?? dev.fan_speed);
  if (fan > 0) out.fan_speed_pct = fan;
  const clock = Number(dev.clock_mhz ?? dev['clocks.gr'] ?? dev.clock_graphics_mhz);
  if (clock > 0) out.clock_mhz = clock;
  const powerLimit = Number(dev.power_limit_w ?? dev['power.limit'] ?? dev.power_limit);
  if (powerLimit > 0) out.power_limit_w = powerLimit;
  if (dev.driver_version) out.driver_version = dev.driver_version;
  return out;
}

export function normalizedGpuDeviceView(dev: Record<string, unknown>, index: number): NormalizedGpuDevice {
  const normalized = normalizeGpuDevice(dev);
  return {
    name: String(normalized.name ?? normalized.product_name ?? normalized.model ?? `GPU ${index}`),
    index: normalized.index != null ? Number(normalized.index) : index,
    memoryUsedMb: Number(normalized.memory_used_mb) || undefined,
    memoryTotalMb: Number(normalized.memory_total_mb) || undefined,
    memoryFreeMb: Number(normalized.memory_free_mb) || undefined,
    utilizationPct: Number(normalized.utilization_pct) || undefined,
    temperatureC: Number(normalized.temperature_c) || undefined,
    powerW: Number(normalized.power_w) || undefined,
    powerLimitW: Number(normalized.power_limit_w) || undefined,
    driverVersion: normalized.driver_version ? String(normalized.driver_version) : undefined,
    fanSpeedPct: Number(normalized.fan_speed_pct) || undefined,
    clockMhz: Number(normalized.clock_mhz) || undefined,
  };
}

export function deployedModelIsRunning(row: RemoteDeployedModel): boolean {
  if (row.running === true) return true;
  if (row.running === false) return false;
  const status = String(row.container_status ?? row.status ?? '').toLowerCase();
  if (status === 'running') return true;
  if (row.is_active === false) return false;
  return Boolean(row.inference_url);
}

export function partitionDeployedModels(rows: RemoteDeployedModel[]): {
  running: RemoteDeployedModel[];
  stopped: RemoteDeployedModel[];
} {
  const running: RemoteDeployedModel[] = [];
  const stopped: RemoteDeployedModel[] = [];
  for (const row of rows) {
    if (deployedModelIsRunning(row)) running.push(row);
    else stopped.push(row);
  }
  return { running, stopped };
}

export function deployedStatusLabel(row: RemoteDeployedModel): 'running' | 'active' | 'stopped' {
  if (row.running === true || String(row.container_status ?? row.status ?? '').toLowerCase() === 'running') {
    return 'running';
  }
  if (row.is_active !== false) return 'active';
  return 'stopped';
}

export type DeployedRowActionKind = 'stop' | 'restart' | 'remove' | 'logs' | 'probe';

/** Context-aware action buttons per deploy status (unit-tested). */
export function deployedRowActions(
  status: ReturnType<typeof deployedStatusLabel>,
  options?: { includeProbe?: boolean }
): DeployedRowActionKind[] {
  if (status === 'running') return ['stop', 'logs', 'remove'];
  const base: DeployedRowActionKind[] = ['restart', 'logs', 'remove'];
  if (options?.includeProbe) base.push('probe');
  return base;
}

/** Hide redundant scan badges when every row is `discovered`. */
export function scanRowBadge(
  deployStatus: string | undefined,
  allStatuses: string[]
): string | undefined {
  const status = String(deployStatus ?? '').trim();
  if (!status || status === 'discovered') return undefined;
  if (allStatuses.length > 1 && allStatuses.every((s) => s === allStatuses[0])) return undefined;
  return status;
}

export function formatModelVramSub(
  row: RemoteDeployedModel,
  nodeVramTotalMb?: number
): string | null {
  const direct = Number(row.vram_mb ?? row.memory_used_mb ?? row.gpu_memory_mb);
  if (direct > 0) return formatVramMb(direct);
  const fraction = Number(row.gpu_memory_fraction);
  if (fraction > 0 && nodeVramTotalMb && nodeVramTotalMb > 0) {
    const mb = Math.round(fraction * nodeVramTotalMb);
    return `~${formatVramMb(mb)} (${Math.round(fraction * 100)}%)`;
  }
  return null;
}

/** Measured VRAM only (nvidia-smi via agent) — never estimated from gpu_memory_fraction. */
export function measuredModelVramLabel(
  row: RemoteDeployedModel,
  snapshot: NodeGpuStreamSnapshot | null,
  isRunning: boolean
): string | null {
  if (!isRunning) return null;
  const direct = Number(row.vram_used_mb);
  if (direct > 0) return formatVramMb(direct);
  const key = String(row.served_name ?? row.name ?? '').trim();
  const fromStream = key && snapshot?.model_vram ? Number(snapshot.model_vram[key]) : 0;
  if (fromStream > 0) return formatVramMb(fromStream);
  return null;
}

export function deployedModelRuntimeLabel(row: RemoteDeployedModel): string | null {
  const runtime = String(row.runtime ?? '').trim();
  if (!runtime) return null;
  return runtime;
}

/** Agent state key for activate/deactivate — not the OpenAI served id. */
export function deployedModelAgentName(row: RemoteDeployedModel): string {
  return String(row.name ?? row.served_name ?? '').trim();
}

export interface NodeGpuStreamSnapshot {
  type?: string;
  ts?: string;
  devices: Record<string, unknown>[];
  summary: Record<string, unknown>;
  consumers?: Record<string, unknown>[];
  processes?: Record<string, unknown>[];
  compute_processes?: Record<string, unknown>[];
  model_vram?: Record<string, number>;
  driver_version?: string;
  cuda_version?: string;
  [key: string]: unknown;
}

export function parseGpuStreamMessage(raw: string): NodeGpuStreamSnapshot | null {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (data.type === 'error') return null;
    const payload =
      data.type === 'gpu_snapshot' && data.devices
        ? data
        : data.type === 'gpu_snapshot' && data.payload
          ? (data.payload as Record<string, unknown>)
          : data;
    const { devices, summary } = normalizeGpuStatus(payload as Record<string, unknown>);
    if (!devices.length && !Object.keys(summary).length) return null;
    return {
      ...payload,
      devices,
      summary,
      consumers: Array.isArray(payload.consumers)
        ? (payload.consumers as Record<string, unknown>[])
        : Array.isArray(payload.compute_processes)
          ? (payload.compute_processes as Record<string, unknown>[])
          : Array.isArray(payload.processes)
            ? (payload.processes as Record<string, unknown>[])
            : undefined,
      model_vram:
        payload.model_vram && typeof payload.model_vram === 'object'
          ? (payload.model_vram as Record<string, number>)
          : undefined,
      ts: String(payload.ts ?? data.ts ?? new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

export interface GpuHistoryPoint {
  tsMs: number;
  label: string;
  memoryUsedMb: number;
  utilizationPct?: number;
}

/** Normalize epoch seconds/ms, ISO strings, or numeric strings to milliseconds. */
export function parseHistoryTimestampMs(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw > 1e12 ? raw : raw > 1e9 ? raw * 1000 : raw;
  }
  const text = String(raw).trim();
  if (!text) return null;
  const num = Number(text);
  if (Number.isFinite(num)) {
    return num > 1e12 ? num : num > 1e9 ? num * 1000 : num;
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseGpuHistoryPoint(row: Record<string, unknown>): GpuHistoryPoint | null {
  const tsMs =
    parseHistoryTimestampMs(row.timestamp) ??
    parseHistoryTimestampMs(row.ts) ??
    parseHistoryTimestampMs(row.recorded_at) ??
    parseHistoryTimestampMs(row.time);
  const gpu = row.gpu as Record<string, unknown> | undefined;
  const rowSummary =
    row.summary && typeof row.summary === 'object'
      ? (row.summary as Record<string, unknown>)
      : undefined;
  const { devices, summary: snapshotSummary } = normalizeGpuStatus(row);
  const summary = rowSummary ?? snapshotSummary;
  const indexedMb = sumGpuIndexedMb(row);
  const indexedUtil = avgGpuIndexedUtil(row);
  const deviceMb = devices.length ? aggregateDeviceMemoryMb(devices) : 0;
  const deviceUtil = devices.length ? aggregateDeviceUtilPct(devices) : undefined;
  const memory =
    Number(row.memory_used_mb) ||
    Number(row.used_vram_mb) ||
    Number(row.memory_used) ||
    Number(summary?.used_vram_mb) ||
    Number(summary?.used_vram) ||
    Number(gpu?.memory_used_mb) ||
    Number(gpu?.used_vram_mb) ||
    indexedMb ||
    deviceMb ||
    0;
  const utilization =
    Number(row.utilization_pct) ||
    Number(row.utilization) ||
    Number(row.gpu_utilization) ||
    Number(gpu?.utilization_pct) ||
    indexedUtil ||
    deviceUtil ||
    undefined;
  if (tsMs == null && !memory && !utilization) return null;
  const effectiveTs = tsMs ?? Date.now();
  const d = new Date(effectiveTs);
  const label = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  return {
    tsMs: effectiveTs,
    label,
    memoryUsedMb: memory,
    utilizationPct: utilization && utilization > 0 ? utilization : undefined,
  };
}

export function filterGpuHistoryWindow(
  rows: Record<string, unknown>[],
  windowMinutes: number
): GpuHistoryPoint[] {
  const points = rows
    .map((row) => parseGpuHistoryPoint(row))
    .filter((p): p is GpuHistoryPoint => p != null)
    .sort((a, b) => a.tsMs - b.tsMs);
  if (!windowMinutes || windowMinutes <= 0) return points;
  const cutoff = Date.now() - windowMinutes * 60 * 1000;
  return points.filter((p) => p.tsMs >= cutoff);
}

export type BootstrapTokenStatus = 'configured' | 'not_configured' | 'unknown';

export function bootstrapTokenStatus(
  bootstrap: Record<string, unknown> | null | undefined
): BootstrapTokenStatus {
  if (!bootstrap || typeof bootstrap !== 'object') return 'unknown';
  const explicit =
    bootstrap.token_configured ??
    bootstrap.node_token_configured ??
    bootstrap.has_node_token;
  if (explicit === true) return 'configured';
  if (explicit === false) return 'not_configured';
  const token =
    bootstrap.NODE_TOKEN ??
    bootstrap.node_token ??
    bootstrap.REMOTE_NODE_TOKEN ??
    bootstrap.remote_node_token;
  if (typeof token === 'string' && token.trim().length > 0) return 'configured';
  if (token === null || token === '') return 'not_configured';
  return 'unknown';
}

const DEPLOY_STAGE_KEYS = new Set([
  'accepted',
  'resolved',
  'preflight',
  'container_start',
  'container_log',
  'probe',
  'agent_ready',
  'mother_verify',
  'registry',
  'ready',
  'failed',
]);

export function parseDeployStreamMessage(raw: string): DeployStreamEvent | null {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const type = String(data.type ?? data.event ?? '').toLowerCase();
    const stageRaw = String(data.stage ?? data.deploy_stage ?? data.status ?? '').toLowerCase();
    const stage = DEPLOY_STAGE_KEYS.has(stageRaw) ? stageRaw : stageRaw || undefined;

    if (type === 'error' || stage === 'failed' || data.ok === false) {
      return {
        type: 'error',
        stage: stage ?? 'failed',
        message: String(data.message ?? data.error ?? data.detail ?? 'Deploy failed'),
        ok: false,
        jobId: data.job_id ? String(data.job_id) : undefined,
        raw: data,
      };
    }

    if (type === 'done' || type === 'complete' || stage === 'ready') {
      return {
        type: 'done',
        stage: 'ready',
        ok: true,
        servedName: data.served_name ? String(data.served_name) : undefined,
        jobId: data.job_id ? String(data.job_id) : undefined,
        message: typeof data.message === 'string' ? data.message : undefined,
        raw: data,
      };
    }

    const logLine =
      typeof data.log_line === 'string'
        ? data.log_line
        : typeof data.log === 'string'
          ? data.log
          : typeof data.line === 'string'
            ? data.line
            : undefined;

    if (logLine || type === 'log' || type === 'container_log' || stage === 'container_log') {
      return {
        type: 'log',
        stage: stage ?? 'container_log',
        logLine,
        raw: data,
      };
    }

    if (stage || type === 'stage' || type === 'progress') {
      return {
        type: 'stage',
        stage,
        message: typeof data.message === 'string' ? data.message : undefined,
        ok: data.ok !== false,
        jobId: data.job_id ? String(data.job_id) : undefined,
        raw: data,
      };
    }

    return { type: 'progress', raw: data };
  } catch {
    return null;
  }
}

export interface DeployFailureDetails {
  message: string;
  logs?: string;
  errorCode?: string;
  deployStatus?: string;
}

const DEPLOY_TIMEOUT_VLLM_MS = 10 * 60 * 1000;
const DEPLOY_TIMEOUT_DIFFUSION_MS = 10 * 60 * 1000;
const DEPLOY_TIMEOUT_TRITON_MS = 5 * 60 * 1000;
const DEPLOY_TIMEOUT_DEFAULT_MS = 3 * 60 * 1000;

export function resolveDeployTimeoutMs(body: DeployRemoteModelPayload): number {
  const rt = String(body.runtime ?? '').toLowerCase();
  if (rt === 'vllm-omni' || rt === 'vllm-openai') return DEPLOY_TIMEOUT_VLLM_MS;
  if (rt === 'diffusion') return DEPLOY_TIMEOUT_DIFFUSION_MS;
  if (rt === 'triton') return DEPLOY_TIMEOUT_TRITON_MS;
  return DEPLOY_TIMEOUT_DEFAULT_MS;
}

function pickHint(obj: Record<string, unknown> | undefined): string | undefined {
  if (!obj) return undefined;
  const diagnosis = obj.diagnosis as Record<string, unknown> | undefined;
  const verification = obj.verification as Record<string, unknown> | undefined;
  const mother = obj.mother as Record<string, unknown> | undefined;
  return (
    (typeof obj.hint === 'string' ? obj.hint : undefined) ??
    (typeof diagnosis?.message_fa === 'string' ? diagnosis.message_fa : undefined) ??
    (typeof diagnosis?.message === 'string' ? diagnosis.message : undefined) ??
    (typeof verification?.hint === 'string' ? verification.hint : undefined) ??
    (typeof mother?.hint === 'string' ? mother.hint : undefined)
  );
}

function pickLogs(obj: Record<string, unknown> | undefined): string | undefined {
  if (!obj) return undefined;
  const tail = obj.logs_tail ?? obj.logs;
  if (typeof tail === 'string' && tail.trim()) return tail.trim();
  return undefined;
}

function pickErrorCode(obj: Record<string, unknown> | undefined): string | undefined {
  if (!obj?.error) return undefined;
  return String(obj.error);
}

/** Extract structured deploy failure from gateway/agent JSON payloads. */
export function parseDeployFailurePayload(data: unknown): DeployFailureDetails | null {
  if (!data || typeof data !== 'object') return null;
  const root = data as Record<string, unknown>;
  let detail: unknown = root.detail ?? root.message ?? root.error;
  if (typeof detail === 'string') {
    const detailText = detail;
    try {
      const parsed = JSON.parse(detailText);
      detail = (parsed as Record<string, unknown>).detail ?? parsed;
    } catch {
      if (detailText.trim()) {
        return { message: detailText.trim() };
      }
    }
  }

  const layers: Record<string, unknown>[] = [];
  if (detail && typeof detail === 'object') layers.push(detail as Record<string, unknown>);
  if (root.agent && typeof root.agent === 'object') layers.push(root.agent as Record<string, unknown>);
  layers.push(root);

  const agent =
    (detail && typeof detail === 'object' ? (detail as Record<string, unknown>).agent : undefined) ??
    root.agent;
  const agentObj = agent && typeof agent === 'object' ? (agent as Record<string, unknown>) : undefined;
  const mother =
    (detail && typeof detail === 'object' ? (detail as Record<string, unknown>).mother : undefined) ??
    root.mother ??
    root.mother_verification;
  const motherObj = mother && typeof mother === 'object' ? (mother as Record<string, unknown>) : undefined;

  const hints = layers.map(pickHint).filter(Boolean) as string[];
  const errors = [
    ...layers.map(pickErrorCode).filter(Boolean),
    typeof root.error === 'string' ? root.error : undefined,
  ].filter(Boolean) as string[];
  const logs =
    pickLogs(agentObj) ??
    pickLogs(motherObj) ??
    layers.map(pickLogs).find(Boolean);

  const deployStatus =
    typeof root.deploy_status === 'string'
      ? root.deploy_status
      : typeof agentObj?.deploy_status === 'string'
        ? agentObj.deploy_status
        : undefined;

  const messageParts = [
    deployStatus && deployStatus !== 'ready' ? `status: ${deployStatus}` : null,
    pickHint(agentObj),
    pickHint(motherObj),
    pickHint(detail && typeof detail === 'object' ? (detail as Record<string, unknown>) : undefined),
    pickErrorCode(agentObj),
    pickErrorCode(motherObj),
    pickErrorCode(detail && typeof detail === 'object' ? (detail as Record<string, unknown>) : undefined),
    ...hints,
    ...errors,
  ]
    .filter(Boolean)
    .map(String);
  const uniqueMessageParts = [...new Set(messageParts)];

  if (!uniqueMessageParts.length && typeof detail === 'string' && detail.trim()) {
    uniqueMessageParts.push(detail.trim());
  }
  if (!uniqueMessageParts.length && detail && typeof detail === 'object') {
    uniqueMessageParts.push(JSON.stringify(detail).slice(0, 800));
  }
  if (!uniqueMessageParts.length) return null;

  return {
    message: uniqueMessageParts.join(' — '),
    logs,
    errorCode: errors[0],
    deployStatus,
  };
}

export function formatDeployTransportError(error: unknown): DeployFailureDetails {
  if (error instanceof AxiosError) {
    const fromBody = parseDeployFailurePayload(error.response?.data);
    if (fromBody) return fromBody;

    if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message)) {
      return {
        message:
          'Deploy request timed out before the server responded. vLLM models can take several minutes to load — the deploy may still be running on the node. Check Admin → GPU Nodes → Running on GPU and container logs.',
        errorCode: 'client_timeout',
      };
    }
    if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
      return {
        message:
          'Network Error — browser lost connection to the API (often a client timeout during long vLLM startup). Check whether the model is already starting on the node before retrying.',
        errorCode: 'network_error',
      };
    }
    if (error.response?.status === 502) {
      const proxyDetail =
        error.response.data &&
        typeof error.response.data === 'object' &&
        typeof (error.response.data as Record<string, unknown>).details === 'string'
          ? String((error.response.data as Record<string, unknown>).details)
          : undefined;
      return {
        message: proxyDetail
          ? `Gateway proxy error (502): ${proxyDetail}`
          : 'Gateway proxy error (502) — upstream API unreachable.',
        errorCode: 'bad_gateway',
      };
    }
    return {
      message: error.message || 'Deploy request failed',
      errorCode: error.code,
    };
  }

  if (error instanceof Error) {
    const parsed = parseDeployFailurePayload(error.message);
    if (parsed) return parsed;
    return { message: error.message };
  }

  return { message: String(error ?? 'Deploy failed') };
}

export function formatDeployError(data: unknown, fallback?: string): string {
  const parsed = parseDeployFailurePayload(data);
  if (parsed?.message) return parsed.message;
  if (!data || typeof data !== 'object') return fallback ?? 'Deploy failed';
  const obj = data as Record<string, unknown>;
  if (typeof obj.message === 'string' && obj.message.trim()) return obj.message.slice(0, 500);
  return fallback ?? 'Deploy failed';
}

export function buildFormStateFromSchema(
  inspect: DeployInspectResult,
  storagePath: string,
  preserve?: Record<string, unknown>
): Record<string, unknown> {
  const schema = inspect.deploy_schema ?? {};
  const state: Record<string, unknown> = { storage_path: storagePath };

  for (const f of schema.fields ?? []) {
    if (f.default !== undefined) state[f.key] = f.default;
  }
  if (schema.defaults) Object.assign(state, schema.defaults);

  for (const [key, spec] of Object.entries(schema.process_options ?? {})) {
    if (spec && typeof spec === 'object' && 'default' in spec) {
      state[key] = (spec as DeploySchemaField).default;
    }
  }

  const detected = inspect.detected ?? {};
  if (detected.suggested_runtime) state.runtime = detected.suggested_runtime;
  if (detected.suggested_task) state.task = detected.suggested_task;
  if (detected.upstream_model) state.upstream_model = detected.upstream_model;
  if (detected.suggested_logical_id && state.logical_id == null) {
    state.logical_id = detected.suggested_logical_id;
  }

  if (preserve?.logical_id !== undefined) {
    state.logical_id = preserve.logical_id;
  }

  return state;
}

export function splitDeployPayload(
  formState: Record<string, unknown>,
  schema: DeploySchema,
  storagePath: string
): SplitDeployPayload {
  const processKeys = new Set(Object.keys(schema.process_options ?? {}));
  const topLevel: Record<string, unknown> = {
    storage_path: storagePath.trim(),
    is_active: true,
  };
  const deploy_options: Record<string, unknown> = {};
  const process_options: Record<string, unknown> = {};

  for (const key of DEPLOY_TOP_LEVEL_KEYS) {
    if (key === 'storage_path' || key === 'is_active') continue;
    const val = formState[key];
    if (val === undefined || val === '') continue;
    topLevel[key] = val;
  }

  for (const field of schema.fields ?? []) {
    const key = field.key;
    if (DEPLOY_TOP_LEVEL_KEYS.has(key)) continue;
    const val = formState[key];
    if (val === undefined || val === '') continue;
    if (processKeys.has(key)) process_options[key] = val;
    else deploy_options[key] = val;
  }

  for (const key of processKeys) {
    if (process_options[key] !== undefined) continue;
    const val = formState[key];
    if (val !== undefined && val !== '') process_options[key] = val;
  }

  return {
    topLevel,
    deploy_options: Object.keys(deploy_options).length ? deploy_options : undefined,
    process_options: Object.keys(process_options).length ? process_options : undefined,
  };
}

export function parseInspectDefaults(
  inspect: Record<string, unknown>,
  storagePath: string
): {
  served_name?: string;
  logical_id?: string;
  runtime?: string;
  task?: string;
  gpu_memory_fraction?: number;
  set_as_default?: boolean;
  bind_route?: string;
  priority?: number;
} {
  const schema = (inspect.deploy_schema ?? {}) as Record<string, unknown>;
  const fields = Array.isArray(schema.fields) ? schema.fields : [];
  const defaults: Record<string, unknown> = { storage_path: storagePath };
  for (const f of fields) {
    if (f && typeof f === 'object' && (f as Record<string, unknown>).key) {
      const field = f as Record<string, unknown>;
      defaults[String(field.key)] = field.default;
    }
  }
  const routing = (inspect.routing ?? {}) as Record<string, unknown>;
  const detected = (inspect.detected ?? inspect.identity ?? {}) as Record<string, unknown>;
  if (routing.suggested_runtime) defaults.runtime = routing.suggested_runtime;
  if (routing.suggested_task) defaults.task = routing.suggested_task;
  if (detected.suggested_runtime) defaults.runtime = detected.suggested_runtime;
  if (detected.suggested_task) defaults.task = detected.suggested_task;
  if (!defaults.served_name) {
    defaults.served_name = detected.suggested_logical_id ?? storagePath.split(/[/\\]/).pop();
  }
  if (!defaults.logical_id) {
    defaults.logical_id =
      detected.suggested_logical_id ??
      (inspect.identity as Record<string, unknown> | undefined)?.suggested_logical_id ??
      defaults.served_name;
  }
  const rt = String(defaults.runtime ?? '');
  if (rt === 'vllm-openai' && (!defaults.gpu_memory_fraction || Number(defaults.gpu_memory_fraction) < 0.5)) {
    defaults.gpu_memory_fraction = 0.75;
  }
  if (rt === 'tei' && !defaults.gpu_memory_fraction) {
    defaults.gpu_memory_fraction = 0.12;
  }
  return defaults as ReturnType<typeof parseInspectDefaults>;
}

export const adminRemoteNodesService = {
  async listRemoteNodes(options?: { live?: boolean }): Promise<RemoteNodeRow[]> {
    const live = options?.live === true;
    console.info(LOG_TAG, 'Listing remote nodes', { live });
    const res = await gatewayClient.get('/admin/nodes/remote', {
      params: { live: live ? 'true' : 'false' },
    });
    const list = normalizeList<RemoteNodeRow>(res.data);
    return list.filter(isRemoteAgentNode);
  },

  async scanNode(
    nodeId: string,
    options?: { category?: string; refresh?: boolean; visibility?: string }
  ): Promise<ScannedModelRow[]> {
    const res = await gatewayClient.get(`/admin/nodes/${encodeURIComponent(nodeId)}/scan`, {
      params: {
        category: options?.category,
        refresh: options?.refresh ? true : undefined,
        visibility:
          options?.visibility && options.visibility !== 'deployable'
            ? options.visibility
            : undefined,
      },
    });
    return normalizeList<ScannedModelRow>(res.data);
  },

  async listDeployed(
    nodeId: string,
    options?: { runningOnly?: boolean }
  ): Promise<RemoteDeployedModel[]> {
    const res = await gatewayClient.get(
      `/admin/nodes/${encodeURIComponent(nodeId)}/models/deployed`,
      {
        params: options?.runningOnly ? { running_only: true } : undefined,
      }
    );
    return normalizeList<RemoteDeployedModel>(res.data);
  },

  async listAllDeployed(nodeId: string): Promise<RemoteDeployedModel[]> {
    return this.listDeployed(nodeId, { runningOnly: false });
  },

  async startDeployJob(nodeId: string, body: DeployRemoteModelPayload) {
    console.info(LOG_TAG, 'Start async deploy', { nodeId, storage_path: body.storage_path });
    try {
      const res = await gatewayClient.post(
        `/admin/nodes/${encodeURIComponent(nodeId)}/deploy/async`,
        body,
        { timeout: 30000 }
      );
      return res.data as {
        ok?: boolean;
        job_id?: string;
        ws_url?: string;
        logical_id?: string;
        pool_warning?: string;
        [key: string]: unknown;
      };
    } catch (e) {
      if (e instanceof AxiosError && e.response?.status === 404) {
        const err = new Error(
          'Async deploy API not found (404). Restart api-gateway so it loads the latest code, then retry.'
        );
        (err as Error & { deployFailure?: DeployFailureDetails }).deployFailure = {
          message: err.message,
          errorCode: 'deploy_async_not_found',
        };
        throw err;
      }
      if (e instanceof AxiosError && e.response?.data) {
        const failure =
          parseDeployFailurePayload(e.response.data) ?? formatDeployTransportError(e);
        const err = new Error(failure.message);
        (err as Error & { deployFailure?: DeployFailureDetails }).deployFailure = failure;
        throw err;
      }
      const failure = formatDeployTransportError(e);
      const err = new Error(failure.message);
      (err as Error & { deployFailure?: DeployFailureDetails }).deployFailure = failure;
      throw err;
    }
  },

  async deployModel(nodeId: string, body: DeployRemoteModelPayload) {
    console.info(LOG_TAG, 'Deploy model', { nodeId, storage_path: body.storage_path });
    const timeout = resolveDeployTimeoutMs(body);
    try {
      const res = await gatewayClient.post(
        `/admin/nodes/${encodeURIComponent(nodeId)}/deploy`,
        body,
        { timeout }
      );
      const data = res.data as Record<string, unknown>;
      if (data?.ok === false) {
        const failure = parseDeployFailurePayload(data) ?? {
          message: formatDeployError(data),
        };
        const err = new Error(failure.message);
        (err as Error & { deployFailure?: DeployFailureDetails }).deployFailure = failure;
        throw err;
      }
      return data;
    } catch (e) {
      if (e instanceof Error && (e as Error & { deployFailure?: DeployFailureDetails }).deployFailure) {
        throw e;
      }
      if (e instanceof AxiosError && e.response?.data) {
        const failure =
          parseDeployFailurePayload(e.response.data) ??
          formatDeployTransportError(e);
        const err = new Error(failure.message);
        (err as Error & { deployFailure?: DeployFailureDetails }).deployFailure = failure;
        throw err;
      }
      const failure = formatDeployTransportError(e);
      const err = new Error(failure.message);
      (err as Error & { deployFailure?: DeployFailureDetails }).deployFailure = failure;
      throw err;
    }
  },

  async deployHashcat(nodeId: string) {
    return this.deployModel(nodeId, {
      storage_path: 'system/hashcat',
      runtime: 'hashcat',
      task: 'crack',
      served_name: 'hashcat',
      is_active: true,
    });
  },

  async toggleModel(
    nodeId: string,
    body: { name: string; is_active: boolean; storage_path?: string; served_name?: string }
  ) {
    const res = await gatewayClient.post(
      `/admin/nodes/${encodeURIComponent(nodeId)}/activate`,
      body
    );
    const data = res.data as Record<string, unknown>;
    const agent = data?.agent as Record<string, unknown> | undefined;
    if (!body.is_active && agent?.action === 'not_found') {
      throw new Error(
        `Model not found on node agent (name=${body.name}). Try refresh or use the registry name shown in node metadata.`
      );
    }
    return data;
  },

  async probeModel(nodeId: string, modelName: string) {
    const res = await gatewayClient.post(
      `/admin/nodes/${encodeURIComponent(nodeId)}/models/${encodeURIComponent(modelName)}/probe`
    );
    return res.data as { ok?: boolean; latency_ms?: number; [key: string]: unknown };
  },

  async inspectModel(nodeId: string, storagePath: string, runtime?: string) {
    const res = await gatewayClient.get(
      `/admin/nodes/${encodeURIComponent(nodeId)}/inspect`,
      {
        params: {
          storage_path: storagePath,
          runtime: runtime || undefined,
        },
      }
    );
    return res.data as DeployInspectResult;
  },

  async drainNode(nodeId: string) {
    const res = await gatewayClient.patch(
      `/admin/nodes/${encodeURIComponent(nodeId)}`,
      { drain: true }
    );
    return res.data;
  },

  async patchRemoteNode(
    nodeId: string,
    body: {
      display_name?: string;
      is_active?: boolean;
      host?: string;
      port?: number;
      drain?: boolean;
    }
  ) {
    const res = await gatewayClient.patch(
      `/admin/nodes/${encodeURIComponent(nodeId)}`,
      body
    );
    return res.data as { ok?: boolean; node?: RemoteNodeRow; drained_models?: string[] };
  },

  async registerRemoteNode(body: {
    host: string;
    port: number;
    node_id: string;
    display_name?: string;
    token?: string;
  }) {
    const res = await gatewayClient.post('/admin/nodes/remote', body);
    return res.data;
  },

  async getNodeGpu(nodeId: string) {
    const res = await gatewayClient.get(
      `/admin/nodes/${encodeURIComponent(nodeId)}/gpu`
    );
    return normalizeGpuStatus(res.data as Record<string, unknown>);
  },

  async getNodesBootstrap() {
    const res = await gatewayClient.get('/admin/nodes/bootstrap');
    return res.data as Record<string, unknown>;
  },

  async deleteRemoteNode(nodeId: string) {
    await gatewayClient.delete(`/admin/nodes/${encodeURIComponent(nodeId)}`);
  },

  async getNodeGpuHistory(nodeId: string) {
    const res = await gatewayClient.get(
      `/admin/nodes/${encodeURIComponent(nodeId)}/gpu/history`
    );
    return normalizeList<Record<string, unknown>>(res.data);
  },

  async listRemoteNodeContainers(
    nodeId: string,
    options?: { scope?: 'all' | 'inference' | 'stack' }
  ): Promise<RemoteNodeContainer[]> {
    const scope = options?.scope ?? 'all';
    const res = await gatewayClient.get(
      `/admin/nodes/${encodeURIComponent(nodeId)}/logs/containers`,
      { params: { scope } }
    );
    return normalizeList<RemoteNodeContainer>(res.data);
  },

  async getRemoteContainerLogs(
    nodeId: string,
    containerName: string,
    options?: { tail?: number }
  ) {
    const tail = options?.tail ?? 300;
    const res = await gatewayClient.get(
      `/admin/nodes/${encodeURIComponent(nodeId)}/logs/containers/${encodeURIComponent(containerName)}`,
      { params: { tail } }
    );
    return res.data as {
      logs?: string;
      lines?: string[];
      container_name?: string;
      status?: string;
      running?: boolean;
      exit_code?: number;
      [key: string]: unknown;
    };
  },

  async getRemoteModelLogs(nodeId: string, modelName: string, options?: { tail?: number }) {
    const tail = options?.tail ?? 300;
    const res = await gatewayClient.get(
      `/admin/nodes/${encodeURIComponent(nodeId)}/logs/models/${encodeURIComponent(modelName)}`,
      { params: { tail } }
    );
    return res.data as {
      logs?: string;
      container_name?: string;
      status?: string;
      running?: boolean;
      exit_code?: number;
      [key: string]: unknown;
    };
  },

  gpuSummaryFromNode(node: RemoteNodeRow): string {
    return this.gpuDeviceSummaryFromNode(node).displayText;
  },

  gpuDeviceSummaryFromNode(node: RemoteNodeRow): GpuDeviceSummary {
    const snap = node.metadata?.gpu_snapshot;
    const { devices, summary } = normalizeGpuStatus(snap as Record<string, unknown> | undefined);
    const first = devices[0] ?? {};
    const name = String(
      first.name ?? first.product_name ?? first.model ?? snap?.gpu_name ?? 'GPU'
    );
    const vramTotal = Number(
      summary.total_vram_mb ??
        first.memory_total_mb ??
        first['memory.total'] ??
        snap?.vram_total_mb ??
        0
    );
    const vramUsed = Number(
      summary.used_vram_mb ??
        first.memory_used_mb ??
        first['memory.used'] ??
        0
    );
    const deviceCount =
      Number(snap?.device_count) || devices.length || (vramTotal ? 1 : 0);
    let displayText = '—';
    if (name !== 'GPU' || deviceCount || vramTotal) {
      if (vramUsed && vramTotal) {
        displayText = `${name} ${vramUsed}/${vramTotal} MB`;
      } else if (vramTotal) {
        displayText = `${name} · ${formatVramMb(vramTotal)}`;
      } else {
        displayText = name || 'GPU';
      }
    }
    return {
      name: name || 'GPU',
      vramTotal: vramTotal || undefined,
      vramUsed: vramUsed || undefined,
      deviceCount,
      displayText,
    };
  },
};
