// ============================================
// AddLayerWizard — three modes: personal / shared server / remote URL
// Flow: detect → preview → confirm
// ============================================
'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Text } from 'rizzui';
import { PiPlusBold, PiFolderOpenBold } from 'react-icons/pi';
import cn from '@/lib/cn';
import type { MapCoreRef, CustomLayerConfig } from '@/app/shared/map';
import MapLayersFolderPicker from '@/app/shared/map/map-layers-folder-picker';
import {
  geoLocationService,
  type MapLayerDetectResult,
  MAP_LAYERS_IMPORT_SHARED,
} from '@/services/geo-location.service';
import { detectLocalFile, kindLabel } from '@/lib/map-layer-detect-client';
import {
  fsaSupported,
  iterateDirectoryEntries,
  pickLocalDirectory,
  pickLocalFile,
  saveFsaHandle,
  sniffLocalDirectory,
} from '@/lib/map-local-fsa';
import { putLocalLayer } from '@/lib/map-local-layer-store';
import { isRasterCatalogKind } from '@/lib/map-storage-url';

export type AddLayerMode = 'personal' | 'shared' | 'remote';

export interface AddLayerResult {
  catalogLayerId?: string;
  /** When import registers multiple caches under one folder path. */
  catalogLayerIds?: string[];
  storageRoot?: string;
  layerKind?: string;
  streetviewPath?: string;
}

export interface AddLayerWizardProps {
  mapHandle: MapCoreRef | null;
  customLayers: CustomLayerConfig[];
  onCustomLayersChange: (layers: CustomLayerConfig[]) => void;
  canImportShared: boolean;
  onAdded: (result?: AddLayerResult) => void;
}

function generateLayerId(): string {
  return `layer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function DetectPreviewCard({ preview }: { preview: MapLayerDetectResult | null }) {
  if (!preview) return null;
  if (preview.ok === false) {
    const msg =
      preview.error === 'empty_directory'
        ? 'پوشه خالی است — داده در مسیر نیست یا symlink در data/map-layers درست نیست.'
        : preview.error || 'تشخیص ناموفق';
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
        {msg}
      </div>
    );
  }
  const dataOk = preview.data_available !== false;
  return (
    <div
      className={cn(
        'rounded-md border px-2 py-1.5 text-[11px]',
        dataOk ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'
      )}
    >
      <div className="font-medium">نوع: {kindLabel(preview.layer_kind)}</div>
      <div>داده: {dataOk ? 'در دسترس' : 'ناموجود / غیرقابل خواندن'}</div>
      {(preview.min_zoom != null || preview.max_zoom != null) && (
        <div>
          زوم: {preview.min_zoom ?? '?'} – {preview.max_zoom ?? '?'}
        </div>
      )}
      {preview.sas_role && <div>نقش: {preview.sas_role}</div>}
      {preview.layers_under && preview.layers_under.length > 0 && (
        <div className="mt-1 space-y-0.5 border-t border-green-200 pt-1">
          <div className="font-medium">{preview.layers_under.length} لایه زیر این پوشه:</div>
          {preview.layers_under.map((sub) => (
            <div key={sub.storage_root}>
              {sub.storage_root} — {sub.sas_role || sub.layer_kind}
            </div>
          ))}
        </div>
      )}
      {preview.warnings?.map((w) => (
        <div key={w} className="text-amber-700">
          {w}
        </div>
      ))}
    </div>
  );
}

export default function AddLayerWizard({
  mapHandle,
  customLayers,
  onCustomLayersChange,
  canImportShared,
  onAdded,
}: AddLayerWizardProps) {
  const [mode, setMode] = useState<AddLayerMode>('personal');
  const [name, setName] = useState('');
  const [serverPath, setServerPath] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState<MapLayerDetectResult | null>(null);
  const [clientPreview, setClientPreview] = useState<{ kind?: string; warning?: string } | null>(
    null
  );

  const resetPreview = useCallback(() => {
    setPreview(null);
    setClientPreview(null);
    setErr('');
  }, []);

  const runSharedDetect = useCallback(async (path: string) => {
    if (!path.trim() || !canImportShared) return;
    setDetecting(true);
    resetPreview();
    try {
      const det = await geoLocationService.detectMapLayer(path.trim());
      setPreview(det);
    } catch (e: unknown) {
      setPreview({ ok: false, error: e instanceof Error ? e.message : 'تشخیص ناموفق' });
    } finally {
      setDetecting(false);
    }
  }, [canImportShared, resetPreview]);

  const runRemoteDetect = useCallback(async (u: string) => {
    if (!u.trim()) return;
    setDetecting(true);
    resetPreview();
    try {
      const det = await geoLocationService.detectMapLayerUrl(u.trim());
      setPreview(det);
    } catch (e: unknown) {
      setPreview({ ok: false, error: e instanceof Error ? e.message : 'تشخیص URL ناموفق' });
    } finally {
      setDetecting(false);
    }
  }, [resetPreview]);

  useEffect(() => {
    if (mode === 'shared' && serverPath.trim()) {
      const t = setTimeout(() => runSharedDetect(serverPath), 400);
      return () => clearTimeout(t);
    }
  }, [mode, serverPath, runSharedDetect]);

  useEffect(() => {
    if (mode === 'remote' && url.trim().includes('{z}')) {
      const t = setTimeout(() => runRemoteDetect(url), 400);
      return () => clearTimeout(t);
    }
  }, [mode, url, runRemoteDetect]);

  const addPersonalFile = useCallback(
    async (file: File) => {
      const layerName = name.trim() || file.name.replace(/\.[^.]+$/, '');
      const det = await detectLocalFile(file);
      if (!det.ok) {
        setErr(det.error || 'فایل نامعتبر');
        return;
      }
      setClientPreview({ kind: det.layerKind, warning: det.warning });

      const id = generateLayerId();
      const localKind = det.localKind === 'kml' ? 'geojson' : det.localKind!;
      let config: CustomLayerConfig;

      if (localKind === 'geojson') {
        const text = await file.text();
        const parsed = JSON.parse(text) as GeoJSON.GeoJSON;
        await putLocalLayer({
          id,
          fileName: file.name,
          mime: file.type || 'application/geo+json',
          size: file.size,
          localKind: 'geojson',
          payload: text,
          savedAt: Date.now(),
        });
        config = {
          id,
          name: layerName,
          type: 'geojson',
          url: '',
          data: parsed,
          fileName: file.name,
          visible: true,
          opacity: 1,
        };
      } else {
        await putLocalLayer({
          id,
          fileName: file.name,
          mime: 'application/octet-stream',
          size: file.size,
          localKind: 'pmtiles',
          payload: file,
          savedAt: Date.now(),
        });
        const blob = `pmtiles://${URL.createObjectURL(file)}`;
        config = {
          id,
          name: layerName,
          type: 'raster',
          url: blob,
          fileName: file.name,
          visible: true,
          opacity: 1,
        };
      }

      mapHandle?.addCustomLayer(config);
      onCustomLayersChange([...customLayers, config]);
      toast.success('لایهٔ شخصی ذخیره شد (بدون آپلود به سرور)');
      onAdded();
    },
    [name, mapHandle, customLayers, onCustomLayersChange, onAdded]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void addPersonalFile(file);
      e.target.value = '';
    },
    [addPersonalFile]
  );

  const handleFsaFile = useCallback(async () => {
    const file = await pickLocalFile({
      'application/geo+json': ['.geojson', '.json'],
      'application/octet-stream': ['.pmtiles'],
    });
    if (file) await addPersonalFile(file);
  }, [addPersonalFile]);

  const handleFsaDirectory = useCallback(async () => {
    const dir = await pickLocalDirectory();
    if (!dir) return;
    const sniff = await sniffLocalDirectory(dir);
    if (sniff.kind === 'unknown') {
      setErr(sniff.warning || 'فرمت پوشه پشتیبانی نمی‌شود');
      return;
    }
    for await (const entry of iterateDirectoryEntries(dir)) {
      if (entry.kind !== 'file') continue;
      const fileHandle = entry as FileSystemFileHandle;
      if (fileHandle.name.toLowerCase().endsWith('.geojson') || fileHandle.name.toLowerCase().endsWith('.pmtiles')) {
        const file = await fileHandle.getFile();
        await saveFsaHandle(generateLayerId(), fileHandle, `${dir.name}/${fileHandle.name}`);
        await addPersonalFile(file);
        return;
      }
    }
  }, [addPersonalFile]);

  const submitShared = useCallback(async () => {
    const path = serverPath.trim();
    if (!path) return setErr('مسیر را انتخاب کنید.');
    if (!canImportShared) {
      return setErr(`دسترسی «${MAP_LAYERS_IMPORT_SHARED}» لازم است.`);
    }
    if (preview?.data_available === false) {
      return setErr('داده در مسیر انتخاب‌شده در دسترس نیست.');
    }
    setBusy(true);
    setErr('');
    try {
      const layerName = name.trim() || path.split('/').pop() || 'layer';
      const result = await geoLocationService.importMapLayer(path, { name: layerName });
      const items = Array.isArray(result.items)
        ? (result.items as Array<Record<string, unknown>>)
        : [];
      const layerIds = items.length
        ? items
            .map((row) => (typeof row.id === 'string' ? row.id : undefined))
            .filter((id): id is string => Boolean(id))
        : typeof result.id === 'string'
          ? [result.id]
          : [];
      const layerId = layerIds[0];
      const kind =
        typeof result.layer_kind === 'string'
          ? result.layer_kind
          : preview?.layer_kind;
      const root =
        typeof result.storage_root === 'string' ? result.storage_root : path;
      toast.success(
        layerIds.length > 1
          ? `${layerIds.length} لایه از پوشهٔ انتخاب‌شده افزوده شد`
          : 'لایهٔ مشترک افزوده شد'
      );
      onAdded({
        catalogLayerId: layerId,
        catalogLayerIds: layerIds.length ? layerIds : undefined,
        layerKind: kind,
        storageRoot: root,
        streetviewPath: kind?.startsWith('streetview') ? root : undefined,
      });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'افزودن ناموفق بود');
    } finally {
      setBusy(false);
    }
  }, [serverPath, canImportShared, preview, name, onAdded]);

  const submitRemote = useCallback(async () => {
    const u = url.trim();
    const layerName = name.trim();
    if (!layerName) return setErr('نام لایه لازم است.');
    if (!u) return setErr('URL لازم است.');

    const kind = preview?.layer_kind || 'raster_xyz';
    const isCatalogRaster =
      isRasterCatalogKind(kind) || kind === 'raster_remote' || kind === 'raster_wmts';

    setBusy(true);
    setErr('');
    try {
      if (isCatalogRaster && u.startsWith('http')) {
        const result = await geoLocationService.registerMapLayer({
          name: layerName,
          layer_kind: kind,
          source_url: u,
          source_type: 'url',
        });
        const layerId = typeof result.id === 'string' ? result.id : undefined;
        toast.success('لایهٔ خارجی در کاتالوگ ثبت شد');
        onAdded({ catalogLayerId: layerId, layerKind: kind });
        return;
      }

      const config: CustomLayerConfig = {
        id: generateLayerId(),
        name: layerName,
        type: kind.startsWith('vector') ? 'geojson' : 'raster',
        url: u,
        visible: true,
        opacity: 1,
      };
      mapHandle?.addCustomLayer(config);
      onCustomLayersChange([...customLayers, config]);
      toast.success('لایهٔ شخصی (URL) افزوده شد');
      onAdded();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'افزودن ناموفق بود');
    } finally {
      setBusy(false);
    }
  }, [url, name, preview, mapHandle, customLayers, onCustomLayersChange, onAdded]);

  const modeTabs: { id: AddLayerMode; label: string; hidden?: boolean }[] = [
    { id: 'personal', label: 'لایهٔ شخصی' },
    { id: 'shared', label: 'مسیر مشترک سرور', hidden: !canImportShared },
    { id: 'remote', label: 'سرور خارجی' },
  ];

  const canSubmitShared =
    canImportShared &&
    serverPath.trim() &&
    preview?.ok !== false &&
    preview?.data_available !== false;

  const canSubmitRemote = Boolean(name.trim() && url.trim() && preview?.ok !== false);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-muted bg-gray-50/60 p-2.5 dark:bg-gray-100/30">
      <div className="flex flex-wrap gap-1">
        {modeTabs
          .filter((t) => !t.hidden)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setMode(t.id);
                resetPreview();
              }}
              className={cn(
                'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                mode === t.id
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-200/40'
              )}
            >
              {t.label}
            </button>
          ))}
      </div>

      {mode === 'personal' && (
        <>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="نام لایه (اختیاری)"
            className="w-full rounded-md border border-muted bg-gray-0 px-2 py-1.5 text-xs outline-none focus:border-primary dark:bg-gray-50"
          />
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-muted px-2 py-2 text-xs text-gray-500 hover:border-primary hover:text-primary">
            <PiPlusBold className="h-3.5 w-3.5" />
            انتخاب فایل (.geojson / .pmtiles)
            <input
              type="file"
              accept=".geojson,.json,.pmtiles,.kml"
              onChange={handleFileInput}
              className="hidden"
            />
          </label>
          {fsaSupported() && (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => void handleFsaFile()}
                className="flex flex-1 items-center justify-center gap-1 rounded-md border border-muted px-2 py-1.5 text-[11px] text-gray-600 hover:bg-gray-100"
              >
                <PiFolderOpenBold className="h-3.5 w-3.5" />
                فایل (FSA)
              </button>
              <button
                type="button"
                onClick={() => void handleFsaDirectory()}
                className="flex flex-1 items-center justify-center gap-1 rounded-md border border-muted px-2 py-1.5 text-[11px] text-gray-600 hover:bg-gray-100"
              >
                <PiFolderOpenBold className="h-3.5 w-3.5" />
                پوشه (FSA)
              </button>
            </div>
          )}
          {clientPreview && (
            <Text className="text-[10px] text-gray-600">
              تشخیص: {kindLabel(clientPreview.kind)}
              {clientPreview.warning ? ` — ${clientPreview.warning}` : ''}
            </Text>
          )}
          <Text className="text-[10px] text-gray-500">
            بدون آپلود به سرور — متادیتا و فایل در مرورگر شما ذخیره می‌شود.
          </Text>
        </>
      )}

      {mode === 'shared' && canImportShared && (
        <>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="نام لایه (اختیاری)"
            className="w-full rounded-md border border-muted bg-gray-0 px-2 py-1.5 text-xs outline-none focus:border-primary dark:bg-gray-50"
          />
          <MapLayersFolderPicker
            value={serverPath}
            onChange={setServerPath}
            useSharedBrowse
          />
          {detecting && <Text className="text-[10px] text-gray-400">در حال تشخیص…</Text>}
          <DetectPreviewCard preview={preview} />
          <Text className="text-[10px] text-gray-500">
            هر پوشه‌ای که زیر <code className="text-[9px]">data/map-layers</code> روی سرور اضافه
            کنید اینجا دیده می‌شود — بعد از انتخاب، detect و «افزودن به کاتالوگ». دسترسی: Roles &
            Permissions → {MAP_LAYERS_IMPORT_SHARED}
          </Text>
          <button
            type="button"
            disabled={busy || !canSubmitShared}
            onClick={() => void submitShared()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {busy ? 'در حال افزودن…' : 'افزودن به کاتالوگ'}
          </button>
        </>
      )}

      {mode === 'remote' && (
        <>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="نام لایه"
            className="w-full rounded-md border border-muted bg-gray-0 px-2 py-1.5 text-xs outline-none focus:border-primary dark:bg-gray-50"
          />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…/{z}/{x}/{y}.png"
            className="w-full rounded-md border border-muted bg-gray-0 px-2 py-1.5 text-xs outline-none focus:border-primary dark:bg-gray-50"
          />
          <button
            type="button"
            disabled={detecting || !url.trim()}
            onClick={() => void runRemoteDetect(url)}
            className="self-start rounded border border-muted px-2 py-1 text-[10px] text-gray-600 hover:bg-gray-100"
          >
            تشخیص URL
          </button>
          {detecting && <Text className="text-[10px] text-gray-400">در حال تشخیص…</Text>}
          <DetectPreviewCard preview={preview} />
          <button
            type="button"
            disabled={busy || !canSubmitRemote}
            onClick={() => void submitRemote()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {busy ? 'در حال افزودن…' : 'افزودن'}
          </button>
        </>
      )}

      {err && <Text className="text-[11px] text-red-500">{err}</Text>}
    </div>
  );
}
