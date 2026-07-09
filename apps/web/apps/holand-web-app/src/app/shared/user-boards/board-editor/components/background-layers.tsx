'use client';

import type { BoardBackgroundLayer, BoardViewBox } from '../../lib/board-types';
import { BoardMapBackground } from './board-map-background';

interface BackgroundLayersProps {
  layers: BoardBackgroundLayer[];
  viewBox: BoardViewBox;
  className?: string;
}

export function BackgroundLayers({ layers, viewBox, className }: BackgroundLayersProps) {
  const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <g className={className} pointerEvents="none">
      {sorted.map((layer) => {
        const opacity = layer.opacity ?? 1;
        if (layer.type === 'color') {
          return (
            <rect
              key={layer.id}
              x={viewBox.x}
              y={viewBox.y}
              width={viewBox.width}
              height={viewBox.height}
              fill={layer.color}
              opacity={opacity}
            />
          );
        }
        if (layer.type === 'image') {
          return (
            <image
              key={layer.id}
              href={layer.url}
              x={viewBox.x}
              y={viewBox.y}
              width={viewBox.width}
              height={viewBox.height}
              preserveAspectRatio={layer.fit === 'contain' ? 'xMidYMid meet' : layer.fit === 'tile' ? 'none' : 'xMidYMid slice'}
              opacity={opacity}
            />
          );
        }
        if (layer.type === 'artifact') {
          const src = `/api/artifacts/${layer.artifactId}/content`;
          return (
            <image
              key={layer.id}
              href={src}
              x={viewBox.x}
              y={viewBox.y}
              width={viewBox.width}
              height={viewBox.height}
              preserveAspectRatio={layer.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'}
              opacity={opacity}
            />
          );
        }
        if (layer.type === 'map') {
          return (
            <foreignObject
              key={layer.id}
              x={viewBox.x}
              y={viewBox.y}
              width={viewBox.width}
              height={viewBox.height}
              opacity={opacity}
            >
              <BoardMapBackground layer={layer} className="h-full w-full" />
            </foreignObject>
          );
        }
        return null;
      })}
    </g>
  );
}
