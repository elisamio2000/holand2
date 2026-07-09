import type {
  BoardConnectorObject,
  BoardFrameObject,
  BoardMediaObject,
  BoardNodeObject,
  BoardRecord,
  BoardSnapshot,
  BoardStickyObject,
  BoardVectorObject,
  BoardViewBox,
} from './board-types';
import { computeConnectorRoute, isConnectorSpatial } from './canvas/connector-routing';
import { getNodeShapeElement, nodeShapeBounds } from './canvas/node-shape';
import { getShapeElement } from './canvas/shape-geometry';
import { getSnapshotBounds, type SnapshotBounds } from './board-snapshot';
import { strokeToPathD } from './ink/ink-model';
import { getBoardBlobUrl } from './board-blob-store';
import { rasterizeSvgToPngBlob } from './board-export-worker';
import type { BoardBackgroundLayer } from './board-types';

const exportImageCache = new Map<string, string>();

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function mediaToDataUrl(obj: BoardMediaObject): Promise<string | null> {
  if (obj.thumbnail?.startsWith('data:')) return obj.thumbnail;
  if (obj.blobKey) {
    const url = await getBoardBlobUrl(obj.blobKey);
    if (!url) return null;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }
  if (obj.artifactId && obj.mime?.startsWith('image/')) {
    const cached = exportImageCache.get(obj.artifactId);
    if (cached) return cached;
    try {
      const { storageService } = await import('@/services/storage.service');
      const blob = await storageService.fetchArtifactBlob(obj.artifactId, 'inline');
      const dataUrl = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
      if (dataUrl) exportImageCache.set(obj.artifactId, dataUrl);
      return dataUrl;
    } catch {
      return null;
    }
  }
  return null;
}

function snapshotBoundsToViewBox(bounds: SnapshotBounds): BoardViewBox {
  return {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
  };
}

async function backgroundLayerToSvg(
  layer: BoardBackgroundLayer,
  bounds: BoardViewBox
): Promise<string> {
  if (layer.type === 'color') {
    return `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="${layer.color}" opacity="${layer.opacity}"/>`;
  }
  if (layer.type === 'image') {
    return `<image href="${escapeXml(layer.url)}" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" opacity="${layer.opacity}" preserveAspectRatio="xMidYMid slice"/>`;
  }
  if (layer.type === 'artifact') {
    const cached = exportImageCache.get(layer.artifactId);
    let dataUrl = cached ?? null;
    if (!dataUrl) {
      try {
        const { storageService } = await import('@/services/storage.service');
        const blob = await storageService.fetchArtifactBlob(layer.artifactId, 'inline');
        dataUrl = await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
        if (dataUrl) exportImageCache.set(layer.artifactId, dataUrl);
      } catch {
        dataUrl = null;
      }
    }
    if (dataUrl) {
      return `<image href="${dataUrl}" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" opacity="${layer.opacity}" preserveAspectRatio="xMidYMid slice"/>`;
    }
  }
  if (layer.type === 'map') {
    return `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="#e2e8f0" opacity="${layer.opacity}"/>`;
  }
  return '';
}

async function buildExportSvg(snapshot: BoardSnapshot, useContentBounds: boolean): Promise<string> {
  const bounds = useContentBounds
    ? snapshotBoundsToViewBox(getSnapshotBounds(snapshot))
    : snapshot.viewBox;
  const vb = `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`;

  const mediaObjects = snapshot.objects.filter((o): o is BoardMediaObject => o.type === 'media' && 'x' in o);
  await Promise.all(mediaObjects.map((m) => mediaToDataUrl(m)));

  const backgroundSvg = await Promise.all(
    [...(snapshot.backgroundLayers ?? [])]
      .sort((a, b) => a.zIndex - b.zIndex)
      .map((layer) => backgroundLayerToSvg(layer, bounds))
  );

  const ink = (snapshot.inkStrokes ?? [])
    .map((s) => {
      const d = strokeToPathD(s);
      if (!d) return '';
      return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round" opacity="${s.opacity ?? 1}"/>`;
    })
    .join('\n');

  const spatialById = new Map(
    snapshot.objects
      .filter((o) => isConnectorSpatial(o))
      .map((o) => [o.id, o])
  );

  const connectors = snapshot.objects
    .filter((o): o is BoardConnectorObject => o.type === 'connector')
    .map((c) => {
      const source = spatialById.get(c.sourceId);
      const target = spatialById.get(c.targetId);
      if (!source || !target) return '';
      const route = computeConnectorRoute(c, source, target);
      if (!route) return '';
      const color = c.color ?? '#64748b';
      const sw = c.strokeWidth ?? 2;
      return `<path d="${route.pathD}" fill="none" stroke="${color}" stroke-width="${sw}"/>`;
    })
    .join('\n');

  const objectParts: string[] = [];

  for (const o of snapshot.objects) {
    if (o.type === 'frame' && 'x' in o) {
      const f = o as BoardFrameObject;
      objectParts.push(
        `<rect x="${f.x}" y="${f.y}" width="${f.width}" height="${f.height}" fill="${f.background ?? 'rgba(148,163,184,0.15)'}" stroke="#94a3b8" rx="8"/>`,
        `<text x="${f.x + 8}" y="${f.y + 16}" font-size="11" fill="#475569">${escapeXml(f.title)}</text>`
      );
    }
    if (o.type === 'sticky' && 'x' in o) {
      const s = o as BoardStickyObject;
      objectParts.push(
        `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="${s.color}" rx="6"/>`,
        `<text x="${s.x + 8}" y="${s.y + 20}" font-size="10" fill="#334155">${escapeXml(s.text.slice(0, 80))}</text>`
      );
    }
    if (o.type === 'node' && 'x' in o) {
      const n = o as BoardNodeObject;
      const bounds = nodeShapeBounds(n.x, n.y, n.width, n.height);
      const el = getNodeShapeElement({
        node: n,
        bounds,
        fill: n.color,
        stroke: '#94a3b8',
        strokeWidth: 1,
      });
      const rot = n.rotation ? ` transform="rotate(${n.rotation} ${bounds.cx} ${bounds.cy})"` : '';
      if (el.type === 'ellipse') {
        const { cx, cy, rx, ry, fill, stroke, strokeWidth } = el.attrs;
        objectParts.push(
          `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${rot}/>`
        );
      } else if (el.type === 'polygon') {
        objectParts.push(`<polygon points="${el.attrs.points}" fill="${el.attrs.fill}" stroke="${el.attrs.stroke}" stroke-width="${el.attrs.strokeWidth}"${rot}/>`);
      } else if (el.type === 'path') {
        objectParts.push(`<path d="${el.attrs.d}" fill="${el.attrs.fill}" stroke="${el.attrs.stroke}" stroke-width="${el.attrs.strokeWidth}"${rot}/>`);
      } else {
        objectParts.push(
          `<rect x="${el.attrs.x}" y="${el.attrs.y}" width="${el.attrs.width}" height="${el.attrs.height}" rx="${el.attrs.rx ?? 0}" fill="${el.attrs.fill}" stroke="${el.attrs.stroke}" stroke-width="${el.attrs.strokeWidth}"${rot}/>`
        );
      }
      objectParts.push(
        `<text x="${bounds.cx}" y="${bounds.cy}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="11"${rot}>${escapeXml(n.label)}</text>`
      );
    }
    if (o.type === 'vector' && 'x' in o) {
      const v = o as BoardVectorObject;
      const bounds = nodeShapeBounds(v.x, v.y, v.width, v.height);
      const el = getShapeElement(v.geometry, bounds, v.fill, v.stroke ?? '#94a3b8', v.strokeWidth ?? 1);
      const rot = v.rotation ? ` transform="rotate(${v.rotation} ${bounds.cx} ${bounds.cy})"` : '';
      if (el.type === 'path') {
        objectParts.push(`<path d="${el.attrs.d}" fill="${el.attrs.fill}" stroke="${el.attrs.stroke}" stroke-width="${el.attrs.strokeWidth}"${rot}/>`);
      } else if (el.type === 'ellipse') {
        objectParts.push(`<ellipse cx="${el.attrs.cx}" cy="${el.attrs.cy}" rx="${el.attrs.rx}" ry="${el.attrs.ry}" fill="${el.attrs.fill}" stroke="${el.attrs.stroke}" stroke-width="${el.attrs.strokeWidth}"${rot}/>`);
      } else if (el.type === 'polygon') {
        objectParts.push(`<polygon points="${el.attrs.points}" fill="${el.attrs.fill}" stroke="${el.attrs.stroke}" stroke-width="${el.attrs.strokeWidth}"${rot}/>`);
      } else {
        objectParts.push(`<rect x="${el.attrs.x}" y="${el.attrs.y}" width="${el.attrs.width}" height="${el.attrs.height}" rx="${el.attrs.rx ?? 0}" fill="${el.attrs.fill}" stroke="${el.attrs.stroke}" stroke-width="${el.attrs.strokeWidth}"${rot}/>`);
      }
    }
    if (o.type === 'media' && 'x' in o) {
      const m = o as BoardMediaObject;
      const dataUrl = await mediaToDataUrl(m);
      if (dataUrl) {
        objectParts.push(
          `<image href="${dataUrl}" x="${m.x}" y="${m.y}" width="${m.width}" height="${m.height}" preserveAspectRatio="xMidYMid meet"/>`
        );
      } else {
        const label = escapeXml(m.name || m.mime || 'Media');
        objectParts.push(
          `<rect x="${m.x}" y="${m.y}" width="${m.width}" height="${m.height}" fill="#f1f5f9" stroke="#cbd5e1" rx="4"/>`,
          `<text x="${m.x + m.width / 2}" y="${m.y + m.height / 2}" text-anchor="middle" dominant-baseline="middle" fill="#64748b" font-size="10">${label}</text>`
        );
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${bounds.width}" height="${bounds.height}">
  <rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="#f8fafc"/>
  ${backgroundSvg.join('\n')}
  ${connectors}
  ${objectParts.join('\n')}
  ${ink}
</svg>`;
}

export function exportBoardJson(board: BoardRecord, snapshot: BoardSnapshot, includeBlobs = false) {
  const payload = includeBlobs
    ? { board, snapshot }
    : { board: { ...board, snapshot }, snapshot };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `${board.title.replace(/\s+/g, '-')}.board.json`);
}

export async function exportBoardSvg(
  board: BoardRecord,
  snapshot: BoardSnapshot,
  useContentBounds = true
) {
  const svg = await buildExportSvg(snapshot, useContentBounds);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  downloadBlob(blob, `${board.title.replace(/\s+/g, '-')}.board.svg`);
}

export async function exportBoardPng(
  board: BoardRecord,
  snapshot: BoardSnapshot,
  useContentBounds = true
) {
  const svg = await buildExportSvg(snapshot, useContentBounds);
  const bounds = useContentBounds
    ? snapshotBoundsToViewBox(getSnapshotBounds(snapshot))
    : snapshot.viewBox;
  const width = Math.min(4096, Math.max(800, bounds.width));
  const height = Math.min(4096, Math.max(600, bounds.height));

  const workerBlob = await rasterizeSvgToPngBlob(svg, width, height);
  if (workerBlob) {
    downloadBlob(workerBlob, `${board.title.replace(/\s+/g, '-')}.board.png`);
    return;
  }

  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${board.title.replace(/\s+/g, '-')}.board.png`);
    }, 'image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
