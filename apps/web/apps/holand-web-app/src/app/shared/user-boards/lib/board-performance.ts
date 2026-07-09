const ENABLED =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

export function boardPerfMark(name: string): void {
  if (!ENABLED || typeof performance === 'undefined') return;
  try {
    performance.mark(`board:${name}`);
  } catch {
    // ignore
  }
}

export function boardPerfMeasure(name: string, startMark: string, endMark?: string): void {
  if (!ENABLED || typeof performance === 'undefined') return;
  try {
    performance.measure(`board:${name}`, `board:${startMark}`, endMark ? `board:${endMark}` : undefined);
  } catch {
    // ignore
  }
}
