'use client';

import { useEffect, useMemo, useState } from 'react';
import cn from '@core/utils/class-names';
import type { BoardViewBox } from '../board-types';
import { BOARD_GRID_SIZE } from './snap';
import { effectiveGridVisible, type GridPreferences } from './grid-preference';
import {
  BOARD_CANVAS_BG_DARK,
  BOARD_CANVAS_BG_LIGHT,
  DARK_GRID_RGB,
  LIGHT_GRID_RGB,
} from './grid-tokens';

export interface GridBackgroundProps {
  viewBox: BoardViewBox;
  gridSize?: number;
  preferences: GridPreferences;
  snapToGrid: boolean;
  className?: string;
}

function parseRgb(color: string | null, dark: boolean): string {
  if (!color) return dark ? DARK_GRID_RGB : LIGHT_GRID_RGB;
  const hex = color.trim();
  if (hex.startsWith('#') && hex.length === 7) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
  }
  return dark ? DARK_GRID_RGB : LIGHT_GRID_RGB;
}

export function computeGridBackgroundStyle(
  containerWidth: number,
  containerHeight: number,
  viewBox: BoardViewBox,
  gridSize: number,
  preferences: GridPreferences,
  snapToGrid: boolean,
  dark: boolean
): React.CSSProperties | null {
  if (!effectiveGridVisible(preferences, snapToGrid)) return null;
  if (containerWidth <= 0 || containerHeight <= 0) return null;

  const vbAspect = viewBox.width / viewBox.height;
  const containerAspect = containerWidth / containerHeight;
  let scale: number;
  let offsetX: number;
  let offsetY: number;

  if (containerAspect > vbAspect) {
    scale = containerHeight / viewBox.height;
    offsetX = (containerWidth - viewBox.width * scale) / 2;
    offsetY = 0;
  } else {
    scale = containerWidth / viewBox.width;
    offsetX = 0;
    offsetY = (containerHeight - viewBox.height * scale) / 2;
  }

  const cellPx = gridSize * scale;
  const rgb = parseRgb(preferences.color, dark);
  const alpha = preferences.opacity;
  const stroke = `rgba(${rgb}, ${alpha})`;

  const modX = ((viewBox.x % gridSize) + gridSize) % gridSize;
  const modY = ((viewBox.y % gridSize) + gridSize) % gridSize;
  const posX = offsetX - modX * scale;
  const posY = offsetY - modY * scale;

  if (preferences.style === 'lines') {
    return {
      backgroundImage: `linear-gradient(${stroke} 1px, transparent 1px), linear-gradient(90deg, ${stroke} 1px, transparent 1px)`,
      backgroundSize: `${cellPx}px ${cellPx}px`,
      backgroundPosition: `${posX}px ${posY}px`,
    };
  }

  return {
    backgroundImage: `radial-gradient(circle, ${stroke} 1px, transparent 1px)`,
    backgroundSize: `${cellPx}px ${cellPx}px`,
    backgroundPosition: `${posX}px ${posY}px`,
  };
}

export function GridBackground({
  viewBox,
  gridSize = BOARD_GRID_SIZE,
  preferences,
  snapToGrid,
  className,
}: GridBackgroundProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    const check = () => setDark(el.getAttribute('data-theme') === 'dark');
    check();
    const obs = new MutationObserver(check);
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const parent = document.querySelector('[data-board-grid-host]');
    if (!parent) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(parent);
    setSize({ w: parent.clientWidth, h: parent.clientHeight });
    return () => ro.disconnect();
  }, []);

  const gridStyle = useMemo(
    () => computeGridBackgroundStyle(size.w, size.h, viewBox, gridSize, preferences, snapToGrid, dark),
    [size.w, size.h, viewBox, gridSize, preferences, snapToGrid, dark]
  );

  return (
    <div
      className={cn('pointer-events-none absolute inset-0', className)}
      style={{
        backgroundColor: dark ? BOARD_CANVAS_BG_DARK : BOARD_CANVAS_BG_LIGHT,
        ...gridStyle,
      }}
      aria-hidden
    />
  );
}
