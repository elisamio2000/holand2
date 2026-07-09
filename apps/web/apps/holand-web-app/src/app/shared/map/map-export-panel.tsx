// ============================================
// MapExportPanel — Map session save & ZIP export panel
// Lets users bundle the current map state (viewport, layers,
// screenshot, street-view images, GeoJSON data) into a ZIP archive
// they can download and re-import later.
// ============================================
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Text, Loader } from 'rizzui';
import {
  PiDownloadSimpleBold,
  PiXBold,
  PiCameraBold,
  PiFolderOpenBold,
  PiFileBold,
  PiCheckCircleBold,
  PiWarningCircleBold,
  PiArrowsClockwiseBold,
  PiStackSimpleBold,
  PiDatabaseBold,
  PiSpinnerBold,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import cn from '@/lib/cn';
import { geoLocationService } from '@/services/geo-location.service';
import type { MapCoreRef, CustomLayerConfig } from '@/app/shared/map';

// ==========================================
// Types
// ==========================================

/**
 * A single PMTiles (or other single-file tile archive) that can be bundled
 * into the export ZIP. The server fetches it via HTTP and stores it under
 * the tiles/ folder in the archive.
 */
export interface PmtilesEntry {
  /** Display label shown in the export panel (e.g. "Regional Basemap", "World Overview"). */
  label: string;
  /**
   * URL to the tile file or directory.
   * - PMTiles archive: `/api/tiles/middle-east.pmtiles`
   * - XYZ tile directory: `/api/tiles/satellite-modis/` (trailing slash, no extension)
   */
  url: string;
  /**
   * When true, this entry is an XYZ tile directory (many small files).
   * It is displayed with an accurate size but cannot be bundled into a ZIP — info-only.
   */
  isDir?: boolean;
}

export interface MapExportLayerState {
  /** Is the base vector tile layer visible? */
  basemap: boolean;
  /** Is the satellite imagery overlay active? */
  satellite: boolean;
  /** Satellite tile URL template */
  satelliteUrl?: string;
  /** Is the terrain (DEM) layer active? */
  terrain: boolean;
  /** Terrain tile URL */
  terrainUrl?: string;
  /** Is the street-view overlay active? */
  streetView: boolean;
  /** Loaded street-view folder paths — multiple folders merged together. */
  streetViewFolders?: string[];
  /** Custom XYZ / GeoJSON layers */
  custom: CustomLayerConfig[];
  /**
   * PMTiles / tile archive files available for export.
   * These are independent of the active basemap state — the user can export
   * tile files even when the basemap layer is hidden.
   */
  pmtilesFiles?: PmtilesEntry[];
}

export interface MapExportPanelProps {
  /** Toggle the panel open/closed. */
  open: boolean;
  /** Called when the user closes the panel. */
  onClose: () => void;
  /** Live map handle — used to capture the canvas screenshot. */
  mapHandle: MapCoreRef | null;
  /** Current state of all map layers — serialised into map-session.json. */
  layers: MapExportLayerState;
}

// ==========================================
// Progress steps
// ==========================================

type ExportStep =
  | 'idle'
  | 'screenshot'
  | 'layers'
  | 'upload'
  | 'download'
  | 'done'
  | 'error';

const STEP_LABELS: Record<ExportStep, string> = {
  idle: '',
  screenshot: 'Capturing map screenshot…',
  layers: 'Collecting layer data…',
  upload: 'Building ZIP on server…',
  download: 'Downloading…',
  done: 'Export complete!',
  error: 'Export failed',
};

const STEP_PCT: Record<ExportStep, number> = {
  idle: 0,
  screenshot: 15,
  layers: 40,
  upload: 70,
  download: 90,
  done: 100,
  error: 0,
};

// ==========================================
// Helpers
// ==========================================

/**
 * Format a byte count as a human-readable string.
 * Examples: 1.4 kB, 14.3 MB, 63.0 GB
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Trigger a browser download from a Blob. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1000);
}

// ==========================================
// Component
// ==========================================

/**
 * MapExportPanel — Save/export the current map session as a ZIP archive.
 *
 * The ZIP contains:
 *  - `map-session.json` — full viewport + layer configuration
 *  - `screenshot.png`   — PNG snapshot of the visible map canvas
 *  - `streetview/`      — JPEG images from the active SV folder (optional)
 *  - `custom-layers/`   — inline GeoJSON layer data (optional)
 *
 * The screenshot is captured client-side via MapLibre's canvas
 * (which has `preserveDrawingBuffer: true`). All other content is
 * assembled server-side by POST /api/map/export to avoid large
 * client-side memory allocations for image sets.
 *
 * @requires /api/map/export    — server-side ZIP builder
 * @requires geoLocationService.streetviewBrowse — to count SV images in folder
 *
 * @example
 * ```tsx
 * <MapExportPanel
 *   open={exportOpen}
 *   onClose={() => setExportOpen(false)}
 *   mapHandle={mapHandle}
 *   layers={{ basemap, satellite, satelliteUrl, terrain, terrainUrl,
 *             streetView, streetViewFolder, custom: customLayers }}
 * />
 * ```
 */
export default function MapExportPanel({
  open,
  onClose,
  mapHandle,
  layers,
}: MapExportPanelProps) {
  // ── Export options ───────────────────────────────────────────────
  const [sessionName, setSessionName] = useState('my-map-session');
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [includeSvImages, setIncludeSvImages] = useState(false);
  const [includeGeoJson, setIncludeGeoJson] = useState(true);
  // keyed by PMTiles URL — each entry independently selectable
  const [includePmtiles, setIncludePmtiles] = useState<Record<string, boolean>>({});

  // ── Street-view image count (loaded from browse API) ────────────
  const [svImageCount, setSvImageCount] = useState<number | null>(null);
  const [svCountLoading, setSvCountLoading] = useState(false);

  // ── Size estimates (from /api/map/export/size) ───────────────────
  // keyed by PMTiles URL or 'streetview'
  const [sizes, setSizes] = useState<Record<string, number | null>>({});
  const [sizeLoading, setSizeLoading] = useState(false);

  // ── Export progress ──────────────────────────────────────────────
  const [step, setStep] = useState<ExportStep>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // ── All downloadable tile files ──────────────────────────────────
  // Only uses explicit pmtilesFiles from props — no auto-derivation from
  // satelliteUrl/terrainUrl because satellite/terrain are typically served
  // as XYZ tile directories, not as single .pmtiles archives.
  // To add satellite/terrain downloads, set NEXT_PUBLIC_SATELLITE_PMTILES_URL
  // and NEXT_PUBLIC_TERRAIN_PMTILES_URL in .env.local.
  const allPmtilesFiles = useMemo<PmtilesEntry[]>(() => {
    return layers.pmtilesFiles ?? [];
  }, [layers.pmtilesFiles]);

  // ── Init PMTiles checkboxes when layer list changes ─────────────
  // WHY here: when the panel is first opened or pmtilesFiles list changes,
  // default-check files that the tile server confirms are reachable.
  // We don't auto-check unknown/huge files to avoid surprising the user.
  useEffect(() => {
    const files = allPmtilesFiles;
    if (files.length === 0) return;
    setIncludePmtiles((prev) => {
      const next: Record<string, boolean> = {};
      for (const f of files) {
        // isDir entries are opt-in (default unchecked) — they're large tile directories.
        // PMTiles archives default to checked.
        next[f.url] = f.url in prev ? prev[f.url] : !f.isDir;
      }
      return next;
    });
  }, [allPmtilesFiles]);

  // Fetch SV image count when panel opens or folder list changes.
  useEffect(() => {
    if (!open || !layers.streetViewFolders?.length) {
      setSvImageCount(null);
      return;
    }
    setSvCountLoading(true);
    setSvImageCount(null);
    console.info('[MapExportPanel] Fetching SV image count for folders:', layers.streetViewFolders);
    // Sum image counts across all loaded folders in parallel.
    Promise.all(
      layers.streetViewFolders.map((folder) =>
        geoLocationService
          .streetviewBrowse(folder)
          .then((d: any) => (d?.svJpegCount ?? d?.totalJpegCount ?? 0) as number)
          .catch(() => 0)
      )
    )
      .then((counts) => {
        const total = counts.reduce((acc, n) => acc + n, 0);
        setSvImageCount(total);
        console.info('[MapExportPanel] SV image count total:', total);
      })
      .finally(() => setSvCountLoading(false));
  }, [open, layers.streetViewFolders]);

  // Fetch size estimates when the panel opens.
  useEffect(() => {
    if (!open) return;
    const pmUrls = allPmtilesFiles.map((f) => f.url);
    const hasFolders = (layers.streetViewFolders?.length ?? 0) > 0;
    if (pmUrls.length === 0 && !hasFolders) return;

    setSizeLoading(true);
    setSizes({});
    console.info('[MapExportPanel] Fetching size estimates...');
    fetch('/api/map/export/size', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pmtilesUrls: pmUrls,
        streetViewFolders: layers.streetViewFolders?.length ? layers.streetViewFolders : undefined,
      }),
    })
      .then((r) => r.json() as Promise<any>)
      .then((d: { results: Array<{ key: string; bytes: number | null }> }) => {
        const map: Record<string, number | null> = {};
        for (const r of d.results ?? []) map[r.key] = r.bytes;
        setSizes(map);
        console.info('[MapExportPanel] Size estimates received:', map);
      })
      .catch((err) => {
        console.warn('[MapExportPanel] Could not fetch size estimates:', err);
      })
      .finally(() => setSizeLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Reset step when panel closes.
  useEffect(() => {
    if (!open) {
      setStep('idle');
      setErrorMsg('');
    }
  }, [open]);

  // ── Inline GeoJSON layers count ──────────────────────────────────
  const geoJsonLayerCount = layers.custom.filter(
    (l) => l.type === 'geojson' && l.data
  ).length;

  // ── Export handler ───────────────────────────────────────────────

  /**
   * Capture the MapLibre canvas as a PNG data URL using the same technique
   * as MapScreenshotOverlay: listen for the next 'render' event, then
   * synchronously copy the WebGL back-buffer into a 2D offscreen canvas
   * BEFORE the browser compositor clears it.
   *
   * WHY not just canvas.toBlob(): toBlob() is asynchronous — by the time
   * it runs, MapLibre's WebGL back-buffer has been cleared by the compositor
   * and the result is a blank PNG. Reading via ctx.drawImage() inside the
   * 'render' callback runs in the same synchronous frame the GL buffer was
   * last painted, so the pixels are still there.
   */
  const captureScreenshot = useCallback(
    (): Promise<string | undefined> =>
      new Promise((resolve) => {
        if (!mapHandle) { resolve(undefined); return; }
        const map = mapHandle.getMap();
        if (!map) { resolve(undefined); return; }
        const sourceCanvas = map.getCanvas();

        map.once('render', () => {
          try {
            const out = document.createElement('canvas');
            out.width = sourceCanvas.width;
            out.height = sourceCanvas.height;
            const ctx = out.getContext('2d');
            if (!ctx) { resolve(undefined); return; }
            // Synchronous copy — still inside the same render frame.
            ctx.drawImage(sourceCanvas, 0, 0);

            // Sanity-check centre pixel — warn if alpha is 0 (empty buffer).
            try {
              const probe = ctx.getImageData(Math.floor(out.width / 2), Math.floor(out.height / 2), 1, 1).data;
              if (probe[3] === 0) {
                console.warn('[MapExportPanel] Screenshot centre pixel is transparent — map may not be fully rendered yet');
              }
            } catch { /* tainted canvas — ignore */ }

            out.toBlob((blob) => {
              if (!blob) { resolve(undefined); return; }
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => resolve(undefined);
              reader.readAsDataURL(blob);
            }, 'image/png');
          } catch (err) {
            console.warn('[MapExportPanel] Screenshot render-callback failed:', err);
            resolve(undefined);
          }
        });

        // Trigger a fresh repaint so the 'render' event fires with current content.
        map.triggerRepaint();
      }),
    [mapHandle]
  );

  /**
   * Runs the multi-step export flow:
   * 1. Capture canvas screenshot (same-frame render technique)
   * 2. Collect inline GeoJSON layer data
   * 3. POST everything to /api/map/export
   * 4. Trigger browser download
   */
  const handleExport = useCallback(async () => {
    console.info('[MapExportPanel] Starting export:', { sessionName, includeScreenshot, includeSvImages, includeGeoJson });
    setStep('screenshot');
    setErrorMsg('');

    let screenshotDataUrl: string | undefined;

    // ── Step 1: Screenshot ─────────────────────────────────────────
    if (includeScreenshot && mapHandle) {
      try {
        screenshotDataUrl = await captureScreenshot();
        if (screenshotDataUrl) {
          console.info('[MapExportPanel] Screenshot captured successfully');
        } else {
          console.warn('[MapExportPanel] Screenshot returned empty — continuing without it');
        }
      } catch (err) {
        console.warn('[MapExportPanel] Screenshot failed (non-fatal):', err);
        // Continue without screenshot
      }
    }

    // ── Step 2: Collect layer data ─────────────────────────────────
    setStep('layers');

    // Build the session config that goes into map-session.json.
    let viewport: { center?: [number, number]; zoom?: number; bearing?: number; pitch?: number } = {};
    if (mapHandle) {
      try {
        const map = mapHandle.getMap();
        if (map) {
          const c = map.getCenter();
          viewport = {
            center: [c.lng, c.lat],
            zoom: Math.round(map.getZoom() * 100) / 100,
            bearing: Math.round(map.getBearing() * 10) / 10,
            pitch: Math.round(map.getPitch() * 10) / 10,
          };
        }
      } catch {
        // Non-fatal — viewport info is optional
      }
    }

    const sessionConfig = {
      name: sessionName,
      viewport,
      layers: {
        basemap: { visible: layers.basemap },
        satellite: { visible: layers.satellite, url: layers.satelliteUrl ?? '' },
        terrain: { visible: layers.terrain, url: layers.terrainUrl ?? '' },
        streetView: {
          visible: layers.streetView,
          folders: layers.streetViewFolders ?? [],
        },
        custom: layers.custom.map((l) => ({
          id: l.id,
          name: l.name,
          type: l.type,
          url: l.url,
          fileName: l.fileName,
          visible: l.visible,
          opacity: l.opacity,
          // Inline data is bundled separately as .geojson files
          hasInlineData: !!l.data,
        })),
      },
    };

    // Collect inline GeoJSON layers to bundle as files.
    const geoJsonLayers =
      includeGeoJson
        ? layers.custom
            .filter((l) => l.type === 'geojson' && l.data)
            .map((l) => ({ name: l.name || l.fileName || l.id, data: l.data }))
        : [];

    // ── Step 3: POST to server ─────────────────────────────────────
    setStep('upload');
    // Collect selected PMTiles files.
    const selectedPmtiles = allPmtilesFiles.filter(
      (f) => !!includePmtiles[f.url]
    );

    let zipBlob: Blob;
    try {
      const res = await fetch('/api/map/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionName,
          sessionConfig,
          screenshotDataUrl,
          streetViewFolders: layers.streetViewFolders?.length ? layers.streetViewFolders : undefined,
          includeStreetViewImages: includeSvImages,
          geoJsonLayers,
          pmtilesFiles: selectedPmtiles.length > 0 ? selectedPmtiles : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Server error ${res.status}`);
      }
      zipBlob = await res.blob();
      console.info('[MapExportPanel] ZIP received from server:', { size: zipBlob.size });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      console.error('[MapExportPanel] Export request failed:', err);
      setStep('error');
      setErrorMsg(msg);
      toast.error('Export failed: ' + msg);
      return;
    }

    // ── Step 4: Download ───────────────────────────────────────────
    setStep('download');
    const safeName = sessionName.replace(/[^a-z0-9_\-. ]/gi, '_') || 'map-export';
    const today = new Date().toISOString().slice(0, 10);
    downloadBlob(zipBlob, `${safeName}_${today}.zip`);

    setStep('done');
    toast.success('Map session exported successfully!');
    console.info('[MapExportPanel] Export complete');

    // Auto-close after a short delay
    setTimeout(() => {
      setStep('idle');
      onClose();
    }, 1500);
  }, [
    sessionName, includeScreenshot, includeSvImages, includeGeoJson, includePmtiles,
    mapHandle, layers, onClose, captureScreenshot,
  ]);

  // ── Derived values ───────────────────────────────────────────────


  // Sum street-view sizes across multi-folder keys (streetview/{folderName}).
  const svTotalBytes = Object.entries(sizes)
    .filter(([k]) => k.startsWith('streetview/'))
    .reduce((acc, [, v]) => acc + (v ?? 0), 0);

  // Total estimated download size for checked items.
  const totalEstimatedBytes = (() => {
    let total = 0;
    let hasAny = false;
    // All tile entries (PMTiles + isDir) that are checked
    for (const f of allPmtilesFiles) {
      if (includePmtiles[f.url] && sizes[f.url] != null) {
        total += sizes[f.url] as number;
        hasAny = true;
      }
    }
    // Street view folders
    if (includeSvImages && svTotalBytes > 0) {
      total += svTotalBytes;
      hasAny = true;
    }
    return hasAny ? total : null;
  })();

  // ── Render ───────────────────────────────────────────────────────
  if (!open || typeof document === 'undefined') return null;

  const isExporting = step !== 'idle' && step !== 'done' && step !== 'error';
  const pct = STEP_PCT[step];

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isExporting) onClose();
      }}
    >
      {/* Panel */}
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-50 max-h-[90vh]">
        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 border-b border-muted px-5 py-3">
          <PiDownloadSimpleBold className="h-5 w-5 shrink-0 text-primary" />
          <div className="flex-1">
            <Text className="text-sm font-semibold text-gray-900 dark:text-gray-700">
              Export Map Session
            </Text>
            <Text className="text-[11px] text-gray-400">
              Save your map as a portable ZIP archive
            </Text>
          </div>
          {!isExporting && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-200"
            >
              <PiXBold className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* ── Body ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {/* Session name */}
          <div className="mb-5">
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Export Name
            </label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              disabled={isExporting}
              placeholder="my-map-session"
              className="w-full rounded-lg border border-muted bg-gray-50/50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-primary dark:bg-gray-100/50 dark:text-gray-200"
            />
            <Text className="mt-1 text-[10px] text-gray-400">
              ZIP file will be named: <span className="font-mono">{(sessionName || 'map-export').replace(/[^a-z0-9_\-. ]/gi, '_')}_{new Date().toISOString().slice(0, 10)}.zip</span>
            </Text>
          </div>

          {/* ── What to include ────────────────────────────────── */}
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            What to Include
          </label>
          <div className="space-y-0.5 rounded-xl border border-muted p-1">
            {/* Map configuration — always on */}
            <ExportOption
              icon={<PiFileBold className="h-4 w-4 text-blue-500" />}
              label="Map Configuration"
              description="map-session.json — viewport, all active layer settings"
              checked={true}
              disabled={true}
              onChange={() => {}}
            />

            {/* Screenshot */}
            <ExportOption
              icon={<PiCameraBold className="h-4 w-4 text-violet-500" />}
              label="Map Screenshot"
              description="screenshot.png — PNG of the current map view"
              checked={includeScreenshot}
              onChange={setIncludeScreenshot}
              disabled={isExporting || !mapHandle}
            />

            {/* Street View Images — available whenever a folder is set,
                regardless of whether the SV overlay is currently active. */}
            <ExportOption
              icon={<PiFolderOpenBold className="h-4 w-4 text-amber-500" />}
              label="Street View Images"
              description={
                !layers.streetViewFolders?.length
                  ? 'No folder selected — set a street view folder in the map controls'
                  : svCountLoading
                  ? 'Counting images…'
                  : svImageCount !== null
                  ? `streetview/ — ${svImageCount} image${svImageCount !== 1 ? 's' : ''} in ${layers.streetViewFolders.length} folder${layers.streetViewFolders.length !== 1 ? 's' : ''}`
                  : `streetview/ — ${layers.streetViewFolders.length} folder${layers.streetViewFolders.length !== 1 ? 's' : ''}`
              }
              badge={
                svImageCount !== null && svImageCount > 0
                  ? {
                      text: svTotalBytes > 0
                        ? `${svImageCount} images · ${formatBytes(svTotalBytes)}`
                        : sizeLoading ? 'sizing…' : `${svImageCount} JPEGs`,
                      color: 'amber',
                    }
                  : undefined
              }
              checked={includeSvImages && !!layers.streetViewFolders?.length}
              onChange={setIncludeSvImages}
              // Not requiring streetView to be active — user can export images even when SV layer is off.
              disabled={isExporting || !layers.streetViewFolders?.length || (svImageCount !== null && svImageCount === 0)}
              warning={svImageCount !== null && svImageCount > 200 ? `Large export — ${svImageCount} images may take a while` : undefined}
            />

            {/* GeoJSON Layers */}
            <ExportOption
              icon={<PiStackSimpleBold className="h-4 w-4 text-green-500" />}
              label="GeoJSON Layers"
              description={
                geoJsonLayerCount === 0
                  ? 'No inline GeoJSON layers loaded'
                  : `custom-layers/ — ${geoJsonLayerCount} layer${geoJsonLayerCount !== 1 ? 's' : ''} with inline data`
              }
              checked={includeGeoJson && geoJsonLayerCount > 0}
              onChange={setIncludeGeoJson}
              disabled={isExporting || geoJsonLayerCount === 0}
            />

            {/* PMTiles / tile archive files */}
            {allPmtilesFiles.length > 0 && (
              <>
                <div className="px-3 pt-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Tile Files
                  </span>
                </div>
                {allPmtilesFiles.map((f) => {
                  const sizeBytes = sizes[f.url];
                  const isSizeLoading = sizeLoading && sizeBytes === undefined;
                  const sizeLabel = isSizeLoading
                    ? 'sizing…'
                    : sizeBytes != null
                    ? formatBytes(sizeBytes)
                    : 'size unknown';

                  // XYZ tile directory — can be bundled; large ones are noted in the ZIP
                  if (f.isDir) {
                    return (
                      <ExportOption
                        key={f.url}
                        icon={<PiDatabaseBold className="h-4 w-4 text-indigo-400" />}
                        label={f.label}
                        description={`${f.url.replace('/api/tiles/', '')} — XYZ tiles directory`}
                        badge={{ text: sizeLabel, color: 'indigo' }}
                        checked={!!includePmtiles[f.url]}
                        onChange={(v) => setIncludePmtiles((p) => ({ ...p, [f.url]: v }))}
                        disabled={isExporting}
                        warning={
                          sizeBytes != null && sizeBytes > 500 * 1024 * 1024
                            ? `Directory is ${formatBytes(sizeBytes)} — too large to bundle; a download note will be added to the ZIP`
                            : sizeBytes != null && sizeBytes > 200 * 1024 * 1024
                            ? `Large directory (${formatBytes(sizeBytes)}) — export may take a moment`
                            : undefined
                        }
                      />
                    );
                  }

                  return (
                    <ExportOption
                      key={f.url}
                      icon={<PiDatabaseBold className="h-4 w-4 text-indigo-500" />}
                      label={f.label}
                      description={`tiles/${f.label.replace(/[^a-z0-9_\-. ]/gi, '_')}.pmtiles — ${f.url.split('/').pop() ?? f.url}`}
                      badge={{ text: sizeLabel, color: 'indigo' }}
                      checked={!!includePmtiles[f.url]}
                      onChange={(v) => setIncludePmtiles((p) => ({ ...p, [f.url]: v }))}
                      disabled={isExporting}
                      warning={
                        sizeBytes != null && sizeBytes > 500 * 1024 * 1024
                          ? `File is ${formatBytes(sizeBytes)} — will be skipped (exceeds 500 MB server limit)`
                          : sizeBytes != null && sizeBytes > 200 * 1024 * 1024
                          ? `Large file (${formatBytes(sizeBytes)}) — export may take a moment`
                          : undefined
                      }
                    />
                  );
                })}
              </>
            )}
          </div>

          {/* ── Active layers summary ───────────────────────────── */}
          <div className="mt-4 rounded-xl border border-muted bg-gray-50/50 px-4 py-3 dark:bg-gray-100/30">
            <Text className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Current Map State
            </Text>
            <Text className="mb-2 text-[9px] text-gray-400">
              Checked items above will be exported regardless of active state.
            </Text>
            <div className="flex flex-wrap gap-1.5">
              <LayerPill label="Base Map" active={layers.basemap} />
              <LayerPill label="Satellite" active={layers.satellite} />
              <LayerPill label="Terrain" active={layers.terrain} />
              <LayerPill label="Street View" active={layers.streetView} />
              {layers.custom.length > 0 && (
                <LayerPill label={`${layers.custom.length} Custom Layer${layers.custom.length !== 1 ? 's' : ''}`} active={true} />
              )}
            </div>
          </div>

          {/* ── Total estimated size ────────────────────────────── */}
          {totalEstimatedBytes !== null && (
            <div className="mt-3 flex items-center justify-between rounded-lg bg-primary/5 px-4 py-2.5 dark:bg-primary/10">
              <Text className="text-[11px] text-gray-500 dark:text-gray-400">
                Estimated export size
              </Text>
              <span className="text-[12px] font-semibold text-primary">
                ~{formatBytes(totalEstimatedBytes)}
              </span>
            </div>
          )}
          {sizeLoading && totalEstimatedBytes === null && (
            <div className="mt-3 flex items-center gap-2 px-1 text-[10px] text-gray-400">
              <PiSpinnerBold className="h-3 w-3 animate-spin" />
              Estimating sizes…
            </div>
          )}
        </div>

        {/* ── Progress bar ───────────────────────────────────────── */}
        {step !== 'idle' && (
          <div className="px-5 pb-2">
            <div className="mb-1.5 flex items-center justify-between">
              <Text className={cn('text-[11px]', step === 'error' ? 'text-red-500' : step === 'done' ? 'text-green-600' : 'text-gray-500')}>
                {step === 'error' ? errorMsg : STEP_LABELS[step]}
              </Text>
              {step !== 'error' && (
                <Text className="text-[11px] text-gray-400">{pct}%</Text>
              )}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-200">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  step === 'error' ? 'bg-red-400' : step === 'done' ? 'bg-green-500' : 'bg-primary'
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 border-t border-muted px-5 py-4">
          {!isExporting && step !== 'done' && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-200"
            >
              Cancel
            </button>
          )}
          {step === 'done' ? (
            <div className="flex items-center gap-1.5 text-sm font-medium text-green-600">
              <PiCheckCircleBold className="h-4 w-4" />
              Exported!
            </div>
          ) : step === 'error' ? (
            <button
              type="button"
              onClick={() => { setStep('idle'); setErrorMsg(''); }}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
            >
              <PiArrowsClockwiseBold className="h-4 w-4" />
              Retry
            </button>
          ) : isExporting ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader size="sm" />
              Exporting…
            </div>
          ) : (
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              <PiDownloadSimpleBold className="h-4 w-4" />
              Export as ZIP
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ==========================================
// Sub-components
// ==========================================

interface ExportOptionProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  badge?: { text: string; color: string };
  warning?: string;
}

/**
 * Single toggle row in the "What to Include" checklist.
 * Always-on rows (like Map Config) use `disabled={true}` to prevent unchecking.
 */
function ExportOption({ icon, label, description, checked, onChange, disabled, badge, warning }: ExportOptionProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-lg px-3 py-1.5 transition-colors',
        !disabled && 'hover:bg-gray-50 dark:hover:bg-gray-100',
        disabled && 'cursor-default opacity-60'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 shrink-0 accent-primary"
      />
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Text className="text-[12px] font-medium text-gray-700 dark:text-gray-300">{label}</Text>
          {badge && (
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold text-gray-600 dark:bg-gray-200 dark:text-gray-400">
              {badge.text}
            </span>
          )}
        </div>
        <Text className="text-[10px] leading-relaxed text-gray-400">{description}</Text>
        {warning && (
          <div className="mt-1 flex items-center gap-1 text-[10px] text-orange-500">
            <PiWarningCircleBold className="h-3 w-3 shrink-0" />
            {warning}
          </div>
        )}
      </div>
    </label>
  );
}

interface LayerPillProps {
  label: string;
  active: boolean;
}

/** Small indicator pill showing whether a layer is active/inactive. */
function LayerPill({ label, active }: LayerPillProps) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-medium',
        active
          ? 'bg-primary/10 text-primary dark:bg-primary/20'
          : 'bg-gray-100 text-gray-400 dark:bg-gray-200'
      )}
    >
      {active ? '✓ ' : '○ '}{label}
    </span>
  );
}
