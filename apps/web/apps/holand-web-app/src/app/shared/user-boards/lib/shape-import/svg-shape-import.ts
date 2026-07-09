import type { BoardShapeGeometry } from '../board-types';
import { denormalizePathD } from '../canvas/shape-geometry';

export interface ImportedShape {
  geometry: BoardShapeGeometry;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  width: number;
  height: number;
}

const UNSAFE_TAGS = /script|foreignObject|iframe|object|embed/i;

function parseStyleAttr(style: string | null): Record<string, string> {
  if (!style) return {};
  const out: Record<string, string> = {};
  for (const part of style.split(';')) {
    const [k, v] = part.split(':').map((s) => s.trim());
    if (k && v) out[k] = v;
  }
  return out;
}

function rectToPathD(x: number, y: number, w: number, h: number, rx = 0): string {
  if (rx <= 0) {
    return `M 0 0 L 1 0 L 1 1 L 0 1 Z`;
  }
  const r = Math.min(rx / w, rx / h, 0.5);
  return `M ${r} 0 L ${1 - r} 0 Q 1 0 1 ${r} L 1 ${1 - r} Q 1 1 ${1 - r} 1 L ${r} 1 Q 0 1 0 ${1 - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
}

function extractFromElement(el: Element, svgW: number, svgH: number): ImportedShape | null {
  const tag = el.tagName.toLowerCase();
  const fill =
    el.getAttribute('fill') ??
    parseStyleAttr(el.getAttribute('style')).fill ??
    '#64748b';
  const stroke = el.getAttribute('stroke') ?? parseStyleAttr(el.getAttribute('style')).stroke ?? undefined;
  const strokeWidth = parseFloat(el.getAttribute('stroke-width') ?? '1');

  if (tag === 'path') {
    const d = el.getAttribute('d');
    if (!d) return null;
    const bbox = (el as SVGGraphicsElement).getBBox?.() ?? { x: 0, y: 0, width: svgW, height: svgH };
    const w = Math.max(1, bbox.width);
    const h = Math.max(1, bbox.height);
    const worldD = d;
    const localParts: string[] = [];
    const re = /([MLHVCSQTAZmlhvcsqtaz])\s*([-\d.eE+, ]*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(worldD))) {
      const cmd = m[1];
      const nums = m[2].trim();
      if (!nums && cmd.toUpperCase() === 'Z') {
        localParts.push('Z');
        continue;
      }
      const parts = nums.split(/[\s,]+/).filter(Boolean).map(Number);
      const out: string[] = [];
      for (let i = 0; i < parts.length; i += 2) {
        if (i + 1 < parts.length) {
          const nx = ((parts[i] - bbox.x) / w).toFixed(4);
          const ny = ((parts[i + 1] - bbox.y) / h).toFixed(4);
          out.push(`${i === 0 && localParts.length === 0 ? 'M' : 'L'} ${nx} ${ny}`);
        }
      }
      localParts.push(...out);
    }
    return {
      geometry: { kind: 'path', pathD: localParts.join(' ') || 'M 0 0 L 1 0 L 1 1 L 0 1 Z' },
      fill: fill === 'none' ? 'transparent' : fill,
      stroke: stroke === 'none' ? undefined : stroke,
      strokeWidth,
      width: w,
      height: h,
    };
  }

  if (tag === 'rect') {
    const w = parseFloat(el.getAttribute('width') ?? '100');
    const h = parseFloat(el.getAttribute('height') ?? '100');
    const rx = parseFloat(el.getAttribute('rx') ?? '0');
    return {
      geometry: {
        kind: 'path',
        pathD: rectToPathD(0, 0, w, h, rx),
      },
      fill: fill === 'none' ? 'transparent' : fill,
      stroke: stroke === 'none' ? undefined : stroke,
      strokeWidth,
      width: Math.max(1, w),
      height: Math.max(1, h),
    };
  }

  if (tag === 'ellipse' || tag === 'circle') {
    return {
      geometry: { kind: 'preset', preset: 'ellipse' },
      fill: fill === 'none' ? 'transparent' : fill,
      stroke: stroke === 'none' ? undefined : stroke,
      strokeWidth,
      width: Math.max(
        1,
        parseFloat(el.getAttribute('rx') ?? el.getAttribute('r') ?? '50') * 2 ||
          parseFloat(el.getAttribute('width') ?? '100')
      ),
      height: Math.max(
        1,
        parseFloat(el.getAttribute('ry') ?? el.getAttribute('r') ?? '50') * 2 ||
          parseFloat(el.getAttribute('height') ?? '100')
      ),
    };
  }

  if (tag === 'polygon' || tag === 'polyline') {
    const pts = (el.getAttribute('points') ?? '')
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (pts.length < 4) return null;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      xs.push(pts[i]);
      ys.push(pts[i + 1]);
    }
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const w = Math.max(1, Math.max(...xs) - minX);
    const h = Math.max(1, Math.max(...ys) - minY);
    const parts = [];
    for (let i = 0; i < xs.length; i++) {
      const nx = ((xs[i] - minX) / w).toFixed(4);
      const ny = ((ys[i] - minY) / h).toFixed(4);
      parts.push(`${i === 0 ? 'M' : 'L'} ${nx} ${ny}`);
    }
    if (tag === 'polygon') parts.push('Z');
    return {
      geometry: { kind: 'path', pathD: parts.join(' ') },
      fill: fill === 'none' ? 'transparent' : fill,
      stroke: stroke === 'none' ? undefined : stroke,
      strokeWidth,
      width: w,
      height: h,
    };
  }

  return null;
}

export function parseSvgShapeFile(svgText: string): ImportedShape | null {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const root = doc.documentElement;
  if (root.tagName.toLowerCase() !== 'svg') return null;

  const all = root.querySelectorAll('*');
  for (const el of all) {
    if (UNSAFE_TAGS.test(el.tagName)) return null;
  }

  const svgW = parseFloat(root.getAttribute('width') ?? '200') || 200;
  const svgH = parseFloat(root.getAttribute('height') ?? '200') || 200;

  const shapeEl =
    root.querySelector('path') ??
    root.querySelector('rect') ??
    root.querySelector('ellipse') ??
    root.querySelector('circle') ??
    root.querySelector('polygon') ??
    root.querySelector('polyline');

  if (!shapeEl) return null;
  return extractFromElement(shapeEl, svgW, svgH);
}

export function isEpsFile(file: File): boolean {
  return /\.eps$/i.test(file.name) || file.type === 'application/postscript';
}

/** Re-export for tests */
export { denormalizePathD };
