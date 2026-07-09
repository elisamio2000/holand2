import type { CaseDetail } from '@/types/case-importer.types';

export interface HeatmapCell {
  day: string;
  hour: number;
  value: number;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function bucketTimestamp(ts: number): { day: string; hour: number } | null {
  const ms = ts < 1e12 ? ts * 1000 : ts;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return { day: DAYS[d.getDay()], hour: d.getHours() };
}

/** Build activity heatmap from detail files and logs (no mock). */
export function buildActivityHeatmapFromDetail(
  detail: CaseDetail | null
): HeatmapCell[] {
  const grid = new Map<string, number>();

  const bump = (ts: number) => {
    const b = bucketTimestamp(ts);
    if (!b) return;
    const key = `${b.day}-${b.hour}`;
    grid.set(key, (grid.get(key) ?? 0) + 1);
  };

  if (detail) {
    if (detail.updated_at) bump(detail.updated_at);
    if (detail.created_at) bump(detail.created_at);

    const files = Array.isArray(detail.files) ? detail.files : [];
    for (const f of files) {
      const ts =
        (f as { updated_at?: number }).updated_at ??
        (f as { created_at?: number }).created_at;
      if (typeof ts === 'number') bump(ts);
    }

    const logs = Array.isArray(detail.logs) ? detail.logs : [];
    for (const log of logs) {
      const ts = (log as { timestamp?: number; created_at?: number }).timestamp ??
        (log as { created_at?: number }).created_at;
      if (typeof ts === 'number') bump(ts);
    }
  }

  const cells: HeatmapCell[] = [];
  for (const day of DAYS) {
    for (let hour = 0; hour < 24; hour++) {
      cells.push({
        day,
        hour,
        value: grid.get(`${day}-${hour}`) ?? 0,
      });
    }
  }
  return cells;
}

export function heatmapHasActivity(cells: HeatmapCell[]): boolean {
  return cells.some((c) => c.value > 0);
}
