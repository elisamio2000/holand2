// ============================================
// RasterLayersPanel — manage multiple raster tile overlays
//
// SAS.Planet: relative path under MAP_LAYERS_ROOT (sqlite or JPG cache)
// XYZ: standard tile URL template
// ============================================
'use client';

import { useState } from 'react';
import { Text } from 'rizzui';
import {
  PiPlusBold,
  PiXBold,
  PiEyeBold,
  PiEyeSlashBold,
} from 'react-icons/pi';
import cn from '@/lib/cn';
import MapLayersFolderPicker from '@/app/shared/map/map-layers-folder-picker';

// ── Types ────────────────────────────────────────────────────────────────────

export type RasterSourceType = 'sas' | 'xyz';

export interface RasterLayer {
  id: string;
  name: string;
  type: RasterSourceType;
  /** For 'sas': relative path under MAP_LAYERS_ROOT (e.g. sas-both).
   *  For 'xyz': full URL template with {z}/{x}/{y}. */
  source: string;
  visible: boolean;
}

interface RasterLayersPanelProps {
  layers: RasterLayer[];
  onChange: (layers: RasterLayer[]) => void;
  vectorOverlay: boolean;
  onVectorOverlayChange: (visible: boolean) => void;
}

// ── Main panel ───────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<RasterSourceType, string> = {
  sas: 'SAS.Planet',
  xyz: 'XYZ URL',
};

const TYPE_COLORS: Record<RasterSourceType, string> = {
  sas: 'bg-blue-100 text-blue-700',
  xyz: 'bg-purple-100 text-purple-700',
};

export default function RasterLayersPanel({ layers, onChange, vectorOverlay, onVectorOverlayChange }: RasterLayersPanelProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addType, setAddType] = useState<RasterSourceType>('sas');
  const [addSource, setAddSource] = useState('');

  const toggleVisible = (id: string) => {
    onChange(layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  };

  const remove = (id: string) => {
    onChange(layers.filter(l => l.id !== id));
  };

  const addLayer = () => {
    const source = addSource.trim();
    const name = addName.trim() || source.split('/').pop() || 'Raster layer';
    if (!source) return;
    const newLayer: RasterLayer = {
      id: `raster-${Date.now()}`,
      name,
      type: addType,
      source,
      visible: true,
    };
    onChange([...layers, newLayer]);
    setAddName('');
    setAddSource('');
    setShowAdd(false);
  };

  return (
    <div className="border-b border-muted">
      {/* Section header */}
      <div className="px-3 pt-2.5 pb-1">
        <Text className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          Raster Map Layers
        </Text>
      </div>

      <div className="px-3 pb-3">
        {/* Layer list */}
        {layers.length === 0 && !showAdd && (
          <Text className="mb-2 text-[10px] text-gray-400">No raster layers added yet.</Text>
        )}

        {layers.length > 0 && (
          <div className="mb-2 flex flex-col gap-1">
            {layers.map((layer) => (
              <div
                key={layer.id}
                className={cn(
                  'flex items-center gap-1.5 rounded border px-2 py-1.5 transition-colors',
                  layer.visible
                    ? 'border-blue-200 bg-blue-50/60 dark:border-blue-800/40 dark:bg-blue-900/20'
                    : 'border-muted bg-gray-50/60 dark:bg-gray-100/60'
                )}
              >
                {/* Visibility toggle */}
                <button
                  type="button"
                  onClick={() => toggleVisible(layer.id)}
                  title={layer.visible ? 'Hide layer' : 'Show layer'}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-white/80"
                >
                  {layer.visible
                    ? <PiEyeBold className="h-3.5 w-3.5 text-blue-500" />
                    : <PiEyeSlashBold className="h-3.5 w-3.5 text-gray-400" />
                  }
                </button>

                {/* Name */}
                <span className={cn('min-w-0 flex-1 truncate text-[11px] font-medium', layer.visible ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400')}>
                  {layer.name}
                </span>

                {/* Type badge */}
                <span className={cn('shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold', TYPE_COLORS[layer.type])}>
                  {TYPE_LABELS[layer.type]}
                </span>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => remove(layer.id)}
                  title="Remove layer"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-red-100"
                >
                  <PiXBold className="h-3 w-3 text-gray-400 hover:text-red-500" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Vector overlay toggle — only shown when at least one raster layer is visible */}
        {layers.some(l => l.visible) && (
          <div className={cn(
            'mb-2 flex items-center gap-2 rounded border px-2 py-1.5',
            vectorOverlay
              ? 'border-green-200 bg-green-50/60'
              : 'border-muted bg-gray-50/60'
          )}>
            <button
              type="button"
              onClick={() => onVectorOverlayChange(!vectorOverlay)}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-white/80"
              title={vectorOverlay ? 'Hide vector overlay' : 'Show vector overlay'}
            >
              {vectorOverlay
                ? <PiEyeBold className="h-3.5 w-3.5 text-green-600" />
                : <PiEyeSlashBold className="h-3.5 w-3.5 text-gray-400" />}
            </button>
            <span className={cn('flex-1 text-[11px] font-medium', vectorOverlay ? 'text-gray-700' : 'text-gray-400')}>
              Vector overlay
            </span>
            <span className="shrink-0 rounded bg-gray-100 px-1 py-0.5 text-[9px] font-semibold text-gray-500">
              roads · labels · fills
            </span>
          </div>
        )}

        {/* Add form */}
        {showAdd && (
          <div className="mb-2 rounded border border-blue-200 bg-blue-50/40 p-2.5 dark:border-blue-800/30 dark:bg-blue-900/10">
            {/* Name */}
            <input
              type="text"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="Layer name (e.g. Satellite Day)"
              className="mb-2 w-full rounded border border-muted bg-white px-2 py-1 text-[11px] text-gray-700 outline-none focus:border-blue-400 dark:bg-gray-50"
            />

            {/* Type selector */}
            <div className="mb-2 flex gap-1.5">
              {(['sas', 'xyz'] as RasterSourceType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAddType(t)}
                  className={cn(
                    'rounded border px-2 py-0.5 text-[10px] font-medium transition-colors',
                    addType === t
                      ? 'border-blue-400 bg-blue-500 text-white'
                      : 'border-muted bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-50'
                  )}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>

            {/* Source input */}
            {addType === 'sas' ? (
              <MapLayersFolderPicker
                value={addSource}
                onChange={setAddSource}
                placeholder="مسیر نسبی (مثلاً my-layer-folder)"
                browseButtonLabel="Browse"
                selectLabel="Select"
                inputClassName="font-mono text-[10px] focus:border-blue-400"
              />
            ) : (
              <input
                type="text"
                value={addSource}
                onChange={(e) => setAddSource(e.target.value)}
                placeholder="https://tile.server/{z}/{x}/{y}.png"
                spellCheck={false}
                className="w-full rounded border border-muted bg-white px-2 py-1 font-mono text-[10px] text-gray-700 outline-none focus:border-blue-400 dark:bg-gray-50"
              />
            )}

            {/* Add / Cancel */}
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                onClick={addLayer}
                disabled={!addSource.trim()}
                className="flex-1 rounded bg-blue-500 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Add Layer
              </button>
              <button
                type="button"
                onClick={() => { setShowAdd(false); setAddName(''); setAddSource(''); }}
                className="rounded border border-muted px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* + Add button */}
        {!showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-gray-300 py-1.5 text-[11px] text-gray-500 hover:border-blue-400 hover:text-blue-500"
          >
            <PiPlusBold className="h-3 w-3" />
            Add Raster Layer
          </button>
        )}
      </div>
    </div>
  );
}
