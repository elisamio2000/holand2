// ============================================
// StreetViewFolderPicker — folder browser for street-view image source
// Shows a text input for manual path entry AND a filesystem browser
// popup that lets the user navigate server directories and pick a folder
// containing panorama images without typing an absolute path.
// ============================================
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader, Text } from 'rizzui';
import {
  PiFolderBold,
  PiFolderOpenBold,
  PiArrowUpBold,
  PiCheckCircleBold,
  PiXBold,
  PiArrowClockwiseBold,
  PiImagesBold,
  PiWarningCircleBold,
} from 'react-icons/pi';
import cn from '@/lib/cn';
import { geoLocationService } from '@/services/geo-location.service';

// ==========================================
// Types
// ==========================================

interface BrowseEntry {
  name: string;
  isDir: boolean;
}

interface BrowseResponse {
  path: string;
  parent: string;
  items: BrowseEntry[];
  svJpegCount: number;
  totalJpegCount: number;
  jsonPanoCount: number;
}

interface StreetViewFolderPickerProps {
  /** Current folder path (controlled). */
  value: string;
  /** Called whenever the text input changes. */
  onChange: (path: string) => void;
  /**
   * Called when the user confirms a folder (either via "Load Folder" button
   * or "Select" in the browser popup). Receives the confirmed path.
   */
  onLoad: (path: string) => void;
  /** Extra CSS on the root element. */
  className?: string;
}

// ==========================================
// Component
// ==========================================

/**
 * StreetViewFolderPicker — combined text input + filesystem browser.
 *
 * Lets the user either:
 * 1. Type an absolute path directly and click "Load Folder", or
 * 2. Click "Browse" to navigate storage via
 *    `geoLocationService.streetviewBrowse()` and select a directory containing images.
 *
 * The component shows how many valid street-view JPEGs exist in the
 * currently browsed directory so the user knows when they've found the
 * right folder.
 *
 * @requires gateway map_explorer `streetview_browse` tool (via geoLocationService)
 *
 * @example
 * ```tsx
 * <StreetViewFolderPicker
 *   value={streetViewFolder}
 *   onChange={setStreetViewFolder}
 *   onLoad={(path) => {
 *     setStreetViewFolder(path);
 *     setStreetViewReloadKey(k => k + 1);
 *   }}
 * />
 * ```
 */
export default function StreetViewFolderPicker({
  value,
  onChange,
  onLoad,
  className,
}: StreetViewFolderPickerProps) {
  // ==========================================
  // Browser state
  // ==========================================
  const [showBrowser, setShowBrowser] = useState(false);
  const [browsePath, setBrowsePath] = useState('');
  const [parentPath, setParentPath] = useState('');
  const [entries, setEntries] = useState<BrowseEntry[]>([]);
  const [svJpegCount, setSvJpegCount] = useState(0);
  const [totalJpegCount, setTotalJpegCount] = useState(0);
  const [jsonPanoCount, setJsonPanoCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [browseError, setBrowseError] = useState('');

  const wrapperRef = useRef<HTMLDivElement>(null);

  // ==========================================
  // Directory listing fetcher
  // ==========================================

  /**
   * Fetch the directory listing from the browse API.
   * When dir is empty, the API defaults to the OS home directory.
   */
  const browse = useCallback(async (dir: string) => {
    setLoading(true);
    setBrowseError('');
    console.info('[StreetViewFolderPicker] Browsing:', { dir });
    try {
      const data = (await geoLocationService.streetviewBrowse(dir || undefined)) as unknown as BrowseResponse;
      setBrowsePath(data.path);
      setParentPath(data.parent);
      setEntries(data.items);
      setSvJpegCount(data.svJpegCount);
      setTotalJpegCount(data.totalJpegCount);
      setJsonPanoCount(data.jsonPanoCount ?? 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cannot read directory';
      console.error('[StreetViewFolderPicker] Browse error:', { dir, err });
      setBrowseError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Open browser starting at the current value (or home dir if empty).
  useEffect(() => {
    if (showBrowser) {
      browse(value || '');
    }
  }, [showBrowser]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close popup when clicking outside.
  useEffect(() => {
    if (!showBrowser) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowBrowser(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showBrowser]);

  // ==========================================
  // Handlers
  // ==========================================

  const handleSelectFolder = () => {
    onChange(browsePath);
    setShowBrowser(false);
    onLoad(browsePath);
  };

  const canGoUp = browsePath !== parentPath;

  // ==========================================
  // Render
  // ==========================================

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      {/* ── Text input + Browse button ── */}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="/absolute/path/to/images"
          className="min-w-0 flex-1 rounded border border-muted bg-white px-2 py-1 text-[11px] text-gray-700 placeholder-gray-400 outline-none focus:border-primary dark:bg-gray-50 dark:text-gray-200"
        />
        <button
          type="button"
          onClick={() => setShowBrowser((v) => !v)}
          title="Browse server filesystem"
          className={cn(
            'flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-[11px] transition-colors',
            showBrowser
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-muted bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-50 dark:hover:bg-gray-100'
          )}
        >
          <PiFolderOpenBold className="h-3.5 w-3.5" />
          Browse
        </button>
      </div>

      {/* ── Load Folder button ── */}
      <button
        type="button"
        onClick={() => onLoad(value)}
        className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded bg-primary px-2.5 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-primary-dark"
      >
        <PiArrowClockwiseBold className="h-3 w-3" />
        Load Folder
      </button>

      {/* ── Filesystem browser popup ── */}
      {showBrowser && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-lg border border-muted bg-white shadow-xl dark:bg-gray-50"
        >
          {/* Header: up + current path + close */}
          <div className="flex items-center gap-1 border-b border-muted bg-gray-50/80 px-2 py-1.5 dark:bg-gray-100/80">
            <button
              type="button"
              onClick={() => canGoUp && browse(parentPath)}
              disabled={!canGoUp}
              title="Go up one level"
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors',
                canGoUp
                  ? 'hover:bg-gray-200 dark:hover:bg-gray-300'
                  : 'cursor-not-allowed opacity-30'
              )}
            >
              <PiArrowUpBold className="h-3.5 w-3.5 text-gray-500" />
            </button>
            <Text className="min-w-0 flex-1 truncate text-[10px] font-mono text-gray-600 dark:text-gray-400">
              {browsePath || '…'}
            </Text>
            <button
              type="button"
              onClick={() => setShowBrowser(false)}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-300"
            >
              <PiXBold className="h-3 w-3 text-gray-400" />
            </button>
          </div>

          {/* Entry list */}
          <div className="max-h-52 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader size="sm" />
              </div>
            ) : browseError ? (
              <div className="flex items-center gap-2 p-3 text-[11px] text-red-600">
                <PiWarningCircleBold className="h-4 w-4 shrink-0" />
                {browseError}
              </div>
            ) : entries.length === 0 ? (
              <Text className="p-3 text-[11px] text-gray-400">Empty directory</Text>
            ) : (
              <div className="py-1">
                {entries.map((entry) => (
                  <button
                    key={entry.name}
                    type="button"
                    onClick={() => {
                      if (entry.isDir) {
                        const newPath = `${browsePath}/${entry.name}`.replace(/\/+/g, '/');
                        browse(newPath);
                      }
                    }}
                    disabled={!entry.isDir}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] transition-colors',
                      entry.isDir
                        ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-100'
                        : 'cursor-default'
                    )}
                  >
                    <PiFolderBold
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        entry.isDir ? 'text-amber-400' : 'text-gray-200'
                      )}
                    />
                    <span className={cn('truncate', entry.isDir ? '' : 'text-gray-300')}>
                      {entry.name}
                    </span>
                    {!entry.isDir && (
                      <span className="ml-auto shrink-0 text-[9px] text-gray-300">jpg</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer: image count + Select button */}
          <div className="flex items-center gap-2 border-t border-muted bg-gray-50/80 px-3 py-2 dark:bg-gray-100/80">
            <PiImagesBold className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <Text className="flex-1 text-[10px] text-gray-500">
              {svJpegCount > 0
                ? `${svJpegCount} valid street-view image${svJpegCount !== 1 ? 's' : ''}`
                : jsonPanoCount > 0
                ? `${jsonPanoCount} panorama${jsonPanoCount !== 1 ? 's' : ''} (panorama_north.json)`
                : totalJpegCount > 0
                ? `${totalJpegCount} JPEG${totalJpegCount !== 1 ? 's' : ''} (none match naming convention)`
                : 'No images in this folder'}
            </Text>
            <button
              type="button"
              onClick={handleSelectFolder}
              disabled={svJpegCount === 0 && jsonPanoCount === 0}
              className={cn(
                'flex shrink-0 items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium transition-colors',
                svJpegCount > 0 || jsonPanoCount > 0
                  ? 'bg-primary text-white hover:bg-primary-dark'
                  : 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-200'
              )}
            >
              <PiCheckCircleBold className="h-3.5 w-3.5" />
              Select
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
