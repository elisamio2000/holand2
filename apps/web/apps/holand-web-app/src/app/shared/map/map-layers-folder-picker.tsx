// Browse MAP_LAYERS_ROOT on Storage (relative paths for catalog / SAS raster import).
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Text } from 'rizzui';
import {
  PiFolderOpenBold,
  PiFolderBold,
  PiArrowUpBold,
  PiXBold,
} from 'react-icons/pi';
import cn from '@/lib/cn';
import toast from 'react-hot-toast';
import { geoLocationService } from '@/services/geo-location.service';
import { isGatewayToolError } from '@/utils/gateway-tool-success';

interface BrowseEntry {
  name: string;
  isDir?: boolean;
  is_dir?: boolean;
  sqlitedb_count?: number;
  jpeg_count?: number;
}

interface BrowseResponse {
  path?: string;
  parent?: string;
  items?: BrowseEntry[];
  entries?: BrowseEntry[];
  error?: string;
}

export interface MapLayersFolderPickerProps {
  value: string;
  onChange: (path: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  browseButtonLabel?: string;
  selectLabel?: string;
  /** Use dedicated /map/layers/browse (requires map_layers:import_shared). */
  useSharedBrowse?: boolean;
}

function normalizeBrowsePath(dir: string): string | undefined {
  const trimmed = dir.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  return trimmed || undefined;
}

function joinPath(base: string, name: string): string {
  return [base.replace(/\/+$/, ''), name].filter(Boolean).join('/');
}

export default function MapLayersFolderPicker({
  value,
  onChange,
  placeholder = 'مسیر نسبی زیر map-layers',
  className,
  inputClassName,
  browseButtonLabel,
  selectLabel = 'انتخاب',
  useSharedBrowse = false,
}: MapLayersFolderPickerProps) {
  const [show, setShow] = useState(false);
  const [browsePath, setBrowsePath] = useState('');
  const [parentPath, setParentPath] = useState('');
  const [entries, setEntries] = useState<BrowseEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const browse = useCallback(async (dir: string) => {
    setLoading(true);
    setError('');
    try {
      const data = (useSharedBrowse
        ? await geoLocationService.browseMapLayers(normalizeBrowsePath(dir))
        : await geoLocationService.streetviewBrowse(normalizeBrowsePath(dir))) as unknown as BrowseResponse;
      if (data.error) {
        const code = String(data.error);
        if (code === 'storage_timeout') {
          setError('مرور پوشه بیش از حد طول کشید — دوباره تلاش کنید.');
        } else if (code === 'storage_unreachable') {
          setError('سرویس storage در دسترس نیست.');
        } else if (code === 'map_layers_import_shared_required') {
          setError('دسترسی map_layers:import_shared لازم است.');
        } else {
          setError(code);
        }
        setEntries([]);
        return;
      }
      setBrowsePath(data.path ?? '');
      setParentPath(data.parent ?? '');
      setEntries(data.items ?? data.entries ?? []);
    } catch (e: unknown) {
      if (isGatewayToolError(e)) {
        setError(e.message);
      } else if (e && typeof e === 'object' && 'response' in e) {
        const ax = e as { response?: { status?: number; data?: { message?: string; detail?: string } } };
        setError(
          ax.response?.data?.message ||
            ax.response?.data?.detail ||
            `خطای سرور (${ax.response?.status ?? '?'})`
        );
      } else {
        setError(e instanceof Error ? e.message : 'مرور پوشه ناموفق بود');
      }
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [useSharedBrowse]);

  useEffect(() => {
    if (show) browse(value || '');
  }, [show]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!show) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShow(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [show]);

  const canGoUp = browsePath !== parentPath;

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          className={cn(
            'min-w-0 flex-1 rounded border border-muted bg-white px-2 py-1 text-[11px] text-gray-700 outline-none focus:border-primary dark:bg-gray-50 dark:text-gray-200',
            inputClassName
          )}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          title="مرور پوشه‌های storage"
          className={cn(
            'flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-[11px] transition-colors',
            show
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-muted bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-50'
          )}
        >
          <PiFolderOpenBold className="h-3.5 w-3.5" />
          {browseButtonLabel}
        </button>
      </div>

      {show && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-lg border border-muted bg-white shadow-xl dark:bg-gray-50">
          <div className="flex items-center gap-1 border-b border-muted bg-gray-50/80 px-2 py-1.5">
            <button
              type="button"
              onClick={() => canGoUp && browse(parentPath)}
              disabled={!canGoUp}
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded',
                canGoUp ? 'hover:bg-gray-200' : 'cursor-not-allowed opacity-30'
              )}
            >
              <PiArrowUpBold className="h-3.5 w-3.5 text-gray-500" />
            </button>
            <Text className="min-w-0 flex-1 truncate font-mono text-[10px] text-gray-600">
              {browsePath || '/'}
            </Text>
            <button
              type="button"
              onClick={() => setShow(false)}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-gray-200"
            >
              <PiXBold className="h-3 w-3 text-gray-400" />
            </button>
          </div>

          <div className="max-h-52 overflow-y-auto py-1">
            {loading ? (
              <div className="flex justify-center py-4">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : error ? (
              <Text className="p-3 text-[11px] text-red-600">{error}</Text>
            ) : entries.length === 0 ? (
              <Text className="p-3 text-[11px] text-gray-400">پوشه خالی است</Text>
            ) : (
              entries.map((entry) => (
                <button
                  key={entry.name}
                  type="button"
                  onClick={() => browse(joinPath(browsePath, entry.name))}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] hover:bg-gray-50"
                >
                  <PiFolderBold className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  <span className="truncate">{entry.name}</span>
                  {(entry.sqlitedb_count ?? 0) > 0 && (
                    <span className="ml-auto shrink-0 rounded bg-blue-100 px-1 text-[9px] text-blue-700">
                      SAS
                    </span>
                  )}
                </button>
              ))
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-muted bg-gray-50/80 px-3 py-2">
            <Text className="flex-1 truncate font-mono text-[10px] text-gray-500">
              {browsePath || '(ریشه map-layers)'}
            </Text>
            <button
              type="button"
              onClick={() => {
                onChange(browsePath);
                setShow(false);
                toast.success('مسیر انتخاب شد');
              }}
              className="shrink-0 rounded bg-primary px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90"
            >
              {selectLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
