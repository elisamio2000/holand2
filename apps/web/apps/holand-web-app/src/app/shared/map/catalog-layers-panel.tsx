// ============================================
// CatalogLayersPanel — persisted map layers from Storage catalog
// (map_explorer.layers.* tools + /api/map-storage tile proxy)
// ============================================
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Text } from 'rizzui';
import {
  PiPlusBold,
  PiEyeBold,
  PiEyeSlashBold,
  PiArrowClockwiseBold,
  PiTrashBold,
  PiStackBold,
  PiGlobeBold,
  PiArrowUpBold,
  PiArrowDownBold,
} from 'react-icons/pi';
import cn from '@/lib/cn';
import toast from 'react-hot-toast';
import { geoLocationService } from '@/services/geo-location.service';
import type { MapCatalogLayer } from '@/types/map-layers.types';
import type { MapCoreRef } from '@/app/shared/map';
import {
  catalogLayerPmtilesUrl,
  catalogLayerTileUrl,
  fetchCatalogRasterMaxZoom,
  isBasemapCatalogKind,
  isRasterCatalogKind,
} from '@/lib/map-storage-url';
import MapLayersFolderPicker from '@/app/shared/map/map-layers-folder-picker';

const CATALOG_LAYER_PREFIX = 'catalog-';

interface CatalogLayersPanelProps {
  mapHandle: MapCoreRef | null;
  className?: string;
  onBasemapChanged?: (pmtilesUrl: string) => void;
}

function kindLabel(kind: string): string {
  if (kind.startsWith('raster_')) return kind.replace('raster_', '').toUpperCase();
  if (kind.startsWith('streetview')) return 'Street View';
  if (kind.startsWith('vector_')) return kind.replace('vector_', '').toUpperCase();
  return kind;
}

export default function CatalogLayersPanel({
  mapHandle,
  className,
  onBasemapChanged,
}: CatalogLayersPanelProps) {
  const [layers, setLayers] = useState<MapCatalogLayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [importPath, setImportPath] = useState('');
  const [importName, setImportName] = useState('');
  const [importing, setImporting] = useState(false);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const [opacityById, setOpacityById] = useState<Record<string, number>>({});
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [basemapLayerId, setBasemapLayerId] = useState<string | null>(null);
  const [basemapPath, setBasemapPath] = useState('');
  const [settingBasemap, setSettingBasemap] = useState(false);
  const [showBasemapPicker, setShowBasemapPicker] = useState(false);
  const mountedRef = useRef(true);
  // Mirror of opacityById read inside applyLayerToMap without re-creating the
  // callback (keeps the layer-apply effect from churning on every slider move).
  const opacityRef = useRef<Record<string, number>>({});

  const mapLayerId = (id: string) => `${CATALOG_LAYER_PREFIX}${id}`;
  const DEFAULT_OPACITY = 0.85;

  const applyLayerToMap = useCallback(
    async (layer: MapCatalogLayer, visible: boolean) => {
      if (!mapHandle) return;
      const mlId = mapLayerId(layer.id);
      if (!visible) {
        mapHandle.setCustomLayerVisibility(mlId, false);
        return;
      }
      if (!isRasterCatalogKind(layer.layer_kind) || isBasemapCatalogKind(layer.layer_kind)) return;
      const url = catalogLayerTileUrl(layer.id);
      const existing = mapHandle.getCustomLayers().find((l) => l.id === mlId);
      if (existing) {
        mapHandle.setCustomLayerVisibility(mlId, true);
        return;
      }
      const maxZoom = await fetchCatalogRasterMaxZoom(layer.id);
      mapHandle.addCustomLayer({
        id: mlId,
        name: layer.name,
        type: 'raster',
        url,
        visible: true,
        opacity: opacityRef.current[layer.id] ?? DEFAULT_OPACITY,
        maxZoom,
      });
    },
    [mapHandle]
  );

  const refreshBasemap = useCallback(async () => {
    try {
      const cfg = await geoLocationService.basemapConfig();
      if (!mountedRef.current) return;
      const id = typeof cfg.layer_id === 'string' ? cfg.layer_id : null;
      setBasemapLayerId(id);
      if (id) onBasemapChanged?.(catalogLayerPmtilesUrl(id));
    } catch {
      if (mountedRef.current) setBasemapLayerId(null);
    }
  }, [onBasemapChanged]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [resp] = await Promise.all([
        geoLocationService.listMapLayers({ limit: 200 }),
        refreshBasemap(),
      ]);
      if (!mountedRef.current) return;
      setLayers(resp.items);
      setVisibleIds((prev) => {
        const next = new Set<string>();
        for (const item of resp.items) {
          // PMTiles basemap is wired via tilesUrl — never as /map/tiles/*.jpg
          if (isBasemapCatalogKind(item.layer_kind)) continue;
          if (prev.has(item.id) || item.enabled !== false) next.add(item.id);
        }
        return next;
      });
      // Keep the session reorder sticky: preserve known order, append new rasters.
      const rasterIds = resp.items
        .filter((i) => isRasterCatalogKind(i.layer_kind) && !isBasemapCatalogKind(i.layer_kind))
        .map((i) => i.id);
      setOrderIds((prev) => {
        const known = prev.filter((id) => rasterIds.includes(id));
        const added = rasterIds.filter((id) => !known.includes(id));
        return [...known, ...added];
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load layers');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [refreshBasemap]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!mapHandle) return;
    for (const layer of layers) {
      if (isBasemapCatalogKind(layer.layer_kind)) {
        mapHandle.removeCustomLayer(mapLayerId(layer.id));
        continue;
      }
      applyLayerToMap(layer, visibleIds.has(layer.id));
    }
  }, [mapHandle, layers, visibleIds, applyLayerToMap]);

  const toggleVisible = (layer: MapCatalogLayer) => {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      if (next.has(layer.id)) next.delete(layer.id);
      else next.add(layer.id);
      return next;
    });
  };

  const handleOpacity = (layer: MapCatalogLayer, value: number) => {
    const op = Math.max(0, Math.min(1, value));
    opacityRef.current = { ...opacityRef.current, [layer.id]: op };
    setOpacityById((prev) => ({ ...prev, [layer.id]: op }));
    mapHandle?.setCustomLayerOpacity(mapLayerId(layer.id), op);
  };

  // Move a raster layer up/down within the session order, then push the new
  // z-stack to the map. `orderIds` is top-first; MapCore expects bottom-to-top.
  const moveLayer = (layerId: string, dir: -1 | 1) => {
    setOrderIds((prev) => {
      const idx = prev.indexOf(layerId);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      const bottomToTop = [...next].reverse().map((id) => mapLayerId(id));
      mapHandle?.reorderCustomLayers(bottomToTop);
      return next;
    });
  };

  const handleImport = async () => {
    const path = importPath.trim();
    if (!path) {
      toast.error('مسیر لایه را وارد کنید');
      return;
    }
    setImporting(true);
    try {
      await geoLocationService.importMapLayer(path, {
        name: importName.trim() || undefined,
      });
      toast.success('لایه ثبت شد');
      setImportPath('');
      setImportName('');
      setShowAdd(false);
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'ثبت لایه ناموفق بود');
    } finally {
      setImporting(false);
    }
  };

  const handleSetBasemapLayer = async (layer: MapCatalogLayer) => {
    setSettingBasemap(true);
    try {
      const cfg = await geoLocationService.basemapConfig({ layer_id: layer.id });
      const id = typeof cfg.layer_id === 'string' ? cfg.layer_id : layer.id;
      setBasemapLayerId(id);
      const url = catalogLayerPmtilesUrl(id);
      onBasemapChanged?.(url);
      toast.success(`نقشه پایه: ${layer.name}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'تنظیم نقشه پایه ناموفق بود');
    } finally {
      setSettingBasemap(false);
    }
  };

  const handleSetBasemapFromPath = async () => {
    const path = basemapPath.trim();
    if (!path) {
      toast.error('مسیر فایل PMTiles را وارد کنید');
      return;
    }
    setSettingBasemap(true);
    try {
      const cfg = await geoLocationService.basemapConfig({ path });
      const id = typeof cfg.layer_id === 'string' ? cfg.layer_id : null;
      if (id) {
        setBasemapLayerId(id);
        onBasemapChanged?.(catalogLayerPmtilesUrl(id));
      }
      setBasemapPath('');
      setShowBasemapPicker(false);
      toast.success('نقشه پایه ثبت شد');
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'ثبت نقشه پایه ناموفق بود');
    } finally {
      setSettingBasemap(false);
    }
  };

  const handleRemove = async (layer: MapCatalogLayer) => {
    const ok = window.confirm(`لایه «${layer.name}» از کاتالوگ حذف شود؟`);
    if (!ok) return;
    try {
      await geoLocationService.removeMapLayer(layer.id, false);
      if (mapHandle) mapHandle.removeCustomLayer(mapLayerId(layer.id));
      setVisibleIds((prev) => {
        const next = new Set(prev);
        next.delete(layer.id);
        return next;
      });
      toast.success('لایه حذف شد');
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'حذف ناموفق بود');
    }
  };

  // Arrange raster layers per the session order while keeping non-raster rows
  // (e.g. PMTiles basemaps) in their original slots.
  const orderedRasters = (() => {
    const rasters = layers.filter(
      (l) => isRasterCatalogKind(l.layer_kind) && !isBasemapCatalogKind(l.layer_kind)
    );
    const byId = new Map(rasters.map((l) => [l.id, l]));
    const out: MapCatalogLayer[] = [];
    for (const id of orderIds) {
      const l = byId.get(id);
      if (l) {
        out.push(l);
        byId.delete(id);
      }
    }
    for (const l of rasters) if (byId.has(l.id)) out.push(l);
    return out;
  })();
  let rasterCursor = 0;
  const displayLayers: MapCatalogLayer[] = layers.map((l) =>
    isRasterCatalogKind(l.layer_kind) && !isBasemapCatalogKind(l.layer_kind)
      ? orderedRasters[rasterCursor++] ?? l
      : l
  );

  return (
    <div className={cn('border-t border-muted', className)}>
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1.5">
          <PiStackBold className="h-3.5 w-3.5 text-primary" />
          <Text className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            لایه‌های کاتالوگ
          </Text>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="بارگذاری مجدد"
            onClick={() => refresh()}
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-200/20"
          >
            <PiArrowClockwiseBold className={cn('h-3.5 w-3.5 text-gray-400', loading && 'animate-spin')} />
          </button>
          <button
            type="button"
            title="افزودن لایهٔ شخصی (از مسیر)"
            onClick={() => setShowAdd((v) => !v)}
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-200/20"
          >
            <PiPlusBold className="h-3.5 w-3.5 text-primary" />
          </button>
        </div>
      </div>

      {error && <Text className="px-3 pb-2 text-xs text-red-500">{error}</Text>}

      <div className="mx-3 mb-2 rounded-lg border border-primary/20 bg-primary/5 p-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Text className="text-[10px] font-semibold uppercase tracking-wide text-primary">
              نقشه پایه (PMTiles)
            </Text>
            <Text className="truncate text-xs text-gray-600 dark:text-gray-400">
              {basemapLayerId
                ? layers.find((l) => l.id === basemapLayerId)?.name ?? basemapLayerId
                : 'تنظیم نشده — مسیر را در storage ثبت کنید'}
            </Text>
          </div>
          <button
            type="button"
            title="تنظیم از مسیر"
            disabled={settingBasemap}
            onClick={() => setShowBasemapPicker((v) => !v)}
            className="shrink-0 rounded p-1 hover:bg-primary/10"
          >
            <PiGlobeBold className="h-3.5 w-3.5 text-primary" />
          </button>
        </div>
        {showBasemapPicker && (
          <div className="mt-2 space-y-2 border-t border-primary/10 pt-2">
            <Text className="text-[10px] text-gray-500">
              مسیر نسبی فایل یا پوشهٔ .pmtiles زیر MAP_LAYERS_ROOT
            </Text>
            <MapLayersFolderPicker value={basemapPath} onChange={setBasemapPath} />
            <button
              type="button"
              disabled={settingBasemap}
              onClick={handleSetBasemapFromPath}
              className="w-full rounded bg-primary px-2 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50"
            >
              {settingBasemap ? '…' : 'ثبت نقشه پایه'}
            </button>
          </div>
        )}
      </div>

      {showAdd && (
        <div className="mx-3 mb-3 space-y-2 rounded-lg border border-muted bg-gray-50/80 p-2 dark:bg-gray-100/30">
          <Text className="text-[10px] font-semibold text-primary">
            افزودن لایهٔ شخصی (path-only)
          </Text>
          <Text className="text-[10px] text-gray-500">
            مسیر نسبی زیر MAP_LAYERS_ROOT روی storage — مرور را بزنید و پوشه را انتخاب کنید. لایه به نام شما ثبت می‌شود.
          </Text>
          <MapLayersFolderPicker value={importPath} onChange={setImportPath} />
          <input
            type="text"
            value={importName}
            onChange={(e) => setImportName(e.target.value)}
            placeholder="نام نمایشی (اختیاری)"
            className="w-full rounded border border-muted bg-white px-2 py-1 text-xs dark:bg-gray-50"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
            >
              انصراف
            </button>
            <button
              type="button"
              disabled={importing}
              onClick={handleImport}
              className="rounded bg-primary px-3 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50"
            >
              {importing ? '…' : 'ثبت لایه'}
            </button>
          </div>
        </div>
      )}

      <div className="max-h-48 space-y-1 overflow-y-auto px-2 pb-3">
        {loading && layers.length === 0 && (
          <Text className="px-1 text-xs text-gray-400">در حال بارگذاری…</Text>
        )}
        {!loading && layers.length === 0 && (
          <Text className="px-1 text-xs text-gray-400">لایه‌ای ثبت نشده</Text>
        )}
        {displayLayers.map((layer) => {
          const visible = visibleIds.has(layer.id);
          const canMap = isRasterCatalogKind(layer.layer_kind) && !isBasemapCatalogKind(layer.layer_kind);
          const isBasemap = isBasemapCatalogKind(layer.layer_kind);
          const isActiveBasemap = basemapLayerId === layer.id;
          const orderPos = orderIds.indexOf(layer.id);
          const opacity = opacityById[layer.id] ?? DEFAULT_OPACITY;
          return (
            <div
              key={layer.id}
              className={cn(
                'rounded border px-2 py-1.5',
                isActiveBasemap
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-muted/80 bg-white/60 dark:bg-gray-50/40'
              )}
            >
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={!canMap}
                  title={canMap ? (visible ? 'مخفی' : 'نمایش') : 'نوع لایه روی نقشه پشتیبانی نمی‌شود'}
                  onClick={() => canMap && toggleVisible(layer)}
                  className={cn(
                    'shrink-0 rounded p-0.5',
                    canMap ? 'hover:bg-gray-100' : 'cursor-not-allowed opacity-40'
                  )}
                >
                  {visible && canMap ? (
                    <PiEyeBold className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <PiEyeSlashBold className="h-3.5 w-3.5 text-gray-400" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <Text className="truncate text-xs font-medium text-gray-700 dark:text-gray-300">
                    {layer.name}
                  </Text>
                  <Text className="truncate font-mono text-[9px] text-gray-400">
                    {kindLabel(layer.layer_kind)}
                    {layer.storage_root ? ` · ${layer.storage_root}` : ''}
                  </Text>
                </div>
                {canMap && (
                  <div className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      title="انتقال به بالا"
                      disabled={orderPos <= 0}
                      onClick={() => moveLayer(layer.id, -1)}
                      className="rounded p-0.5 hover:bg-gray-100 disabled:opacity-30"
                    >
                      <PiArrowUpBold className="h-3 w-3 text-gray-400" />
                    </button>
                    <button
                      type="button"
                      title="انتقال به پایین"
                      disabled={orderPos < 0 || orderPos >= orderIds.length - 1}
                      onClick={() => moveLayer(layer.id, 1)}
                      className="rounded p-0.5 hover:bg-gray-100 disabled:opacity-30"
                    >
                      <PiArrowDownBold className="h-3 w-3 text-gray-400" />
                    </button>
                  </div>
                )}
                {isBasemap && (
                  <button
                    type="button"
                    title={isActiveBasemap ? 'نقشه پایه فعال' : 'تنظیم به‌عنوان نقشه پایه'}
                    disabled={settingBasemap || isActiveBasemap}
                    onClick={() => handleSetBasemapLayer(layer)}
                    className={cn(
                      'shrink-0 rounded p-0.5',
                      isActiveBasemap ? 'text-primary' : 'hover:bg-primary/10 text-gray-400'
                    )}
                  >
                    <PiGlobeBold className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  title="حذف"
                  onClick={() => handleRemove(layer)}
                  className="shrink-0 rounded p-0.5 hover:bg-red-50"
                >
                  <PiTrashBold className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
                </button>
              </div>
              {canMap && visible && (
                <div className="mt-1.5 flex items-center gap-2">
                  <Text className="w-9 shrink-0 text-[10px] text-gray-400">
                    {Math.round(opacity * 100)}%
                  </Text>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={opacity}
                    onChange={(e) => handleOpacity(layer, parseFloat(e.target.value))}
                    className="h-1 w-full cursor-pointer accent-primary"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
