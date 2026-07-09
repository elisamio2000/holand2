import { describe, expect, it } from 'vitest';
import {
  bootstrapTokenStatus,
  filterGpuHistoryWindow,
  parseDeployStreamMessage,
  parseGpuHistoryPoint,
  parseHistoryTimestampMs,
} from '../admin-remote-nodes.service';

describe('parseHistoryTimestampMs', () => {
  it('parses epoch seconds', () => {
    const ms = parseHistoryTimestampMs(1_700_000_000);
    expect(ms).toBe(1_700_000_000_000);
  });

  it('parses ISO strings', () => {
    const ms = parseHistoryTimestampMs('2024-06-29T09:30:25.616Z');
    expect(ms).toBe(Date.parse('2024-06-29T09:30:25.616Z'));
  });
});

describe('parseGpuHistoryPoint', () => {
  it('normalizes memory_used_mb and ts', () => {
    const point = parseGpuHistoryPoint({
      ts: 1_700_000_000,
      memory_used_mb: 12251,
    });
    expect(point).not.toBeNull();
    expect(point!.memoryUsedMb).toBe(12251);
    expect(point!.label).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('reads nested gpu fields', () => {
    const point = parseGpuHistoryPoint({
      timestamp: '2024-06-29T09:30:25.616Z',
      gpu: { memory_used_mb: 8000, utilization_pct: 42 },
    });
    expect(point?.memoryUsedMb).toBe(8000);
    expect(point?.utilizationPct).toBe(42);
  });

  it('reads per-gpu indexed fields from backend history rows', () => {
    const point = parseGpuHistoryPoint({
      ts: 1_700_000_000,
      gpu0_mb: 1027,
      gpu0_util_pct: 18,
    });
    expect(point?.memoryUsedMb).toBe(1027);
    expect(point?.utilizationPct).toBe(18);
  });

  it('aggregates snapshot-shaped history rows with devices array', () => {
    const point = parseGpuHistoryPoint({
      ts: 1_700_000_000,
      devices: [
        { memory_used_mb: 900, utilization_pct: 12 },
        { memory_used_mb: 127, utilization_pct: 8 },
      ],
    });
    expect(point?.memoryUsedMb).toBe(1027);
    expect(point?.utilizationPct).toBe(10);
  });
});

describe('filterGpuHistoryWindow', () => {
  it('filters by window minutes', () => {
    const now = Date.now();
    const rows = [
      { ts: (now - 30_000) / 1000, memory_used_mb: 100 },
      { ts: (now - 600_000) / 1000, memory_used_mb: 200 },
    ];
    const filtered = filterGpuHistoryWindow(rows, 1);
    expect(filtered.length).toBe(1);
    expect(filtered[0].memoryUsedMb).toBe(100);
  });
});

describe('bootstrapTokenStatus', () => {
  it('detects configured token', () => {
    expect(bootstrapTokenStatus({ token_configured: true })).toBe('configured');
    expect(bootstrapTokenStatus({ NODE_TOKEN: 'abc' })).toBe('configured');
  });

  it('detects missing token', () => {
    expect(bootstrapTokenStatus({ token_configured: false })).toBe('not_configured');
  });
});

describe('parseDeployStreamMessage', () => {
  it('parses stage events', () => {
    const event = parseDeployStreamMessage(
      JSON.stringify({ type: 'stage', stage: 'container_start', message: 'Starting' })
    );
    expect(event?.type).toBe('stage');
    expect(event?.stage).toBe('container_start');
  });

  it('parses done events', () => {
    const event = parseDeployStreamMessage(
      JSON.stringify({ type: 'done', served_name: 'qwen', stage: 'ready' })
    );
    expect(event?.type).toBe('done');
    expect(event?.servedName).toBe('qwen');
  });

  it('parses log lines', () => {
    const event = parseDeployStreamMessage(
      JSON.stringify({ type: 'log', log_line: 'Loading weights...' })
    );
    expect(event?.type).toBe('log');
    expect(event?.logLine).toBe('Loading weights...');
  });
});
