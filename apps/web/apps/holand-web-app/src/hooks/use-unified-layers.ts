// ============================================
// useUnifiedLayers — merge every map layer source into one flat, ordered list
// with a single set of actions (toggle / move / opacity / delete).
// Every row is reorderable — the user controls z-order for all layer types.
// ============================================
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import toast from 'react-hot-toast';
import { geoLocationService } from '@/services/geo-location.service';
import type { MapCatalogLayer } from '@/types/map-layers.types';
import type { MapCoreRef, CustomLayerConfig, BasemapStackSlot } from '@/app/shared/map';
import type { RasterLayer } from '@/app/shared/map/raster-layers-panel';
import {
  fetchPmtilesStyleUrls,
  pmtilesStyleUrlsFromCatalogLayer,
  catalogLayerPmtilesUrl,
  catalogLayerTileUrl,
  fetchCatalogRasterMaxZoom,
  getSasTileRole,
  isPmtilesCatalogKind,
  isRasterCatalogKind,
  isSasLabelsCatalogLayer,
  isSasSatelliteCatalogLayer,
  isStreetviewCatalogKind,
  catalogLayerTileExt,
  type PmtilesStyleUrls,
} from '@/lib/map-storage-url';
import {
  listChatLayers,
  subscribeChatLayers,
  setChatLayerVisibility,
  setChatLayerOpacity,
  removeChatLayer,
  getChatLayer,
  buildLayerExport,
  addUserGeoJsonLayer,
} from '@/app/(hydrogen)/map-chat/lib/executors';
import type { UnifiedLayerItem, LayerScopeDot } from '@/app/shared/map/unified-layers.types';
import type { LayerStackPrefs } from '@/types/map-layer-stack-prefs.types';
import {
  DEFAULT_CATALOG_OPACITY,
  LAYER_KEY,
  LAYER_STACK_SCHEMA_VERSION,
  SAVE_DEBOUNCE_MS,
} from '@/lib/map-layer-stack-contract';
import { applyLayerStackPrefs, buildDefaultOrder } from '@/lib/layer-stack-prefs';
import { getLocalLayer, localLayerRuntimeUrl } from '@/lib/map-local-layer-store';
import type { AddLayerResult } from '@/app/shared/map/add-layer-wizard';
import { kindLabel } from '@/lib/map-layer-detect-client';

const CATALOG_LAYER_PREFIX = 'catalog-';
const USER_LAYER_PREFIX = 'user-layer-';

function resolveStackLayerIds(
  item: UnifiedLayerItem,
  mapHandle: MapCoreRef,
  stylePmtilesLayerId: string | null
): string[] {
  if (!item.visible) return [];
  switch (item.source) {
    // The vector basemap, satellite imagery and SAS labels overlay are NOT moved
    // via moveLayer — their relative z-order is baked into the style as three
    // contiguous slots (see setBasemapStackSlots). Returning [] here keeps the
    // basemap block's internal order intact (borders/labels never get scrambled).
    case 'vector-overlay':
      return [];
    case 'satellite':
      return [];
    case 'catalog':
      if (item.layerKind && isPmtilesCatalogKind(item.layerKind)) {
        return [];
      }
      // SAS imagery / labels overlay are positioned by the style slot order.
      if (item.catalogSasRole === 'satellite_imagery') return [];
      if (item.catalogSasRole === 'labels_overlay') return [];
      return [`${USER_LAYER_PREFIX}${CATALOG_LAYER_PREFIX}${item.rawId}-raster`];
    case 'custom': {
      const cl = mapHandle.getCustomLayers().find((l) => l.id === item.rawId);
      const base = `${USER_LAYER_PREFIX}${item.rawId}`;
      if (!cl) return [];
      if (cl.type === 'raster') return [`${base}-raster`];
      return [`${base}-fill`, `${base}-line`, `${base}-circle`];
    }
    case 'chat': {
      const c = listChatLayers().find((x) => x.id === item.rawId);
      return c?.layerIds ?? [];
    }
    default:
      return [];
  }
}

/**
 * Map a panel row to its basemap render slot for z-order (includes hidden rows so
 * toggling visibility does not reshuffle the style stack).
 */
function resolveBasemapSlotForOrder(item: UnifiedLayerItem): BasemapStackSlot | null {
  switch (item.source) {
    case 'vector-overlay':
      return 'basemap';
    case 'satellite':
      return 'satellite';
    case 'catalog':
      if (item.layerKind && isPmtilesCatalogKind(item.layerKind)) return 'basemap';
      if (item.catalogSasRole === 'satellite_imagery') return 'satellite';
      if (item.catalogSasRole === 'labels_overlay') return 'labelsOverlay';
      return null;
    default:
      return null;
  }
}

export interface UseUnifiedLayersInput {
  mapHandle: MapCoreRef | null;
  customLayers: CustomLayerConfig[];
  onCustomLayersChange: (layers: CustomLayerConfig[]) => void;
  rasterLayers: RasterLayer[];
  onRasterLayersChange: (layers: RasterLayer[]) => void;
  vectorOverlay: boolean;
  onVectorOverlayChange: (visible: boolean) => void;
  /** @deprecated Panel visibility uses catalogVisibleIds — kept for legacy callers. */
  baseMapVisible?: boolean;
  /** @deprecated */
  onBaseMapToggle?: (visible: boolean) => void;
  streetViewFolders: string[];
  onStreetViewFoldersChange: (folders: string[] | ((prev: string[]) => string[])) => void;
  streetViewLayerIds: string[];
  onStreetViewLayerIdsChange: (ids: string[] | ((prev: string[]) => string[])) => void;
  showStreetView: boolean;
  onShowStreetViewChange: (visible: boolean) => void;
  /** Panel picked a visible PMTiles layer — update MapCore style tile URLs. */
  onPmtilesStyleChanged?: (urls: PmtilesStyleUrls | null) => void;
  /** @deprecated Legacy raster panel — catalog SAS layers drive imagery via stackControls. */
  onUnifiedSasManagedChange?: (managed: boolean) => void;
}

export interface LayerStackControls {
  /** Any catalog layer with sas_role satellite_imagery is visible. */
  sasImageryVisible: boolean;
  toggleSasImagery: () => void;
  clearAllLayerVisibility: () => void;
  restoreLayerVisibility: (snap: LayerVisibilitySnapshot) => void;
  /** @deprecated */
  clearCatalogOverlays: () => void;
  /** @deprecated */
  restoreCatalogOverlays: (ids: string[]) => void;
  getVisibleCatalogIds: () => string[];
  /** @deprecated */
  getVisibleOverlayIds: () => string[];
  snapshotLayerVisibility: () => LayerVisibilitySnapshot;
}

export interface LayerVisibilitySnapshot {
  visibleCatalogIds: string[];
}

export interface UseUnifiedLayersResult {
  items: UnifiedLayerItem[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  handleLayerAdded: (result?: AddLayerResult) => Promise<void>;
  toggle: (item: UnifiedLayerItem) => void;
  move: (item: UnifiedLayerItem, dir: -1 | 1) => void;
  setOpacity: (item: UnifiedLayerItem, value: number) => void;
  remove: (item: UnifiedLayerItem) => void;
  reorderDragEnd: (event: DragEndEvent) => void;
  stackControls: LayerStackControls;
}

function catalogKindLabel(kind: string): string {
  if (kind.startsWith('raster_')) return kind.replace('raster_', '').toUpperCase();
  if (kind.startsWith('vector_')) return kind.replace('vector_', '').toUpperCase();
  if (kind.startsWith('streetview')) return 'Street View';
  return kind;
}

function catalogKindLabelForLayer(layer: MapCatalogLayer): string {
  if (layer.import_status === 'kind_mismatch' && layer.detected_kind) {
    return kindLabel(layer.detected_kind ?? undefined);
  }
  return catalogKindLabel(layer.layer_kind);
}

function catalogStreetViewRoots(layers: MapCatalogLayer[]): Set<string> {
  return new Set(
    layers
      .filter((l) => isStreetviewCatalogKind(l.layer_kind) && l.storage_root)
      .map((l) => l.storage_root as string)
  );
}

function isValidStreetviewCatalogLayer(layer: MapCatalogLayer): boolean {
  return (
    isStreetviewCatalogKind(layer.layer_kind) &&
    layer.import_status !== 'kind_mismatch' &&
    layer.data_available !== false
  );
}

function catalogLayerUnavailable(layer: MapCatalogLayer): boolean {
  if (layer.enabled === false) return true;
  const status = (layer.import_status || '').toLowerCase();
  if (status === 'failed' || status === 'error' || status === 'missing' || status === 'kind_mismatch')
    return true;
  if (layer.data_available === false) return true;
  if (layer.storage_root && layer.data_available !== true && status !== 'ready') return true;
  return false;
}

function visiblePmtilesIds(
  catalogLayers: MapCatalogLayer[],
  catalogVisibleIds: Set<string>
): string[] {
  return catalogLayers
    .filter((l) => isPmtilesCatalogKind(l.layer_kind) && catalogVisibleIds.has(l.id))
    .map((l) => l.id);
}

/** Prefer vector_pmtiles (layer-vector) over raster_pmtiles when picking the style source. */
function pickVisiblePmtilesWinner(
  pmtilesIds: string[],
  catalogLayers: MapCatalogLayer[],
  listOrderIds: string[]
): string | null {
  if (!pmtilesIds.length) return null;
  const vectorIds = pmtilesIds.filter(
    (id) => catalogLayers.find((l) => l.id === id)?.layer_kind === 'vector_pmtiles'
  );
  const pool = vectorIds.length > 0 ? vectorIds : pmtilesIds;

  for (const uid of listOrderIds) {
    if (!uid.startsWith('catalog:')) continue;
    const id = uid.slice('catalog:'.length);
    if (pool.includes(id)) return id;
  }
  for (const id of pmtilesIds) {
    if (pool.includes(id)) return id;
  }
  return pool[0] ?? null;
}

function pickStylePmtilesLayerId(
  catalogLayers: MapCatalogLayer[],
  catalogVisibleIds: Set<string>,
  listOrderIds: string[]
): string | null {
  return pickVisiblePmtilesWinner(
    visiblePmtilesIds(catalogLayers, catalogVisibleIds),
    catalogLayers,
    listOrderIds
  );
}

/** MapLibre style holds one PMTiles bundle — keep a single visible PMTiles row. */
function enforceSingleVisiblePmtiles(
  visibleIds: Set<string>,
  catalogLayers: MapCatalogLayer[],
  listOrderIds: string[]
): Set<string> {
  const pmtilesIds = visiblePmtilesIds(catalogLayers, visibleIds);
  if (pmtilesIds.length <= 1) return visibleIds;

  const winner = pickVisiblePmtilesWinner(pmtilesIds, catalogLayers, listOrderIds);
  if (!winner) return visibleIds;

  const next = new Set(visibleIds);
  for (const id of pmtilesIds) {
    if (id !== winner) next.delete(id);
  }
  return next;
}

function catalogScopeDot(layer: MapCatalogLayer, currentUserId: string): LayerScopeDot {
  if (
    currentUserId &&
    layer.owner_user_id &&
    layer.owner_user_id === currentUserId
  ) {
    return 'personal';
  }
  if (catalogLayerUnavailable(layer)) return 'global-blocked';
  return 'global-ok';
}

export function useUnifiedLayers(input: UseUnifiedLayersInput): UseUnifiedLayersResult {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? '';

  const {
    mapHandle,
    customLayers,
    onCustomLayersChange,
    rasterLayers,
    onRasterLayersChange,
    vectorOverlay,
    onVectorOverlayChange,
    streetViewFolders,
    onStreetViewFoldersChange,
    streetViewLayerIds,
    onStreetViewLayerIdsChange,
    showStreetView,
    onShowStreetViewChange,
    onPmtilesStyleChanged,
    onUnifiedSasManagedChange,
  } = input;

  const [catalogLayers, setCatalogLayers] = useState<MapCatalogLayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [catalogVisibleIds, setCatalogVisibleIds] = useState<Set<string>>(new Set());
  const [opacityById, setOpacityById] = useState<Record<string, number>>({});
  // Top-first z-order for the entire panel (every layer type — user decides stacking).
  const [listOrderIds, setListOrderIds] = useState<string[]>([]);
  // Re-render trigger for chat layer changes (multi-subscriber safe).
  const [chatTick, setChatTick] = useState(0);
  // Flips true after the first prefs fetch so the chat-restore effect can run.
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const opacityRef = useRef<Record<string, number>>({});
  const mountedRef = useRef(true);

  // Per-user persisted panel layout (order/opacity/visibility + chat snapshots).
  const savedPrefsRef = useRef<LayerStackPrefs | null>(null);
  const prefsLoadedRef = useRef(false);
  const chatRestoredRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef(input);
  inputRef.current = input;
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const lastPmtilesStyleRef = useRef<string>('');
  const configuredSatRef = useRef<{ id: string; url: string; maxZoom?: number } | null>(null);
  const configuredLabelsRef = useRef<{ id: string; url: string; maxZoom?: number } | null>(null);
  const lastStackApplyKeyRef = useRef('');

  const pushPmtilesStyleUrls = useCallback((urls: PmtilesStyleUrls | null) => {
    const key = urls ? JSON.stringify(urls) : '';
    if (key === lastPmtilesStyleRef.current) return;
    lastPmtilesStyleRef.current = key;
    inputRef.current.onPmtilesStyleChanged?.(urls);
  }, []);

  const initialLoadDoneRef = useRef(false);

  const mapLayerId = (id: string) => `${CATALOG_LAYER_PREFIX}${id}`;

  const refresh = useCallback(async () => {
    const {
      mapHandle,
      customLayers,
      onCustomLayersChange,
      rasterLayers,
      onRasterLayersChange,
      onStreetViewFoldersChange,
      onShowStreetViewChange,
    } = inputRef.current;

    setLoading(true);
    setError('');
    const applyPrefsLayout = !prefsLoadedRef.current;
    const isRepeatLoad = initialLoadDoneRef.current;
    try {
      const [resp, prefs] = await Promise.all([
        geoLocationService.listMapLayers({ limit: 200 }),
        isRepeatLoad
          ? Promise.resolve(savedPrefsRef.current)
          : geoLocationService.getLayerStackPrefs().catch(() => null),
      ]);
      if (!mountedRef.current) return;
      initialLoadDoneRef.current = true;

      setCatalogLayers(resp.items);

      const svRoots = catalogStreetViewRoots(resp.items);
      onStreetViewFoldersChange((folders) => {
        const cleaned = folders.filter((f) => !svRoots.has(f));
        return cleaned.length === folders.length ? folders : cleaned;
      });

      if (prefs) {
        savedPrefsRef.current = prefs;
        if (applyPrefsLayout) {
          applyLayerStackPrefs({
            prefs,
            mapHandle,
            customLayers,
            rasterLayers,
            onCustomLayersChange,
            onRasterLayersChange,
            onStreetViewFoldersChange,
            onShowStreetViewChange,
          });
          if (mapHandle && prefs.layers) {
            await restoreLocalLayersFromPrefs(
              prefs.layers,
              mapHandle,
              customLayers,
              onCustomLayersChange
            );
          }
          prefsLoadedRef.current = true;
          setPrefsLoaded(true);
        }
      }

      const savedLayers = applyPrefsLayout ? (prefs?.layers ?? {}) : {};

      // Seed catalog opacity from saved prefs (initial load only).
      if (applyPrefsLayout) {
        const seededOpacity: Record<string, number> = {};
        for (const item of resp.items) {
          const entry = savedLayers[LAYER_KEY.catalog(item.id)];
          if (entry && typeof entry.opacity === 'number') seededOpacity[item.id] = entry.opacity;
        }
        if (Object.keys(seededOpacity).length) {
          opacityRef.current = { ...opacityRef.current, ...seededOpacity };
          setOpacityById((prev) => ({ ...prev, ...seededOpacity }));
        }
      }

      setCatalogVisibleIds((prev) => {
        const next = new Set<string>();
        for (const item of resp.items) {
          if (isStreetviewCatalogKind(item.layer_kind) && !isValidStreetviewCatalogLayer(item)) {
            continue;
          }
          if (applyPrefsLayout) {
            const entry = savedLayers[LAYER_KEY.catalog(item.id)];
            const visible =
              entry && typeof entry.visible === 'boolean'
                ? entry.visible
                : prev.has(item.id) ||
                  (isPmtilesCatalogKind(item.layer_kind) ? true : item.enabled !== false);
            if (visible) next.add(item.id);
          } else if (prev.has(item.id)) {
            next.add(item.id);
          }
        }
        const order = applyPrefsLayout
          ? prefs?.order?.length
            ? prefs.order
            : buildDefaultOrder({
                catalogLayers: resp.items,
                currentUserId,
                customLayerIds: Object.keys(savedLayers)
                  .filter((k) => k.startsWith('custom:'))
                  .map((k) => k.slice('custom:'.length)),
                rasterLayerIds: Object.keys(savedLayers)
                  .filter((k) => k.startsWith('raster:'))
                  .map((k) => k.slice('raster:'.length)),
                chatLayerIds: Object.keys(savedLayers)
                  .filter((k) => k.startsWith('chat:'))
                  .map((k) => k.slice('chat:'.length)),
                hasStreetView: false,
                hasVectorOverlay: false,
              })
          : listOrderIds;
        const normalized = enforceSingleVisiblePmtiles(next, resp.items, order);
        if (
          normalized.size === prev.size &&
          [...normalized].every((id) => prev.has(id))
        ) {
          return prev;
        }
        return normalized;
      });

      if (applyPrefsLayout) {
        const defaultOrderArgs = {
          catalogLayers: resp.items,
          currentUserId,
          customLayerIds: Object.keys(savedLayers)
            .filter((k) => k.startsWith('custom:'))
            .map((k) => k.slice('custom:'.length)),
          rasterLayerIds: Object.keys(savedLayers)
            .filter((k) => k.startsWith('raster:'))
            .map((k) => k.slice('raster:'.length)),
          chatLayerIds: Object.keys(savedLayers)
            .filter((k) => k.startsWith('chat:'))
            .map((k) => k.slice('chat:'.length)),
          hasStreetView: Boolean(savedLayers[LAYER_KEY.streetview]?.folders?.length),
          hasVectorOverlay: Boolean(savedLayers[LAYER_KEY.vectorOverlay]?.visible),
        };
        if (prefs?.order?.length) {
          setListOrderIds(prefs.order);
        } else {
          setListOrderIds(buildDefaultOrder(defaultOrderArgs));
        }
      } else {
        setListOrderIds((prev) => {
          const liveCatalogIds = new Set(
            resp.items.map((item) => LAYER_KEY.catalog(item.id))
          );
          const pruned = prev.filter((id) => !id.startsWith('catalog:') || liveCatalogIds.has(id));
          if (pruned.length === prev.length && pruned.every((id, i) => id === prev[i])) return prev;
          return pruned;
        });
      }
    } catch (e: unknown) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : 'Failed to load layers');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [currentUserId]);

  const stylePmtilesLayerId = useMemo(
    () => pickStylePmtilesLayerId(catalogLayers, catalogVisibleIds, listOrderIds),
    [catalogLayers, catalogVisibleIds, listOrderIds]
  );

  const pmtilesBasemapVisible = Boolean(
    stylePmtilesLayerId && catalogVisibleIds.has(stylePmtilesLayerId)
  );

  /** Stable key — only changes when visible SAS satellite/labels rows change. */
  const sasVisibilityKey = useMemo(() => {
    const satId =
      catalogLayers.find(
        (l) => isSasSatelliteCatalogLayer(l) && catalogVisibleIds.has(l.id)
      )?.id ?? '';
    const labelsId =
      catalogLayers.find(
        (l) => isSasLabelsCatalogLayer(l) && catalogVisibleIds.has(l.id)
      )?.id ?? '';
    return `${satId}|${labelsId}`;
  }, [catalogLayers, catalogVisibleIds]);

  const stylePmtilesLayerIdRef = useRef<string | null>(null);
  stylePmtilesLayerIdRef.current = stylePmtilesLayerId;

  refreshRef.current = refresh;

  useEffect(() => {
    mountedRef.current = true;
    void refreshRef.current();
    const unsub = subscribeChatLayers(() => setChatTick((t) => t + 1));
    return () => {
      mountedRef.current = false;
      unsub();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // PMTiles vector basemap — only re-sync when the active PMTiles layer or its
  // visibility changes. MUST NOT depend on catalogVisibleIds wholesale (SAS toggles
  // would re-fetch world tiles and trigger a full MapCore setStyle rebuild).
  useEffect(() => {
    if (!mapHandle) return;
    let cancelled = false;

    (async () => {
      if (pmtilesBasemapVisible && stylePmtilesLayerId) {
        const layer = catalogLayers.find((l) => l.id === stylePmtilesLayerId);
        const seed = layer
          ? pmtilesStyleUrlsFromCatalogLayer(layer)
          : { main: catalogLayerPmtilesUrl(stylePmtilesLayerId) };
        mapHandle.setRegionalPmtilesUrl(seed.main);
        pushPmtilesStyleUrls(seed);
        mapHandle.setBaseMapVisible(true);

        const urls = await fetchPmtilesStyleUrls(
          stylePmtilesLayerId,
          layer ?? { id: stylePmtilesLayerId }
        );
        if (!cancelled && urls.main) {
          mapHandle.setRegionalPmtilesUrl(urls.main);
          pushPmtilesStyleUrls(urls);
          mapHandle.setBaseMapVisible(true);
        }
      } else if (prefsLoadedRef.current && !loading) {
        mapHandle.setBaseMapVisible(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    mapHandle,
    catalogLayers,
    stylePmtilesLayerId,
    pmtilesBasemapVisible,
    loading,
    pushPmtilesStyleUrls,
  ]);

  // SAS satellite + labels overlay — visibility toggles use layout visibility only.
  useEffect(() => {
    if (!mapHandle) return;
    let cancelled = false;

    (async () => {
      if (
        configuredSatRef.current &&
        !catalogLayers.some((l) => l.id === configuredSatRef.current?.id)
      ) {
        mapHandle.setSatellite('');
        configuredSatRef.current = null;
      }
      if (
        configuredLabelsRef.current &&
        !catalogLayers.some((l) => l.id === configuredLabelsRef.current?.id)
      ) {
        mapHandle.setLabelsOverlay('');
        configuredLabelsRef.current = null;
      }

      const satLayer = catalogLayers.find(
        (l) => isSasSatelliteCatalogLayer(l) && catalogVisibleIds.has(l.id)
      );
      const labelsLayer = catalogLayers.find(
        (l) => isSasLabelsCatalogLayer(l) && catalogVisibleIds.has(l.id)
      );

      onUnifiedSasManagedChange?.(Boolean(satLayer || labelsLayer));

      if (satLayer) {
        const maxZoom =
          satLayer.max_zoom ?? (await fetchCatalogRasterMaxZoom(satLayer.id));
        if (cancelled) return;
        const satUrl = catalogLayerTileUrl(
          satLayer.id,
          catalogLayerTileExt(satLayer)
        );
        const satOp =
          opacityRef.current[satLayer.id] ?? DEFAULT_CATALOG_OPACITY;
        mapHandle.setSatelliteOpacity(satOp);
        const prevSat = configuredSatRef.current;
        if (!prevSat || prevSat.id !== satLayer.id || prevSat.url !== satUrl) {
          mapHandle.setSatellite(satUrl, maxZoom);
          configuredSatRef.current = { id: satLayer.id, url: satUrl, maxZoom };
        }
        mapHandle.setSatelliteVisible(true);
      } else if (configuredSatRef.current) {
        mapHandle.setSatelliteVisible(false);
      }

      if (labelsLayer) {
        const lMax =
          labelsLayer.max_zoom ?? (await fetchCatalogRasterMaxZoom(labelsLayer.id));
        if (cancelled) return;
        const labelsUrl = catalogLayerTileUrl(
          labelsLayer.id,
          catalogLayerTileExt(labelsLayer)
        );
        const labelsOp =
          opacityRef.current[labelsLayer.id] ?? DEFAULT_CATALOG_OPACITY;
        mapHandle.setLabelsOverlayOpacity(labelsOp);
        const prevLabels = configuredLabelsRef.current;
        if (
          !prevLabels ||
          prevLabels.id !== labelsLayer.id ||
          prevLabels.url !== labelsUrl
        ) {
          mapHandle.setLabelsOverlay(labelsUrl, lMax);
          configuredLabelsRef.current = {
            id: labelsLayer.id,
            url: labelsUrl,
            maxZoom: lMax,
          };
        }
        mapHandle.setLabelsOverlayVisible(true);
      } else if (configuredLabelsRef.current) {
        mapHandle.setLabelsOverlayVisible(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mapHandle, catalogLayers, sasVisibilityKey, onUnifiedSasManagedChange]);

  // Ensure SAS layers are never registered as duplicate custom raster layers.
  useEffect(() => {
    if (!mapHandle) return;
    for (const layer of catalogLayers) {
      if (isSasSatelliteCatalogLayer(layer) || isSasLabelsCatalogLayer(layer)) {
        mapHandle.removeCustomLayer(mapLayerId(layer.id));
      }
    }
  }, [mapHandle, catalogLayers]);

  // Non-SAS catalog rasters (XYZ etc.) via custom layers.
  useEffect(() => {
    if (!mapHandle) return;
    let cancelled = false;
    (async () => {
      for (const layer of catalogLayers) {
        const mlId = mapLayerId(layer.id);
        if (isPmtilesCatalogKind(layer.layer_kind)) {
          mapHandle.removeCustomLayer(mlId);
          continue;
        }
        if (!isRasterCatalogKind(layer.layer_kind)) continue;
        if (isSasSatelliteCatalogLayer(layer) || isSasLabelsCatalogLayer(layer)) continue;

        const visible = catalogVisibleIds.has(layer.id);
        if (!visible) {
          mapHandle.setCustomLayerVisibility(mlId, false);
          continue;
        }
        const existing = mapHandle.getCustomLayers().find((l) => l.id === mlId);
        if (existing) {
          mapHandle.setCustomLayerVisibility(mlId, true);
          const op = opacityRef.current[layer.id] ?? DEFAULT_CATALOG_OPACITY;
          mapHandle.setCustomLayerOpacity(mlId, op);
          continue;
        }
        const maxZoom =
          layer.max_zoom ?? (await fetchCatalogRasterMaxZoom(layer.id));
        if (cancelled) return;
        mapHandle.addCustomLayer({
          id: mlId,
          name: layer.name,
          type: 'raster',
          url: catalogLayerTileUrl(
            layer.id,
            (layer.source_config?.tile_ext as string) || 'jpg'
          ),
          visible: true,
          opacity: opacityRef.current[layer.id] ?? DEFAULT_CATALOG_OPACITY,
          maxZoom,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mapHandle, catalogLayers, catalogVisibleIds]);

  // Apply PMTiles vector opacity for the active style layer.
  useEffect(() => {
    if (!mapHandle || !stylePmtilesLayerId) return;
    const op = opacityRef.current[stylePmtilesLayerId] ?? opacityById[stylePmtilesLayerId] ?? 1;
    mapHandle.setRegionalStyleOpacity(op);
  }, [mapHandle, stylePmtilesLayerId, opacityById]);

  // ---- Item assembly (default order before user drag reorder) ----
  const baseItems = useMemo<UnifiedLayerItem[]>(() => {
    const out: UnifiedLayerItem[] = [];
    const stackMeta = {
      canReorder: true as const,
      reorderGroup: 'stack' as const,
    };

    for (const layer of catalogLayers) {
      const isPmtiles = isPmtilesCatalogKind(layer.layer_kind);
      const isRaster = isRasterCatalogKind(layer.layer_kind);
      const isStreetview = isStreetviewCatalogKind(layer.layer_kind);
      if (!isPmtiles && !isRaster && !isStreetview) continue;

      const sasRole = isRaster ? getSasTileRole(layer) : undefined;
      out.push({
        id: LAYER_KEY.catalog(layer.id),
        rawId: layer.id,
        name: layer.name,
        source: 'catalog',
        kindLabel: catalogKindLabelForLayer(layer),
        layerKind: layer.layer_kind,
        catalogSasRole: sasRole,
        visible: isStreetview
          ? showStreetView && catalogVisibleIds.has(layer.id)
          : catalogVisibleIds.has(layer.id),
        opacity: opacityById[layer.id] ?? (isPmtiles ? 1 : DEFAULT_CATALOG_OPACITY),
        canOpacity: true,
        canDelete: true,
        scopeDot: catalogScopeDot(layer, currentUserId),
        isStylePmtilesSource: isPmtiles && layer.id === stylePmtilesLayerId,
        ...stackMeta,
      });
    }

    for (const r of rasterLayers) {
      out.push({
        id: LAYER_KEY.raster(r.id),
        rawId: r.id,
        name: r.name,
        source: 'satellite',
        kindLabel: r.type === 'sas' ? 'SAS' : 'XYZ',
        visible: r.visible,
        canOpacity: false,
        canDelete: true,
        scopeDot: 'personal' as const,
        ...stackMeta,
      });
    }

    for (const layer of customLayers) {
      out.push({
        id: LAYER_KEY.custom(layer.id),
        rawId: layer.id,
        name: layer.name,
        source: 'custom',
        kindLabel: layer.type === 'raster' ? 'XYZ' : 'GeoJSON',
        visible: layer.visible,
        opacity: layer.opacity,
        canOpacity: true,
        canDelete: true,
        scopeDot: 'personal',
        ...stackMeta,
      });
    }

    const svRoots = catalogStreetViewRoots(catalogLayers);
    const orphanStreetViewFolders = streetViewFolders.filter((f) => !svRoots.has(f));

    if (orphanStreetViewFolders.length > 0) {
      out.push({
        id: LAYER_KEY.streetview,
        rawId: 'streetview',
        name: `Street View (${orphanStreetViewFolders.length})`,
        source: 'streetview',
        kindLabel: 'Pano',
        visible: showStreetView,
        canOpacity: false,
        canDelete: true,
        scopeDot: 'personal',
        ...stackMeta,
      });
    }

    void chatTick;
    for (const c of listChatLayers()) {
      out.push({
        id: LAYER_KEY.chat(c.id),
        rawId: c.id,
        name: c.name,
        source: 'chat',
        kindLabel: c.kind,
        visible: c.visible,
        opacity: c.opacity,
        canOpacity: true,
        canDelete: true,
        scopeDot: 'ai',
        ...stackMeta,
      });
    }

    return out;
  }, [
    catalogLayers,
    stylePmtilesLayerId,
    rasterLayers,
    vectorOverlay,
    catalogVisibleIds,
    opacityById,
    customLayers,
    streetViewFolders,
    showStreetView,
    chatTick,
    currentUserId,
  ]);

  const baseItemIdsKey = useMemo(() => baseItems.map((i) => i.id).join('|'), [baseItems]);

  useEffect(() => {
    const currentIds = baseItems.map((i) => i.id);
    setListOrderIds((prev) => {
      const known = prev.filter((id) => currentIds.includes(id));
      const added = currentIds.filter((id) => !known.includes(id));
      if (added.length === 0 && known.length === prev.length && known.every((id, i) => id === prev[i])) {
        return prev;
      }
      return [...known, ...added];
    });
  }, [baseItemIdsKey]);

  const items = useMemo(() => {
    const byId = new Map(baseItems.map((i) => [i.id, i] as const));
    const ordered: UnifiedLayerItem[] = [];
    for (const id of listOrderIds) {
      const item = byId.get(id);
      if (item) ordered.push(item);
    }
    for (const item of baseItems) {
      if (!listOrderIds.includes(item.id)) ordered.push(item);
    }
    return ordered;
  }, [baseItems, listOrderIds]);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const listOrderRef = useRef(listOrderIds);
  listOrderRef.current = listOrderIds;

  // ---- Persisted panel layout (per-user) ----
  const buildStackPrefs = useCallback((): LayerStackPrefs => {
    const layers: LayerStackPrefs['layers'] = {};
    for (const item of itemsRef.current) {
      const entry: LayerStackPrefs['layers'][string] = { visible: item.visible };
      if (typeof item.opacity === 'number') entry.opacity = item.opacity;
      if (item.source === 'chat') {
        const snap = buildLayerExport(item.rawId);
        if (snap) entry.geojson = snap;
        const cl = getChatLayer(item.rawId);
        if (cl) {
          entry.name = cl.name;
          entry.kind = cl.kind;
        }
      } else if (item.source === 'custom') {
        const cl = customLayers.find((l) => l.id === item.rawId);
        if (cl) {
          entry.def = {
            type: cl.type,
            name: cl.name,
            url: cl.url,
            localId: cl.id,
            fileName: cl.fileName,
          };
        }
      } else if (item.source === 'satellite') {
        const r = rasterLayers.find((x) => x.id === item.rawId);
        if (r) {
          entry.source = r.source;
          entry.type = r.type;
        }
      } else if (item.source === 'streetview') {
        entry.folders = streetViewFolders.slice();
      }
      layers[item.id] = entry;
    }
    return {
      version: LAYER_STACK_SCHEMA_VERSION,
      order: listOrderRef.current.slice(),
      layers,
    };
  }, [customLayers, rasterLayers, streetViewFolders]);

  const scheduleSavePrefs = useCallback(() => {
    if (!prefsLoadedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const prefs = buildStackPrefs();
      savedPrefsRef.current = prefs;
      geoLocationService.saveLayerStackPrefs(prefs).catch(() => {});
    }, SAVE_DEBOUNCE_MS);
  }, [buildStackPrefs]);

  // ---- Actions ----
  const pushStackOrderToMap = useCallback(
    (orderTopFirst: string[]) => {
      if (!mapHandle) return;
      const itemsById = new Map(itemsRef.current.map((i) => [i.id, i]));
      const groups: string[][] = [];
      const slotsTopFirst: BasemapStackSlot[] = [];
      for (const uid of orderTopFirst) {
        const item = itemsById.get(uid);
        if (!item) continue;
        // Basemap / satellite / labels-overlay rows: record their panel order so
        // the style can stack them as contiguous blocks (no moveLayer scrambling).
        const slot = resolveBasemapSlotForOrder(item);
        if (slot && !slotsTopFirst.includes(slot)) slotsTopFirst.push(slot);
        const layerIds = resolveStackLayerIds(
          item,
          mapHandle,
          stylePmtilesLayerIdRef.current
        );
        if (layerIds.length) groups.push(layerIds);
      }
      const applyKey = JSON.stringify({ slotsTopFirst, groups });
      if (applyKey === lastStackApplyKeyRef.current) return;
      lastStackApplyKeyRef.current = applyKey;
      mapHandle.reorderStackLayerGroups(groups);
      mapHandle.setBasemapStackSlots(slotsTopFirst);

      const customRegistryIds = orderTopFirst
        .filter((id) => id.startsWith('catalog:') || id.startsWith('custom:'))
        .map((uid) => {
          const parsed = uid.startsWith('catalog:')
            ? { prefix: 'catalog', id: uid.slice('catalog:'.length) }
            : { prefix: 'custom', id: uid.slice('custom:'.length) };
          return parsed.prefix === 'catalog' ? mapLayerId(parsed.id) : parsed.id;
        });
      mapHandle.syncCustomLayerRegistryOrder([...customRegistryIds].reverse());
    },
    [mapHandle]
  );

  const toggle = useCallback(
    (item: UnifiedLayerItem) => {
      switch (item.source) {
        case 'catalog': {
          if (isStreetviewCatalogKind(item.layerKind)) {
            const layer = catalogLayers.find((l) => l.id === item.rawId);
            if (layer && !isValidStreetviewCatalogLayer(layer)) {
              toast.error(
                layer.import_status === 'kind_mismatch'
                  ? `این پوشه Street View نیست — نوع واقعی: ${kindLabel(layer.detected_kind ?? undefined)}`
                  : 'لایه Street View در دسترس نیست'
              );
              break;
            }
            const nextVisible = !item.visible;
            setCatalogVisibleIds((prev) => {
              const next = new Set(prev);
              if (nextVisible) next.add(item.rawId);
              else next.delete(item.rawId);
              return next;
            });
            if (nextVisible) {
              onStreetViewLayerIdsChange((ids) =>
                ids.includes(item.rawId) ? ids : [...ids, item.rawId]
              );
              onShowStreetViewChange(true);
            } else {
              onStreetViewLayerIdsChange((ids) => ids.filter((id) => id !== item.rawId));
            }
          } else {
            setCatalogVisibleIds((prev) => {
              const next = new Set(prev);
              const layer = catalogLayers.find((l) => l.id === item.rawId);
              if (next.has(item.rawId)) {
                next.delete(item.rawId);
              } else {
                if (layer && isPmtilesCatalogKind(layer.layer_kind)) {
                  for (const l of catalogLayers) {
                    if (isPmtilesCatalogKind(l.layer_kind) && l.id !== item.rawId) {
                      next.delete(l.id);
                    }
                  }
                }
                next.add(item.rawId);
              }
              return next;
            });
          }
          break;
        }
        case 'vector-overlay':
          onVectorOverlayChange(!item.visible);
          break;
        case 'satellite':
          // Single active satellite: turning one on turns the others off.
          onRasterLayersChange(
            rasterLayers.map((r) =>
              r.id === item.rawId
                ? { ...r, visible: !item.visible }
                : item.visible
                  ? r
                  : { ...r, visible: false }
            )
          );
          break;
        case 'custom':
          mapHandle?.setCustomLayerVisibility(item.rawId, !item.visible);
          onCustomLayersChange(
            customLayers.map((l) => (l.id === item.rawId ? { ...l, visible: !item.visible } : l))
          );
          break;
        case 'streetview':
          onShowStreetViewChange(!item.visible);
          break;
        case 'chat': {
          const map = mapHandle?.getMap();
          if (map) setChatLayerVisibility(map, item.rawId, !item.visible);
          break;
        }
        default:
          break;
      }
      scheduleSavePrefs();
    },
    [
      mapHandle,
      onVectorOverlayChange,
      onRasterLayersChange,
      rasterLayers,
      opacityById,
      onCustomLayersChange,
      customLayers,
      onShowStreetViewChange,
      scheduleSavePrefs,
      catalogLayers,
      streetViewFolders,
      onStreetViewFoldersChange,
      onStreetViewLayerIdsChange,
    ]
  );

  const move = useCallback(
    (item: UnifiedLayerItem, dir: -1 | 1) => {
      setListOrderIds((prev) => {
        const idx = prev.indexOf(item.id);
        if (idx < 0) return prev;
        const target = idx + dir;
        if (target < 0 || target >= prev.length) return prev;
        const next = [...prev];
        [next[idx], next[target]] = [next[target], next[idx]];
        pushStackOrderToMap(next);
        return next;
      });
      scheduleSavePrefs();
    },
    [pushStackOrderToMap, scheduleSavePrefs]
  );

  const setOpacity = useCallback(
    (item: UnifiedLayerItem, value: number) => {
      const op = Math.max(0, Math.min(1, value));
      if (item.source === 'catalog') {
        opacityRef.current = { ...opacityRef.current, [item.rawId]: op };
        setOpacityById((prev) => ({ ...prev, [item.rawId]: op }));
        if (item.isStylePmtilesSource) {
          mapHandle?.setRegionalStyleOpacity(op);
        } else if (item.catalogSasRole === 'satellite_imagery') {
          mapHandle?.setSatelliteOpacity(op);
        } else if (item.catalogSasRole === 'labels_overlay') {
          mapHandle?.setLabelsOverlayOpacity(op);
        } else {
          mapHandle?.setCustomLayerOpacity(mapLayerId(item.rawId), op);
        }
      } else if (item.source === 'custom') {
        mapHandle?.setCustomLayerOpacity(item.rawId, op);
        onCustomLayersChange(
          customLayers.map((l) => (l.id === item.rawId ? { ...l, opacity: op } : l))
        );
      } else if (item.source === 'chat') {
        const map = mapHandle?.getMap();
        if (map) setChatLayerOpacity(map, item.rawId, op);
      }
      scheduleSavePrefs();
    },
    [mapHandle, onCustomLayersChange, customLayers, scheduleSavePrefs]
  );

  const removingCatalogRef = useRef<Set<string>>(new Set());

  const remove = useCallback(
    (item: UnifiedLayerItem) => {
      switch (item.source) {
        case 'catalog': {
          const layerId = item.rawId;
          if (removingCatalogRef.current.has(layerId)) return;
          removingCatalogRef.current.add(layerId);

          const layer = catalogLayers.find((l) => l.id === layerId);
          setCatalogLayers((prev) => prev.filter((l) => l.id !== layerId));
          setCatalogVisibleIds((prev) => {
            const next = new Set(prev);
            next.delete(layerId);
            return next;
          });
          setListOrderIds((prev) => prev.filter((id) => id !== item.id));
          mapHandle?.removeCustomLayer(mapLayerId(layerId));

          if (layer && isStreetviewCatalogKind(layer.layer_kind)) {
            onStreetViewLayerIdsChange((ids) => ids.filter((id) => id !== layerId));
            if (layer.storage_root) {
              onStreetViewFoldersChange((folders) =>
                folders.filter((f) => f !== layer.storage_root)
              );
            }
          }

          geoLocationService
            .removeMapLayer(layerId, false)
            .then(() => {
              removingCatalogRef.current.delete(layerId);
              toast.success('لایه حذف شد');
              scheduleSavePrefs();
            })
            .catch((e: unknown) => {
              removingCatalogRef.current.delete(layerId);
              toast.error(e instanceof Error ? e.message : 'حذف ناموفق بود');
              void refresh();
            });
          break;
        }
        case 'custom':
          mapHandle?.removeCustomLayer(item.rawId);
          onCustomLayersChange(customLayers.filter((l) => l.id !== item.rawId));
          scheduleSavePrefs();
          break;
        case 'satellite':
          onRasterLayersChange(rasterLayers.filter((r) => r.id !== item.rawId));
          scheduleSavePrefs();
          break;
        case 'streetview':
          onStreetViewFoldersChange([]);
          onStreetViewLayerIdsChange([]);
          onShowStreetViewChange(false);
          scheduleSavePrefs();
          break;
        case 'chat': {
          const map = mapHandle?.getMap();
          if (map) removeChatLayer(map, item.rawId);
          scheduleSavePrefs();
          break;
        }
        default:
          break;
      }
    },
    [
      mapHandle,
      refresh,
      catalogLayers,
      onCustomLayersChange,
      customLayers,
      onRasterLayersChange,
      rasterLayers,
      onStreetViewFoldersChange,
      onStreetViewLayerIdsChange,
      onShowStreetViewChange,
      scheduleSavePrefs,
    ]
  );

  /** Drag-and-drop reorder (Carbon sidebar pattern) — any layer can move anywhere. */
  const reorderDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!active || !over || active.id === over.id) return;

      const prev = listOrderRef.current;
      const oldIndex = prev.indexOf(String(active.id));
      const newIndex = prev.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;

      const next = arrayMove(prev, oldIndex, newIndex);
      setListOrderIds(next);
      pushStackOrderToMap(next);
      scheduleSavePrefs();
    },
    [pushStackOrderToMap, scheduleSavePrefs]
  );

  // Restore chat-layer GeoJSON snapshots once the map is ready and prefs loaded.
  // Restored layers get fresh ids (chat ids are session-ephemeral), so their
  // saved z-order falls back to the append path — acceptable for snapshots.
  useEffect(() => {
    if (!mapHandle || !prefsLoaded || chatRestoredRef.current) return;
    const prefs = savedPrefsRef.current;
    const map = mapHandle.getMap();
    if (!map) return;
    chatRestoredRef.current = true;
    if (!prefs?.layers) return;
    const existing = new Set(listChatLayers().map((c) => c.id));
    let restored = 0;
    for (const [key, entry] of Object.entries(prefs.layers)) {
      if (!key.startsWith('chat:')) continue;
      const rawId = key.slice(LAYER_KEY.chat('').length);
      if (existing.has(rawId) || !entry.geojson) continue;
      const newId = addUserGeoJsonLayer(map, entry.geojson, { name: entry.name || rawId });
      if (!newId) continue;
      if (entry.visible === false) setChatLayerVisibility(map, newId, false);
      if (typeof entry.opacity === 'number') setChatLayerOpacity(map, newId, entry.opacity);
      restored += 1;
    }
    if (restored) setChatTick((t) => t + 1);
  }, [mapHandle, prefsLoaded]);

  const handleLayerAdded = useCallback(
    async (result?: AddLayerResult) => {
      const ids =
        result?.catalogLayerIds?.length
          ? result.catalogLayerIds
          : result?.catalogLayerId
            ? [result.catalogLayerId]
            : [];
      if (ids.length) {
        setCatalogVisibleIds((prev) => {
          const next = new Set([...prev, ...ids]);
          const addedPmtiles = ids.some((id) => {
            const layer = catalogLayers.find((l) => l.id === id);
            return layer && isPmtilesCatalogKind(layer.layer_kind);
          });
          if (!addedPmtiles) return next;
          for (const l of catalogLayers) {
            if (isPmtilesCatalogKind(l.layer_kind) && !ids.includes(l.id)) {
              next.delete(l.id);
            }
          }
          return next;
        });
      }
      const kind = result?.layerKind ?? '';
      if (kind.startsWith('streetview') && ids.length) {
        onStreetViewLayerIdsChange((prev) => [...new Set([...prev, ...ids])]);
        onShowStreetViewChange(true);
      } else if (result?.streetviewPath) {
        if (!streetViewFolders.includes(result.streetviewPath)) {
          onStreetViewFoldersChange([...streetViewFolders, result.streetviewPath]);
        }
        onShowStreetViewChange(true);
      }
      await refresh();
    },
    [
      refresh,
      streetViewFolders,
      onStreetViewFoldersChange,
      onStreetViewLayerIdsChange,
      onShowStreetViewChange,
      catalogLayers,
    ]
  );

  const stackOrderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-apply z-order when user reorders layers (not on every visibility tweak).
  useEffect(() => {
    if (!mapHandle || listOrderIds.length === 0) return;
    if (stackOrderTimerRef.current) clearTimeout(stackOrderTimerRef.current);
    stackOrderTimerRef.current = setTimeout(() => {
      pushStackOrderToMap(listOrderRef.current);
    }, 200);
    return () => {
      if (stackOrderTimerRef.current) clearTimeout(stackOrderTimerRef.current);
    };
  }, [mapHandle, listOrderIds, pushStackOrderToMap]);

  const catalogVisibleIdsRef = useRef(catalogVisibleIds);
  catalogVisibleIdsRef.current = catalogVisibleIds;

  const getVisibleCatalogIds = useCallback((): string[] => {
    return catalogLayers
      .filter((l) => catalogVisibleIdsRef.current.has(l.id))
      .map((l) => l.id);
  }, [catalogLayers]);

  const getVisibleOverlayIds = getVisibleCatalogIds;

  const sasImageryVisible = useMemo(
    () =>
      catalogLayers.some(
        (l) => isSasSatelliteCatalogLayer(l) && catalogVisibleIds.has(l.id)
      ),
    [catalogLayers, catalogVisibleIds]
  );

  const toggleSasImagery = useCallback(() => {
    const satLayers = catalogLayers.filter(isSasSatelliteCatalogLayer);
    if (!satLayers.length) {
      toast.error('لایه ماهواره‌ای (satellite_imagery) در کاتالوگ نیست');
      return;
    }
    const anyVisible = satLayers.some((l) => catalogVisibleIds.has(l.id));
    setCatalogVisibleIds((prev) => {
      const next = new Set(prev);
      if (anyVisible) {
        for (const l of satLayers) next.delete(l.id);
      } else {
        next.add(satLayers[0].id);
      }
      return next;
    });
    scheduleSavePrefs();
  }, [catalogLayers, catalogVisibleIds, scheduleSavePrefs]);

  const snapshotLayerVisibility = useCallback((): LayerVisibilitySnapshot => {
    return { visibleCatalogIds: getVisibleCatalogIds() };
  }, [getVisibleCatalogIds]);

  const clearAllLayerVisibility = useCallback(() => {
    setCatalogVisibleIds(new Set());
    scheduleSavePrefs();
  }, [scheduleSavePrefs]);

  const restoreLayerVisibility = useCallback(
    (snap: LayerVisibilitySnapshot) => {
      setCatalogVisibleIds((prev) => {
        const next = new Set(snap.visibleCatalogIds);
        return enforceSingleVisiblePmtiles(next, catalogLayers, listOrderIds);
      });
      scheduleSavePrefs();
    },
    [scheduleSavePrefs, catalogLayers, listOrderIds]
  );

  const clearCatalogOverlays = useCallback(() => {
    clearAllLayerVisibility();
  }, [clearAllLayerVisibility]);

  const restoreCatalogOverlays = useCallback(
    (ids: string[]) => {
      restoreLayerVisibility({ visibleCatalogIds: ids });
    },
    [restoreLayerVisibility]
  );

  const stackControls = useMemo<LayerStackControls>(
    () => ({
      sasImageryVisible,
      toggleSasImagery,
      clearAllLayerVisibility,
      restoreLayerVisibility,
      clearCatalogOverlays,
      restoreCatalogOverlays,
      getVisibleCatalogIds,
      getVisibleOverlayIds,
      snapshotLayerVisibility,
    }),
    [
      sasImageryVisible,
      toggleSasImagery,
      clearAllLayerVisibility,
      restoreLayerVisibility,
      clearCatalogOverlays,
      restoreCatalogOverlays,
      getVisibleCatalogIds,
      getVisibleOverlayIds,
      snapshotLayerVisibility,
    ]
  );

  return {
    items,
    loading,
    error,
    refresh,
    handleLayerAdded,
    toggle,
    move,
    setOpacity,
    remove,
    reorderDragEnd,
    stackControls,
  };
}

async function restoreLocalLayersFromPrefs(
  layers: LayerStackPrefs['layers'],
  mapHandle: MapCoreRef,
  customLayers: CustomLayerConfig[],
  onCustomLayersChange: (layers: CustomLayerConfig[]) => void
): Promise<void> {
  let next = [...customLayers];
  for (const [key, entry] of Object.entries(layers)) {
    if (!key.startsWith('custom:') || !entry?.def) continue;
    const id = key.slice('custom:'.length);
    if (next.some((l) => l.id === id)) continue;
    const def = entry.def as {
      localId?: string;
      fileName?: string;
      name?: string;
      type?: string;
    };
    const localId = def.localId || id;
    const record = await getLocalLayer(localId);
    if (!record) continue;
    try {
      const runtime = await localLayerRuntimeUrl(record);
      const layer: CustomLayerConfig = {
        id,
        name: def.name || record.fileName,
        type: runtime.type,
        url: runtime.url,
        data: runtime.data,
        fileName: record.fileName,
        visible: entry.visible !== false,
        opacity: typeof entry.opacity === 'number' ? entry.opacity : 1,
      };
      next = [...next, layer];
      mapHandle.addCustomLayer(layer);
    } catch {
      // skip corrupt local records
    }
  }
  if (next.length !== customLayers.length) {
    onCustomLayersChange(next);
  }
}
