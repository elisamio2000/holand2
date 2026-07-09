import { describe, expect, it } from 'vitest';
import {
  formatGpuHistoryWindowLabel,
  parseGpuHistory,
} from '../components/node-gpu-history-chart';

const t = (key: string, options?: Record<string, unknown>) => {
  if (key === 'adminNodes.gpuHistoryWindow1m') return 'Last ~1 minute';
  if (key === 'adminNodes.gpuHistoryWindow5m') return 'Last ~5 minutes';
  if (options?.count) return `Last ~${options.count} minutes`;
  return key;
};

describe('formatGpuHistoryWindowLabel', () => {
  it('labels short spans as ~1 minute', () => {
    const series = parseGpuHistory([
      { ts: 1_782_651_180, snapshot: { summary: { used_vram_mb: 100 } } },
      { ts: 1_782_651_230, snapshot: { summary: { used_vram_mb: 110 } } },
    ]);
    expect(formatGpuHistoryWindowLabel(series, t)).toBe('Last ~1 minute');
  });

  it('labels longer spans as ~5 minutes', () => {
    const series = parseGpuHistory([
      { ts: 1_782_651_180, snapshot: { summary: { used_vram_mb: 100 } } },
      { ts: 1_782_651_380, snapshot: { summary: { used_vram_mb: 110 } } },
    ]);
    expect(formatGpuHistoryWindowLabel(series, t)).toBe('Last ~5 minutes');
  });
});

describe('parseGpuHistory agent ring buffer', () => {
  it('unwraps nested snapshot with epoch ts', () => {
    const rows = [
      {
        ts: 1782651180.15,
        snapshot: {
          summary: { used_vram_mb: 1062, total_vram_mb: 16303 },
          devices: [
            {
              name: 'NVIDIA GeForce RTX 5080',
              memory_used_mb: 1062,
              'utilization.gpu': '10',
            },
          ],
        },
      },
      {
        ts: 1782651182.15,
        snapshot: {
          summary: { used_vram_mb: 1189, total_vram_mb: 16303 },
          devices: [{ memory_used_mb: 1189, 'utilization.gpu': '11' }],
        },
      },
    ];
    const series = parseGpuHistory(rows);
    expect(series).toHaveLength(2);
    expect(series[0]?.memory_used_mb).toBe(1062);
    expect(series[0]?.utilization_pct).toBe(10);
    expect(series[0]?.tsLabel).not.toMatch(/^#/);
    expect(series[0]?.gpu0_mb).toBe(1062);
    expect(series[1]?.memory_used_mb).toBe(1189);
  });
});
