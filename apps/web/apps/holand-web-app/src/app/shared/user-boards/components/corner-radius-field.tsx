'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { Text } from 'rizzui';
import type { BoardShapeGeometry, CornerRadii } from '../lib/board-types';
import { resolveCornerRadii } from '../lib/canvas/shape-geometry';
import { IconCornerIndividual, IconCornerUniform } from './board-design-icons';

export interface CornerRadiusFieldProps {
  geometry: BoardShapeGeometry;
  width: number;
  height: number;
  onChange: (cornerRadii: CornerRadii) => void;
}

type CornerMode = 'uniform' | 'individual';

function radiiFromGeometry(
  geometry: BoardShapeGeometry,
  width: number,
  height: number
): [number, number, number, number] {
  return resolveCornerRadii(geometry, width, height);
}

function modeFromGeometry(geometry: BoardShapeGeometry): CornerMode {
  if (geometry.cornerRadii !== undefined && typeof geometry.cornerRadii !== 'number') {
    return 'individual';
  }
  return 'uniform';
}

function CornerInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <label className="board-field-group group flex min-w-0 flex-1 flex-col items-center gap-0.5">
      <span className="text-[9px] text-gray-400">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="board-field-input"
        aria-label={label}
      />
      <span className="board-field-underline" aria-hidden />
    </label>
  );
}

export function CornerRadiusField({ geometry, width, height, onChange }: CornerRadiusFieldProps) {
  const { t } = useTranslation();
  const radii = useMemo(() => radiiFromGeometry(geometry, width, height), [geometry, width, height]);
  const [mode, setMode] = useState<CornerMode>(() => modeFromGeometry(geometry));

  const maxR = Math.min(width, height) / 2;
  const clamp = (v: number) => Math.min(maxR, Math.max(0, v));

  const setUniform = (v: number) => onChange(clamp(v));
  const setIndividual = (next: [number, number, number, number]) =>
    onChange(next.map((r) => clamp(r)) as [number, number, number, number]);

  const switchMode = (next: CornerMode) => {
    setMode(next);
    if (next === 'uniform') {
      onChange(radii[0]);
    } else {
      onChange([...radii] as [number, number, number, number]);
    }
  };

  return (
    <div className="space-y-1.5">
      <Text className="text-xs text-gray-500">{t('boards.corner.title', 'Corner radius')}</Text>
      <div className="flex items-center gap-2">
        <div className="flex shrink-0 overflow-hidden rounded border border-muted">
          <button
            type="button"
            title={t('boards.corner.uniformMode', 'All corners')}
            aria-label={t('boards.corner.uniformMode', 'All corners')}
            onClick={() => switchMode('uniform')}
            className={cn(
              'flex size-7 items-center justify-center',
              mode === 'uniform' ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
            )}
          >
            <IconCornerUniform />
          </button>
          <button
            type="button"
            title={t('boards.corner.individualMode', 'Per corner')}
            aria-label={t('boards.corner.individualMode', 'Per corner')}
            onClick={() => switchMode('individual')}
            className={cn(
              'flex size-7 items-center justify-center border-s border-muted',
              mode === 'individual' ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
            )}
          >
            <IconCornerIndividual />
          </button>
        </div>
        {mode === 'uniform' ? (
          <CornerInput
            label={t('boards.corner.all', 'All')}
            value={radii[0]}
            onChange={setUniform}
          />
        ) : (
          <div className="flex min-w-0 flex-1 gap-1">
            <CornerInput
              label={t('boards.corner.tl', 'TL')}
              value={radii[0]}
              onChange={(v) => setIndividual([v, radii[1], radii[2], radii[3]])}
            />
            <CornerInput
              label={t('boards.corner.tr', 'TR')}
              value={radii[1]}
              onChange={(v) => setIndividual([radii[0], v, radii[2], radii[3]])}
            />
            <CornerInput
              label={t('boards.corner.br', 'BR')}
              value={radii[2]}
              onChange={(v) => setIndividual([radii[0], radii[1], v, radii[3]])}
            />
            <CornerInput
              label={t('boards.corner.bl', 'BL')}
              value={radii[3]}
              onChange={(v) => setIndividual([radii[0], radii[1], radii[2], v])}
            />
          </div>
        )}
      </div>
    </div>
  );
}
