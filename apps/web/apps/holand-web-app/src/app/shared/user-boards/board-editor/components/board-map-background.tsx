'use client';

import { useMemo } from 'react';
import type { BoardBackgroundMapLayer } from '../../lib/board-types';

const TILE_SIZE = 256;

function latLngToTile(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

function tileToLatLng(x: number, y: number, zoom: number) {
  const n = 2 ** zoom;
  const lng = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lng };
}

export interface BoardMapBackgroundProps {
  layer: BoardBackgroundMapLayer;
  className?: string;
}

/** Lightweight OSM tile grid for board map background layers. */
export function BoardMapBackground({ layer, className }: BoardMapBackgroundProps) {
  const tiles = useMemo(() => {
    const zoom = Math.min(18, Math.max(1, Math.round(layer.zoom)));
    const center = latLngToTile(layer.center.lat, layer.center.lng, zoom);
    const span = 2;
    const items: Array<{ key: string; src: string; left: number; top: number }> = [];
    const origin = tileToLatLng(center.x - span, center.y - span, zoom);
    const widthPx = TILE_SIZE * (span * 2 + 1);
    const heightPx = TILE_SIZE * (span * 2 + 1);

    for (let dx = -span; dx <= span; dx += 1) {
      for (let dy = -span; dy <= span; dy += 1) {
        const tx = center.x + dx;
        const ty = center.y + dy;
        items.push({
          key: `${zoom}-${tx}-${ty}`,
          src: `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`,
          left: (dx + span) * TILE_SIZE,
          top: (dy + span) * TILE_SIZE,
        });
      }
    }

    return { items, widthPx, heightPx, origin };
  }, [layer.center.lat, layer.center.lng, layer.zoom]);

  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-slate-200 ${className ?? ''}`}
      title={`Map ${layer.center.lat.toFixed(2)}, ${layer.center.lng.toFixed(2)}`}
    >
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: tiles.widthPx, height: tiles.heightPx }}
      >
        {tiles.items.map((tile) => (
          <img
            key={tile.key}
            src={tile.src}
            alt=""
            draggable={false}
            className="absolute"
            style={{ left: tile.left, top: tile.top, width: TILE_SIZE, height: TILE_SIZE }}
            loading="lazy"
          />
        ))}
      </div>
    </div>
  );
}
