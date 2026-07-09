// ============================================
// CustomLayersPanel — User-managed map tile/GeoJSON layer UI
// Allows adding, toggling, and removing custom map layers
// that survive basemap style reloads.
// ============================================
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Text, Button, Badge } from 'rizzui';
import {
  PiPlusBold,
  PiEyeBold,
  PiEyeSlashBold,
  PiTrashBold,
  PiMapTrifoldBold,
  PiGridFourBold,
  PiFileBold,
  PiCaretDownBold,
  PiCaretUpBold,
  PiLinkBold,
  PiUploadBold,
  PiCheckCircleBold,
  PiSpinnerBold,
} from 'react-icons/pi';
import cn from '@/lib/cn';
import type { MapCoreRef, CustomLayerConfig } from '@/app/shared/map';

// ==========================================
// Types
// ==========================================

interface CustomLayersPanelProps {
  /** The MapCore imperative handle — provides addCustomLayer, removeCustomLayer etc. */
  mapHandle: MapCoreRef | null;
  /**
   * Controlled list of custom layers. The parent must mirror changes back here
   * using `onLayersChange` so the UI stays in sync with what MapCore holds.
   */
  customLayers: CustomLayerConfig[];
  /** Called whenever the layer list changes (add / remove / visibility / opacity). */
  onLayersChange: (layers: CustomLayerConfig[]) => void;
  /** Whether the base map (regional vector tiles) is currently visible. */
  baseMapVisible: boolean;
  /** Called when the user toggles the base map on/off. */
  onBaseMapToggle: (visible: boolean) => void;
  /** Additional CSS classes for the outer container. */
  className?: string;
}

// ==========================================
// Helper
// ==========================================

/**
 * Generate a stable unique id for a new layer using current timestamp +
 * random suffix. No external dependency needed.
 */
function generateLayerId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ==========================================
// Component
// ==========================================

/**
 * CustomLayersPanel — Side-panel section for managing user-uploaded map layers.
 *
 * Provides:
 * 1. A "Base Map" toggle row (hides/shows the regional vector tiles)
 * 2. An "Add Layer" accordion form (name, type: XYZ Raster / GeoJSON URL, URL input)
 * 3. A scrollable list of added layers — each with eye toggle, opacity slider, delete
 *
 * Designed for reuse on both the Offline Map page and the Geo-Location plugin page.
 *
 * @requires mapHandle — connected MapCore imperative handle
 * @requires customLayers / onLayersChange — controlled state from parent
 *
 * @example
 * ```tsx
 * const [customLayers, setCustomLayers] = useState<CustomLayerConfig[]>([]);
 * const [baseMapVisible, setBaseMapVisible] = useState(true);
 *
 * <CustomLayersPanel
 *   mapHandle={mapHandle}
 *   customLayers={customLayers}
 *   onLayersChange={setCustomLayers}
 *   baseMapVisible={baseMapVisible}
 *   onBaseMapToggle={(v) => { setBaseMapVisible(v); mapHandle?.setBaseMapVisible(v); }}
 * />
 * ```
 */
export default function CustomLayersPanel({
  mapHandle,
  customLayers,
  onLayersChange,
  baseMapVisible,
  onBaseMapToggle,
  className,
}: CustomLayersPanelProps) {
  // ==========================================
  // Add-form state
  // ==========================================
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'raster' | 'geojson'>('raster');
  // Source: URL input or local file upload
  const [newSource, setNewSource] = useState<'url' | 'file'>('url');
  const [newUrl, setNewUrl] = useState('');
  // File upload state
  const [newFile, setNewFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<object | null>(null);    // parsed GeoJSON
  const [fileBlobUrl, setFileBlobUrl] = useState('');               // pmtiles:// blob URL
  const [fileReady, setFileReady] = useState(false);
  const [fileReading, setFileReading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [addError, setAddError] = useState('');

  // ==========================================
  // Effects — reset file state when type or source mode changes
  // ==========================================

  // When layer type changes, the previously selected file is no longer valid
  // (wrong extension — e.g. .pmtiles was selected but user switched to GeoJSON).
  useEffect(() => {
    setNewFile(null);
    setFileData(null);
    setFileBlobUrl('');
    setFileReady(false);
    setFileReading(false);
    setAddError('');
  }, [newType]);

  // When switching between URL/File source modes, clear both URL and file state.
  useEffect(() => {
    setNewUrl('');
    setNewFile(null);
    setFileData(null);
    setFileBlobUrl('');
    setFileReady(false);
    setFileReading(false);
    setAddError('');
  }, [newSource]);

  // ==========================================
  // Handlers
  // ==========================================

  /**
   * Process a file selected via the file input.
   * - GeoJSON (.geojson / .json): reads via FileReader, parses JSON, stores in `fileData`
   * - PMTiles (.pmtiles): creates a blob URL with pmtiles:// prefix, stores in `fileBlobUrl`
   */
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    setNewFile(file);
    setFileReady(false);
    setFileData(null);
    setFileBlobUrl('');
    setAddError('');

    if (newType === 'geojson') {
      if (ext !== 'geojson' && ext !== 'json') {
        setAddError('Please select a .geojson or .json file.');
        setNewFile(null);
        return;
      }
      setFileReading(true);
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed: any = JSON.parse(ev.target?.result as string);
          setFileData(parsed);
          setFileReady(true);
          console.info('[CustomLayersPanel] GeoJSON file parsed:', { name: file.name, type: parsed.type });
        } catch {
          setAddError('Failed to parse GeoJSON. Make sure the file contains valid JSON.');
          setNewFile(null);
        }
        setFileReading(false);
      };
      reader.onerror = () => {
        setAddError('Failed to read file.');
        setNewFile(null);
        setFileReading(false);
      };
      reader.readAsText(file);
    } else {
      // raster — only PMTiles supported for offline files
      if (ext !== 'pmtiles') {
        setAddError('Please select a .pmtiles file for offline raster layers.');
        setNewFile(null);
        return;
      }
      // createObjectURL returns a blob: URL; prefix with pmtiles:// so the
      // MapLibre PMTiles protocol handler intercepts the fetch.
      const blob = `pmtiles://${URL.createObjectURL(file)}`;
      setFileBlobUrl(blob);
      setFileReady(true);
      console.info('[CustomLayersPanel] PMTiles file staged:', { name: file.name });
    }
  }, [newType]);

  /**
   * Validate inputs and call mapHandle.addCustomLayer. Mirrors the new layer
   * into parent state via onLayersChange so the list re-renders immediately.
   * Supports both URL-based and file-based layer sources.
   */
  const handleAddLayer = useCallback(() => {
    const name = newName.trim();

    if (!name) { setAddError('Layer name is required.'); return; }

    if (newSource === 'file') {
      if (!newFile) { setAddError('Please select a file.'); return; }
      if (!fileReady) { setAddError('File is still loading, please wait...'); return; }

      const config: CustomLayerConfig = {
        id: generateLayerId(),
        name: name || newFile.name.replace(/\.[^.]+$/, ''),
        type: newType,
        // For GeoJSON files, url is empty — data field holds the parsed content.
        // For PMTiles files, url holds the pmtiles:// blob URL.
        url: newType === 'raster' ? fileBlobUrl : '',
        data: newType === 'geojson' ? (fileData ?? undefined) : undefined,
        fileName: newFile.name,
        visible: true,
        opacity: 1,
      };

      console.info('[CustomLayersPanel] Adding file-based layer:', { name: config.name, type: newType, fileName: newFile.name });
      mapHandle?.addCustomLayer(config);
      onLayersChange([...customLayers, config]);
    } else {
      // URL mode
      const url = newUrl.trim();
      if (!url) { setAddError('URL is required.'); return; }
      try { if (url.startsWith('http')) new URL(url); } catch {
        setAddError('Invalid URL format.');
        return;
      }

      const config: CustomLayerConfig = {
        id: generateLayerId(),
        name,
        type: newType,
        url,
        visible: true,
        opacity: 1,
      };

      console.info('[CustomLayersPanel] Adding URL-based layer:', { name, type: newType, url });
      mapHandle?.addCustomLayer(config);
      onLayersChange([...customLayers, config]);
    }

    setAddError('');
    // Reset form
    setNewName('');
    setNewUrl('');
    setNewFile(null);
    setFileData(null);
    setFileBlobUrl('');
    setFileReady(false);
    setShowAddForm(false);
  }, [mapHandle, customLayers, onLayersChange, newName, newType, newSource, newUrl, newFile, fileData, fileBlobUrl, fileReady]);

  const handleRemoveLayer = useCallback((id: string) => {
    console.info('[CustomLayersPanel] Removing layer:', { id });
    mapHandle?.removeCustomLayer(id);
    onLayersChange(customLayers.filter((l) => l.id !== id));
  }, [mapHandle, customLayers, onLayersChange]);

  const handleToggleVisibility = useCallback((id: string, visible: boolean) => {
    mapHandle?.setCustomLayerVisibility(id, visible);
    onLayersChange(customLayers.map((l) => l.id === id ? { ...l, visible } : l));
  }, [mapHandle, customLayers, onLayersChange]);

  const handleOpacityChange = useCallback((id: string, opacity: number) => {
    mapHandle?.setCustomLayerOpacity(id, opacity);
    onLayersChange(customLayers.map((l) => l.id === id ? { ...l, opacity } : l));
  }, [mapHandle, customLayers, onLayersChange]);

  // ==========================================
  // Render
  // ==========================================

  return (
    <div className={cn('flex flex-col gap-0', className)}>

      {/* ====================================== */}
      {/* Base Map Toggle */}
      {/* ====================================== */}
      <div className="border-b border-muted px-3 py-2">
        <Text className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          Base Map
        </Text>
        <button
          onClick={() => onBaseMapToggle(!baseMapVisible)}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs transition-colors',
            baseMapVisible
              ? 'bg-primary/10 text-primary'
              : 'bg-gray-100 dark:bg-gray-200 text-gray-500'
          )}
        >
          <PiMapTrifoldBold className={cn('h-4 w-4 shrink-0', baseMapVisible ? 'text-primary' : 'text-gray-400')} />
          <div className="flex-1">
            <Text className="text-xs font-medium">
              {baseMapVisible ? 'Showing' : 'Hidden'}
            </Text>
            <Text className="text-[10px] text-gray-400">Roads, buildings, labels</Text>
          </div>
          {/* Toggle indicator */}
          <div className={cn(
            'h-4 w-7 rounded-full transition-colors relative',
            baseMapVisible ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-500'
          )}>
            <div className={cn(
              'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform',
              baseMapVisible ? 'translate-x-3.5' : 'translate-x-0.5'
            )} />
          </div>
        </button>
      </div>

      {/* ====================================== */}
      {/* Custom Layers Header + Add Button */}
      {/* ====================================== */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Text className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Custom Layers
          </Text>
          {customLayers.length > 0 && (
            <Badge variant="flat" size="sm" color="primary" className="scale-90">
              {customLayers.length}
            </Badge>
          )}
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors"
        >
          {showAddForm ? <PiCaretUpBold className="h-3 w-3" /> : <PiPlusBold className="h-3 w-3" />}
          {showAddForm ? 'Cancel' : 'Add'}
        </button>
      </div>

      {/* ====================================== */}
      {/* Add Layer Form (accordion) */}
      {/* ====================================== */}
      {showAddForm && (
        <div className="mx-3 mb-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
          <div className="space-y-2">
            {/* Name */}
            <div>
              <label className="mb-0.5 block text-[10px] font-medium text-gray-600 dark:text-gray-400">
                Layer Name
              </label>
              <input
                type="text"
                placeholder="e.g. Heatmap Layer"
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setAddError(''); }}
                className="w-full rounded-md border border-muted bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-primary dark:bg-gray-100"
              />
            </div>

            {/* Type */}
            <div>
              <label className="mb-0.5 block text-[10px] font-medium text-gray-600 dark:text-gray-400">
                Layer Type
              </label>
              <div className="flex gap-1.5">
                {(['raster', 'geojson'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setNewType(t)}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-md border py-1.5 text-[10px] font-medium transition-colors',
                      newType === t
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-muted text-gray-500 hover:border-gray-300 dark:hover:border-gray-400'
                    )}
                  >
                    {t === 'raster' ? <PiGridFourBold className="h-3 w-3" /> : <PiFileBold className="h-3 w-3" />}
                    {t === 'raster' ? 'XYZ Tiles' : 'GeoJSON'}
                  </button>
                ))}
              </div>
            </div>

            {/* Source: URL vs File */}
            <div>
              <label className="mb-0.5 block text-[10px] font-medium text-gray-600 dark:text-gray-400">
                Source
              </label>
              <div className="flex gap-1.5">
                {(['url', 'file'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setNewSource(s)}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-md border py-1.5 text-[10px] font-medium transition-colors',
                      newSource === s
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-muted text-gray-500 hover:border-gray-300 dark:hover:border-gray-400'
                    )}
                  >
                    {s === 'url' ? <PiLinkBold className="h-3 w-3" /> : <PiUploadBold className="h-3 w-3" />}
                    {s === 'url' ? 'URL' : 'Local File'}
                  </button>
                ))}
              </div>
            </div>

            {/* URL input (shown when source=url) */}
            {newSource === 'url' && (
              <div>
                <label className="mb-0.5 block text-[10px] font-medium text-gray-600 dark:text-gray-400">
                  {newType === 'raster' ? 'Tile URL ({z}/{x}/{y})' : 'GeoJSON URL'}
                </label>
                <input
                  type="url"
                  placeholder={
                    newType === 'raster'
                      ? 'https://tile.server/{z}/{x}/{y}.png'
                      : 'https://example.com/data.geojson'
                  }
                  value={newUrl}
                  onChange={(e) => { setNewUrl(e.target.value); setAddError(''); }}
                  className="w-full rounded-md border border-muted bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-primary dark:bg-gray-100"
                />
              </div>
            )}

            {/* File input zone (shown when source=file) */}
            {newSource === 'file' && (
              <div>
                <label className="mb-0.5 block text-[10px] font-medium text-gray-600 dark:text-gray-400">
                  {newType === 'raster' ? 'PMTiles file (.pmtiles)' : 'GeoJSON file (.geojson / .json)'}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={newType === 'raster' ? '.pmtiles' : '.geojson,.json'}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'flex w-full flex-col items-center gap-1.5 rounded-md border-2 border-dashed py-3 text-center transition-colors',
                    newFile
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-muted hover:border-primary/40 hover:bg-primary/5'
                  )}
                >
                  {fileReading ? (
                    <>
                      <PiSpinnerBold className="h-5 w-5 animate-spin text-primary" />
                      <Text className="text-[10px] text-primary">Reading file…</Text>
                    </>
                  ) : fileReady && newFile ? (
                    <>
                      <PiCheckCircleBold className="h-5 w-5 text-green-500" />
                      <Text className="max-w-[160px] truncate text-[10px] font-medium text-green-600 dark:text-green-400">
                        {newFile.name}
                      </Text>
                      <Text className="text-[9px] text-gray-400">
                        {(newFile.size / 1024).toFixed(0)} KB — click to change
                      </Text>
                    </>
                  ) : (
                    <>
                      <PiUploadBold className="h-5 w-5 text-gray-400" />
                      <Text className="text-[10px] text-gray-500">Click to browse</Text>
                      <Text className="text-[9px] text-gray-400">
                        {newType === 'raster' ? '.pmtiles' : '.geojson or .json'}
                      </Text>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Error */}
            {addError && (
              <Text className="text-[10px] text-red-500">{addError}</Text>
            )}

            {/* Submit */}
            <Button
              size="sm"
              variant="solid"
              className="w-full text-xs"
              disabled={!mapHandle}
              onClick={handleAddLayer}
            >
              <PiPlusBold className="mr-1.5 h-3.5 w-3.5" />
              Add Layer
            </Button>
            {!mapHandle && (
              <Text className="text-center text-[10px] text-gray-400">
                Waiting for map to load…
              </Text>
            )}
          </div>
        </div>
      )}

      {/* ====================================== */}
      {/* Layer List */}
      {/* ====================================== */}
      {customLayers.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 px-3 py-6 text-center">
          <PiGridFourBold className="h-8 w-8 text-gray-300 dark:text-gray-600" />
          <Text className="text-xs text-gray-400">No custom layers yet.</Text>
          <Text className="text-[10px] text-gray-400">
            Add an XYZ tile URL, GeoJSON URL, or upload a local file (.geojson / .pmtiles).
          </Text>
        </div>
      ) : (
        <div className="space-y-1 px-2 pb-2">
          {customLayers.map((layer) => (
            <div
              key={layer.id}
              className="rounded-md border border-muted bg-gray-50 dark:bg-gray-100 px-2.5 py-2"
            >
              {/* Top row: icon + name + type badge + actions */}
              <div className="flex items-center gap-2">
                {layer.type === 'raster'
                  ? <PiGridFourBold className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  : <PiFileBold className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                }
                <Text className="flex-1 truncate text-xs font-medium text-gray-700 dark:text-gray-300">
                  {layer.name}
                </Text>
                <Badge
                  variant="flat"
                  size="sm"
                  className="shrink-0 text-[9px]"
                  color={layer.type === 'raster' ? 'info' : 'success'}
                >
                  {layer.type === 'raster' ? 'XYZ' : 'GeoJSON'}
                </Badge>
                {/* Visibility toggle */}
                <button
                  onClick={() => handleToggleVisibility(layer.id, !layer.visible)}
                  className="rounded p-0.5 text-gray-400 hover:text-primary transition-colors"
                  title={layer.visible ? 'Hide layer' : 'Show layer'}
                >
                  {layer.visible
                    ? <PiEyeBold className="h-3.5 w-3.5" />
                    : <PiEyeSlashBold className="h-3.5 w-3.5" />
                  }
                </button>
                {/* Delete */}
                <button
                  onClick={() => handleRemoveLayer(layer.id)}
                  className="rounded p-0.5 text-gray-400 hover:text-red-500 transition-colors"
                  title="Remove layer"
                >
                  <PiTrashBold className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Opacity slider (only when visible) */}
              {layer.visible && (
                <div className="mt-1.5 flex items-center gap-2">
                  <Text className="w-10 shrink-0 text-[10px] text-gray-400">
                    {Math.round(layer.opacity * 100)}%
                  </Text>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={layer.opacity}
                    onChange={(e) => handleOpacityChange(layer.id, parseFloat(e.target.value))}
                    className="h-1 w-full cursor-pointer accent-primary"
                  />
                </div>
              )}

              {/* Source preview */}
              <Text className="mt-1 truncate text-[9px] text-gray-400">
                {layer.fileName ?? layer.url}
              </Text>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
