/** Path helpers for vector shapes (normalized 0–1 coords within bbox). */

export interface PathPoint {
  x: number;
  y: number;
}

export function buildNormalizedPathFromWorldPoints(points: PathPoint[]): {
  pathD: string;
  bbox: { x: number; y: number; width: number; height: number };
} {
  if (points.length < 2) {
    return { pathD: '', bbox: { x: 0, y: 0, width: 1, height: 1 } };
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const w = Math.max(1e-6, maxX - minX);
  const h = Math.max(1e-6, maxY - minY);
  const norm = points.map((p) => ({
    x: (p.x - minX) / w,
    y: (p.y - minY) / h,
  }));
  const parts = norm.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(4)} ${p.y.toFixed(4)}`);
  parts.push('Z');
  return { pathD: parts.join(' '), bbox: { x: minX, y: minY, width: w, height: h } };
}

/** Ramer-Douglas-Peucker simplification in world coords. */
export function simplifyPath(points: PathPoint[], tolerance = 2): PathPoint[] {
  if (points.length <= 2) return points;
  const sqTol = tolerance * tolerance;

  const distSq = (p: PathPoint, a: PathPoint, b: PathPoint) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 0 && dy === 0) return (p.x - a.x) ** 2 + (p.y - a.y) ** 2;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    return (p.x - projX) ** 2 + (p.y - projY) ** 2;
  };

  const rdp = (pts: PathPoint[], start: number, end: number, out: PathPoint[]) => {
    let maxDist = 0;
    let idx = 0;
    const a = pts[start];
    const b = pts[end];
    for (let i = start + 1; i < end; i++) {
      const d = distSq(pts[i], a, b);
      if (d > maxDist) {
        maxDist = d;
        idx = i;
      }
    }
    if (maxDist > sqTol) {
      rdp(pts, start, idx, out);
      rdp(pts, idx, end, out);
    } else {
      out.push(a);
    }
  };

  const result: PathPoint[] = [];
  rdp(points, 0, points.length - 1, result);
  result.push(points[points.length - 1]);
  return result;
}

export function parseNormalizedPathD(pathD: string): PathPoint[] {
  const points: PathPoint[] = [];
  const re = /([ML])\s*([-\d.]+)\s+([-\d.]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pathD))) {
    points.push({ x: parseFloat(m[2]), y: parseFloat(m[3]) });
  }
  return points;
}

export function worldPointsFromNormalizedPath(
  pathD: string,
  x: number,
  y: number,
  width: number,
  height: number
): PathPoint[] {
  return parseNormalizedPathD(pathD).map((p) => ({
    x: x + p.x * width,
    y: y + p.y * height,
  }));
}

export function normalizedPathFromWorldPoints(
  worldPoints: PathPoint[],
  x: number,
  y: number,
  width: number,
  height: number
): string {
  const w = Math.max(1e-6, width);
  const h = Math.max(1e-6, height);
  const parts = worldPoints.map((p, i) => {
    const nx = (p.x - x) / w;
    const ny = (p.y - y) / h;
    return `${i === 0 ? 'M' : 'L'} ${nx.toFixed(4)} ${ny.toFixed(4)}`;
  });
  if (parts.length) parts.push('Z');
  return parts.join(' ');
}
