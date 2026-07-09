// ============================================
// FileDetailPanel — Right Panel with 4 tabs
// Shows full artifact detail: Info, Metadata, Security, Processing.
// ============================================

'use client';

import { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { Text, Title, Button, Loader, ActionIcon, Badge, Alert } from 'rizzui';
import {
  PiInfoBold,
  PiCodeBold,
  PiGearBold,
  PiDownloadSimpleBold,
  PiTrashBold,
  PiXBold,
  PiImageBold,
  PiFilePdfBold,
  PiVideoFill,
  PiMusicNotesBold,
  PiArchiveBold,
  PiCheckCircleBold,
  PiClockBold,
  PiWarningCircleBold,
  PiPlayBold,
  PiShareNetworkBold,
  PiArrowsClockwiseBold,
  PiMagnifyingGlassPlusBold,
  PiCaretUpBold,
  PiCaretDownBold,
  PiCopyBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { storageService } from '@/services/storage.service';
import { getFileIcon } from '@/utils/file-icons';
import { routes } from '@/config/routes';
import type {
  Artifact,
  ArtifactDetail,
  FileManagerDetailResult,
  FileManagerPluginResult,
  FileManagerToolStatus,
} from '@/types/storage.types';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import ShareModal from './share-modal';
import Link from 'next/link';
import { getPluginRenderer, hasNativeRenderer } from '@/app/shared/plugins/plugin-registry';
import type { PluginRunResult } from '@/types/plugins.types';

// ==========================================
// Types
// ==========================================

type DetailTab = 'info' | 'tools' | 'processing';

/** Canonical file_manager detail endpoint — all explorer detail tabs should cite this. */
const FILE_MANAGER_DETAIL_ENDPOINT = 'POST /tools/plugin_file_manager_detail/execute';

/**
 * Backend aggregates multiple stores inside the file_manager plugin; the UI
 * only sees the merged JSON. Source line is for debugging (per backend team).
 */
const FILE_MANAGER_DETAIL_DB_LINE =
  'Aggregated by plugin `file_manager`: PostgreSQL (RBAC, tags, folders), MinIO (object storage), MongoDB (tool run outputs), Qdrant (vectors) / Neo4j (graph) when applicable — not exposed per-field in this API response.';

interface FileDetailPanelProps {
  /** The selected artifact (lightweight, from list) */
  artifact: Artifact | null;
  /** Called when user deletes this artifact */
  onDeleted: (id: string) => void;
  /** Called when user closes the panel */
  onClose: () => void;
  /** v0.44.0 — open authenticated preview modal for this artifact. */
  onPreview?: (artifact: Artifact) => void;
  /** v0.44.0 — promise-based confirmation guard for destructive actions. */
  onConfirmDelete?: (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
  }) => Promise<boolean>;
  className?: string;
}

// ==========================================
// Helpers
// ==========================================

function formatSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

// ==========================================
// Tab Panels
// ==========================================

/** Info Tab — basic artifact information */
function InfoTab({ artifact }: { artifact: ArtifactDetail }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'File name', value: artifact.filename },
    { label: 'Size', value: formatSize(artifact.file_size) },
    { label: 'MIME type', value: <code className="text-xs">{artifact.mime_type}</code> },
    { label: 'Uploaded by', value: artifact.uploaded_by || '—' },
    {
      label: 'Uploaded at',
      value: artifact.created_at
        ? dayjs(artifact.created_at).format('YYYY-MM-DD HH:mm')
        : '—',
    },
    {
      label: 'Session',
      value: artifact.session_id ? (
        <code className="text-xs">{artifact.session_id}</code>
      ) : (
        '—'
      ),
    },
    {
      label: 'Artifact ID',
      value: <code className="text-xs break-all">{artifact.id}</code>,
    },
    {
      label: 'Folder path',
      value: artifact.folder_path ? (
        <code className="text-xs">{artifact.folder_path}</code>
      ) : (
        <span className="text-gray-400">Root</span>
      ),
    },
  ];

  return (
    <div className="space-y-0">
      {rows.map(({ label, value }) => (
        <div
          key={label}
          className="flex items-start gap-2 border-b border-gray-100 py-2.5 last:border-0 dark:border-gray-800"
        >
          <span className="w-24 shrink-0 text-xs text-gray-500">{label}</span>
          <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">{value}</span>
        </div>
      ))}
      {process.env.NODE_ENV === 'development' && (
        <Text className="mt-3 text-[10px] leading-relaxed text-gray-400">
          Source: <code>{FILE_MANAGER_DETAIL_ENDPOINT}</code> → fields mapped in{' '}
          <code>storageService.toArtifactDetail</code> (PostgreSQL-backed artifact row + plugin fields per file_manager).
        </Text>
      )}
    </div>
  );
}

const PROCESSING_STATUS_TO_TOOL: Record<string, string> = {
  file_meta: 'file.meta',
  file_secure: 'file.secure',
  file_identify: 'file.identify',
};

/**
 * `path` argument expected by gateway tool-runner for `file.*` tools.
 * Prefer virtual prefix + filename (MinIO-style key); fall back to artifact UUID (chat upload convention).
 */
function toolRunnerPathForArtifact(
  artifactId: string,
  detail: Pick<ArtifactDetail, 'folder_path' | 'filename'>
): string {
  const raw = (detail.folder_path ?? '').replace(/\\/g, '/').trim();
  const fp = raw.replace(/^\/+|\/+$/g, '');
  const fn = (detail.filename ?? '').trim();
  if (fp && fn) return `${fp}/${fn}`;
  return artifactId;
}

/**
 * Merge server `plugins[]` with denormalized `metadata` / `security` on the
 * detail payload and optional list-view `processing_status` keys so every
 * tool slot appears once in the Tool outputs tab.
 */
function mergeToolOutputRows(
  plugins: FileManagerPluginResult[] | undefined,
  detail: ArtifactDetail,
  processingStatus?: Artifact['processing_status']
): FileManagerPluginResult[] {
  const rows: FileManagerPluginResult[] = [...(plugins ?? [])];
  const seen = new Set(
    rows.map((r) => r.plugin_id ?? (r as unknown as { tool_id?: string }).tool_id)
  );

  const getPluginId = (row: FileManagerPluginResult) =>
    row.plugin_id ?? (row as unknown as { tool_id?: string }).tool_id;

  const pushIfNew = (row: FileManagerPluginResult) => {
    const pluginId = getPluginId(row);
    if (!pluginId || seen.has(pluginId)) return;
    rows.push(row);
    seen.add(pluginId);
  };

  if (detail.metadata && Object.keys(detail.metadata).length > 0 && !seen.has('file.meta')) {
    pushIfNew({
      plugin_id: 'file.meta',
      status: 'done',
      result: detail.metadata as Record<string, unknown>,
    });
  }
  if (detail.security && Object.keys(detail.security).length > 0 && !seen.has('file.secure')) {
    pushIfNew({
      plugin_id: 'file.secure',
      status: 'done',
      result: detail.security as Record<string, unknown>,
    });
  }

  if (processingStatus) {
    for (const key of Object.keys(processingStatus)) {
      const pluginId = PROCESSING_STATUS_TO_TOOL[key] ?? key.replace(/_/g, '.');
      if (!seen.has(pluginId)) {
        const st = processingStatus[key as keyof typeof processingStatus];
        pushIfNew({
          plugin_id: pluginId,
          status: st ?? null,
          result: null,
        });
      }
    }
  }

  return rows;
}

function pluginRowToRunResult(
  pluginId: string,
  row: FileManagerPluginResult
): PluginRunResult | null {
  const raw = row.result ?? (row as unknown as { data?: unknown }).data;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const resolvedToolId =
      pluginId || (typeof o.tool_id === 'string' ? o.tool_id : undefined) ||
      (row as unknown as { tool_id?: string }).tool_id;

    if (typeof o.tool_id === 'string' && (o.data !== undefined || o.channels !== undefined)) {
      return raw as unknown as PluginRunResult;
    }
    if (Object.keys(o).length > 0) {
      return {
        tool_id: resolvedToolId || pluginId,
        status: row.status === 'failed' ? 'error' : 'completed',
        data: o,
      };
    }
  }
  return null;
}

/** Debug banner: which API was used and documented backend stores. */
function getInternalPluginUrl(pluginId: string): string {
  return routes.plugins.detail(pluginId);
}

function DetailSourceDebugNote({
  artifactId,
  rawExtra,
}: {
  artifactId: string;
  rawExtra?: Record<string, unknown> | null;
}) {
  const backendHints = rawExtra && typeof rawExtra === 'object' ? rawExtra['_debug_sources'] : null;

  return (
    <div className="mb-4 rounded-lg border border-dashed border-muted bg-gray-50/80 p-3 dark:bg-gray-900/40">
      <Text className="mb-1 text-xs font-semibold text-gray-700 dark:text-gray-200">
        Data sources (debug)
      </Text>
      <ul className="list-inside list-disc space-y-1 text-[11px] leading-relaxed text-gray-600 dark:text-gray-400">
        <li>
          <span className="font-medium text-gray-800 dark:text-gray-200">API:</span>{' '}
          <code className="break-all">{FILE_MANAGER_DETAIL_ENDPOINT}</code>
          <span className="text-gray-500"> — artifact_id </span>
          <code className="break-all">{artifactId}</code>
        </li>
        <li>
          <span className="font-medium text-gray-800 dark:text-gray-200">Backend stores (documented):</span>{' '}
          {FILE_MANAGER_DETAIL_DB_LINE}
        </li>
        <li>
          <span className="font-medium text-gray-800 dark:text-gray-200">Per-tool payload:</span> usually{' '}
          <code className="break-all">result.data.plugins[].result</code> (tool outputs persisted in MongoDB per
          file_manager design); denormalized <code>metadata</code> / <code>security</code> on the same response when
          the plugin materializes them.
        </li>
        {backendHints != null && (
          <li>
            <span className="font-medium">Server _debug_sources:</span>{' '}
            <pre className="mt-1 max-h-32 overflow-auto rounded bg-gray-100 p-2 text-[10px] dark:bg-gray-800">
              {JSON.stringify(backendHints, null, 2)}
            </pre>
          </li>
        )}
      </ul>
      <div className="mt-2 flex flex-wrap gap-2">
        <Link
          href="/plugins/internal-plugin"
          className="text-[11px] font-medium text-primary underline-offset-2 hover:underline"
        >
          Internal plugins catalog
        </Link>
        <Text className="text-[11px] text-gray-500">— native UI registry for tools with a renderer</Text>
      </div>
    </div>
  );
}

/**
 * Native `file.meta` UI expects full FileMetaResult (`data.metadata.image`, …).
 * `plugin.file_manager.detail` often returns a flat summary on `metadata` — use JSON for that.
 */
function fileMetaPayloadSupportsNativeUi(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const m = (data as Record<string, unknown>).metadata;
  return m !== null && typeof m === 'object';
}

function ToolOutputRow({
  row,
  detail,
}: {
  row: FileManagerPluginResult;
  detail: ArtifactDetail;
}) {
  const pluginId =
    row.plugin_id ?? (row as unknown as { tool_id?: string }).tool_id ?? 'unknown';
  const [open, setOpen] = useState(true);
  const runResult = useMemo(() => {
    const fromRow = pluginRowToRunResult(pluginId, row);
    if (fromRow) return fromRow;
    if (pluginId === 'file.meta' && detail.metadata && Object.keys(detail.metadata).length > 0) {
      return {
        tool_id: 'file.meta',
        status: 'completed' as const,
        data: detail.metadata as Record<string, unknown>,
      };
    }
    if (
      (pluginId === 'file.secure' || pluginId === 'file.security') &&
      detail.security &&
      Object.keys(detail.security).length > 0
    ) {
      return {
        tool_id: pluginId,
        status: 'completed' as const,
        data: detail.security as Record<string, unknown>,
      };
    }
    return null;
  }, [pluginId, row, detail.metadata, detail.security]);

  const Renderer = getPluginRenderer(pluginId);
  const native = hasNativeRenderer(pluginId);
  const useNativeUi =
    native && (pluginId !== 'file.meta' || fileMetaPayloadSupportsNativeUi(runResult?.data));
  const noopRun = useCallback(async () => {
    toast('Use the Processing tab to run or re-run tools on this file.', { icon: 'ℹ️' });
  }, []);

  const jsonFallback =
    runResult?.data ??
    (runResult && typeof runResult === 'object' ? (runResult as Record<string, unknown>) : null);
  const pluginPageUrl = getInternalPluginUrl(pluginId);

  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-800">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 border-b border-gray-100 px-3 py-2.5 text-left dark:border-gray-800"
      >
        <div className="min-w-0 flex-1">
          <code className="text-xs font-semibold text-gray-800 dark:text-gray-100">{pluginId}</code>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            {row.status != null && (
              <span className="text-[10px] uppercase text-gray-500">status: {String(row.status)}</span>
            )}
            {row.executed_at && (
              <span className="text-[10px] text-gray-400">
                {dayjs(row.executed_at).format('YYYY-MM-DD HH:mm')}
              </span>
            )}
            <Badge
              variant="outline"
              className="text-[10px] font-medium uppercase"
              color={useNativeUi ? 'primary' : 'secondary'}
            >
              {useNativeUi ? 'Native UI' : 'JSON fallback'}
            </Badge>
          </div>
        </div>
        {open ? (
          <PiCaretUpBold className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        ) : (
          <PiCaretDownBold className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        )}
      </button>

      {open && (
        <div className="space-y-2 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Text className="text-[10px] leading-relaxed text-gray-500">
              Payload from <code>{FILE_MANAGER_DETAIL_ENDPOINT}</code>
            </Text>
            <Link
              href={pluginPageUrl}
              className="rounded-full border border-muted px-2 py-1 text-[10px] font-medium text-gray-600 transition-colors hover:border-primary hover:text-primary"
            >
              Open plugin page
            </Link>
          </div>
          <Text className="text-[10px] leading-relaxed text-gray-500">
            {row.result ? (
              <>
                → <code>plugins[].result</code> (tool document; typically MongoDB via file_manager)
              </>
            ) : detail.metadata && pluginId === 'file.meta' ? (
              <>
                → <code>metadata</code> (denormalized on same response)
              </>
            ) : detail.security && (pluginId === 'file.secure' || pluginId === 'file.security') ? (
              <>
                → <code>security</code> (denormalized on same response)
              </>
            ) : (
              <> — no stored payload yet; run from Processing tab.</>
            )}
          </Text>

          {runResult ? (
            useNativeUi ? (
              <div className="max-h-[min(70vh,520px)] overflow-y-auto rounded-md border border-muted bg-gray-0 p-2 dark:bg-gray-50">
                <Suspense
                  fallback={
                    <div className="flex justify-center py-6">
                      <Loader size="sm" />
                    </div>
                  }
                >
                  <Renderer
                    pluginId={pluginId}
                    result={runResult}
                    isRunning={false}
                    readOnly
                    onRun={noopRun}
                  />
                </Suspense>
              </div>
            ) : (
              <pre className="max-h-64 overflow-auto rounded-md border border-muted bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                {JSON.stringify(jsonFallback ?? runResult, null, 2)}
              </pre>
            )
          ) : (
            <Text className="text-center text-xs text-gray-400 py-3">
              No result payload for this tool yet.
            </Text>
          )}
        </div>
      )}
    </div>
  );
}

/** One tab: every tool / plugin slot with native renderer or full JSON. */
function ToolOutputsTab({
  artifactId,
  plugins,
  detail,
  processingStatus,
  rawDetail,
}: {
  artifactId: string;
  plugins: FileManagerPluginResult[] | undefined;
  detail: ArtifactDetail;
  processingStatus?: Artifact['processing_status'];
  rawDetail: FileManagerDetailResult | null;
}) {
  const rows = useMemo(
    () => mergeToolOutputRows(plugins, detail, processingStatus),
    [plugins, detail, processingStatus]
  );

  const rawExtra = rawDetail as Record<string, unknown> | null;

  if (rows.length === 0) {
    const pluginCount = plugins?.length ?? 0;
    return (
      <>
        {process.env.NODE_ENV === 'development' && (
          <DetailSourceDebugNote artifactId={artifactId} rawExtra={rawExtra} />
        )}
        <div className="rounded-lg border border-dashed border-muted bg-gray-50 p-5 dark:bg-gray-900/30">
          <Text className="mb-3 text-sm text-gray-600 dark:text-gray-300">
            No tool outputs were returned for this file. Verify the backend detail response includes <code>plugins</code>,
            <code>metadata</code>, or <code>security</code> for this artifact, or run tools from the Processing tab.
          </Text>
          {pluginCount > 0 && (
            <div className="mb-3 rounded-md bg-orange-50 p-3 text-sm text-orange-700 dark:bg-orange-950/20 dark:text-orange-200">
              Backend returned {pluginCount} plugin object{pluginCount === 1 ? '' : 's'}, but the UI could not map them to renderable tool rows.
            </div>
          )}
          {pluginCount > 0 && (
            <details className="mb-3 rounded border border-muted bg-white p-3 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-200">
              <summary className="cursor-pointer font-medium">Inspect raw plugin payload</summary>
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words bg-gray-50 p-2 text-[11px] text-gray-700 dark:bg-gray-950 dark:text-gray-200">
                {JSON.stringify(plugins, null, 2)}
              </pre>
            </details>
          )}
          {rawDetail && (
            <details className="rounded border border-muted bg-white p-3 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-200">
              <summary className="cursor-pointer font-medium">Inspect full raw detail payload</summary>
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words bg-gray-50 p-2 text-[11px] text-gray-700 dark:bg-gray-950 dark:text-gray-200">
                {JSON.stringify(rawDetail, null, 2)}
              </pre>
            </details>
          )}
          <Link
            href="/plugins/internal-plugin"
            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            Browse internal plugins catalog
          </Link>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-3">
      {process.env.NODE_ENV === 'development' && (
        <DetailSourceDebugNote artifactId={artifactId} rawExtra={rawExtra} />
      )}
      <div className="space-y-2">
        {rows.map((row) => (
          <ToolOutputRow key={row.plugin_id} row={row} detail={detail} />
        ))}
      </div>
    </div>
  );
}

/** Default rows when detail has no `plugins` / processing_status (tool ids must match gateway). */
const DEFAULT_PROCESSING_PLUGINS: FileManagerPluginResult[] = [
  { plugin_id: 'file.identify', status: null },
  { plugin_id: 'file.meta', status: null },
  { plugin_id: 'file.secure', status: null },
];

/**
 * ProcessingTab — plugin run history + manual analysis trigger.
 *
 * Receives `plugins` directly from the parent's `plugin.file_manager.detail`
 * fetch (no extra round-trip). Each row gets a "Run" button that triggers
 * the corresponding tool via `storageService.runArtifactAnalysis` and asks
 * the parent to refresh on completion (v0.42.0).
 *
 * Re-run: POST `/tools/{toolId}/execute` with `{ artifact_id, path }` (path required by validator); then reload detail via
 * `POST /tools/plugin.file_manager.detail/execute`. Feasibility depends on each tool being registered on the gateway.
 */
function ProcessingTab({
  artifactId,
  plugins,
  processingStatus,
  detail,
  onRefresh,
}: {
  artifactId: string;
  plugins?: FileManagerPluginResult[];
  processingStatus?: Artifact['processing_status'];
  /** Used to merge every tool slot (same list as Tool outputs tab) for Run / Re-run. */
  detail: ArtifactDetail;
  onRefresh: () => void;
}) {
  const [runningId, setRunningId] = useState<string | null>(null);
  /**
   * Per-plugin last-run summary captured from the most recent
   * `POST /tools/{id}/execute` response. Survives across refreshes so users
   * keep seeing their click feedback even when the backend hasn't persisted
   * the run history yet.
   */
  const [lastResults, setLastResults] = useState<
    Record<string, { ok: boolean; error?: string; preview?: string }>
  >({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  /** Trigger a plugin run, capture the envelope, and refresh on completion. */
  const handleRun = useCallback(
    async (pluginId: string) => {
      console.info('[FileDetailPanel/Processing] Running plugin:', { pluginId, artifactId });
      setRunningId(pluginId);
      try {
        const res = await storageService.runArtifactAnalysis(pluginId, artifactId, {
          path: toolRunnerPathForArtifact(artifactId, detail),
        });
        // Tool envelope can be either `{ ok, error, result }` (gateway shape)
        // or `{ ok, result: { ok, error } }` (plugin-wrapped). Treat any
        // ok=false at either level as a plugin-level failure even on HTTP 200.
        const envelopeOk = (res as { ok?: boolean })?.ok;
        const innerOk = (res as { result?: { ok?: boolean } })?.result?.ok;
        const ok = envelopeOk !== false && innerOk !== false;
        const error =
          (res as { error?: string })?.error ||
          (res as { result?: { error?: string } })?.result?.error;
        const data =
          (res as { result?: unknown })?.result ?? (res as { data?: unknown })?.data ?? res;
        let preview: string | undefined;
        try {
          preview = JSON.stringify(data, null, 2);
          if (preview && preview.length > 600) preview = preview.slice(0, 600) + '\n…';
        } catch {
          preview = undefined;
        }
        setLastResults((prev) => ({
          ...prev,
          [pluginId]: { ok, error: ok ? undefined : error || 'plugin reported failure', preview },
        }));
        if (ok) {
          toast.success(`Executed ${pluginId}`);
        } else {
          console.warn('[FileDetailPanel/Processing] Plugin reported failure:', {
            pluginId,
            error,
          });
          toast.error(`Plugin error: ${error || pluginId}`);
        }
        onRefresh();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'unknown error';
        console.error('[FileDetailPanel/Processing] Run failed:', { pluginId, error });
        setLastResults((prev) => ({
          ...prev,
          [pluginId]: { ok: false, error: message },
        }));
        toast.error('Plugin execution failed');
      } finally {
        setRunningId(null);
      }
    },
    [artifactId, detail, onRefresh]
  );

  const toggleExpanded = useCallback((pluginId: string) => {
    setExpanded((prev) => ({ ...prev, [pluginId]: !prev[pluginId] }));
  }, []);

  // Same merge as Tool outputs tab so every known tool id can be re-run via POST /tools/{id}/execute.
  const merged: FileManagerPluginResult[] = useMemo(() => {
    const rows = mergeToolOutputRows(plugins, detail, processingStatus);
    if (rows.length > 0) return rows;
    return DEFAULT_PROCESSING_PLUGINS;
  }, [plugins, detail, processingStatus]);

  /**
   * Copy the plugin result JSON to clipboard.
   */
  const handleCopyJson = useCallback(
    async (pluginId: string) => {
      console.info('[FileDetailPanel/Processing] Copying JSON:', { pluginId });
      try {
        const last = lastResults[pluginId];
        const plugin = merged.find((p) => p.plugin_id === pluginId);
        const data =
          last?.preview ??
          (plugin?.result ? JSON.stringify(plugin.result, null, 2) : null);
        if (!data) {
          toast.error('No data to copy');
          return;
        }
        const fullData = data.endsWith('\n…') ? data.slice(0, -2) : data;
        await navigator.clipboard.writeText(fullData);
        toast.success('JSON copied');
      } catch (error: unknown) {
        console.error('[FileDetailPanel/Processing] Copy failed:', error);
        toast.error('Copy failed');
      }
    },
    [lastResults, merged]
  );

  // Optional fallback: if the server returned no plugin info AND we have a
  // legacy `processing_status` map from the list response, render that.
  if (merged.length === 0 && processingStatus) {
    return (
      <div className="space-y-2">
        {Object.entries(processingStatus).map(([plugin, status]) => (
          <div key={plugin} className="flex items-center gap-2">
            {status === 'done' ? (
              <PiCheckCircleBold className="h-4 w-4 text-green-500" />
            ) : status === 'pending' ? (
              <PiClockBold className="h-4 w-4 text-yellow-500" />
            ) : (
              <PiWarningCircleBold className="h-4 w-4 text-gray-300" />
            )}
            <code className="text-xs text-gray-600 dark:text-gray-400">{plugin}</code>
            <span className="ml-auto text-xs text-gray-400">
              {status === 'done' ? 'Completed' : status === 'pending' ? 'Pending' : 'Not run'}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {merged.map((plugin) => {
        const isRunning = runningId === plugin.plugin_id;
        const last = lastResults[plugin.plugin_id];
        const isExpanded = !!expanded[plugin.plugin_id];
        const persistedError = (plugin as { error?: string }).error;
        const persistedResult = (plugin as { result?: unknown }).result;
        const showError = last?.error || (plugin.status === 'failed' ? persistedError : undefined);
        const showPreview = last?.preview;
        const hasPersistedDetails = Boolean(
          persistedResult &&
            typeof persistedResult === 'object' &&
            Object.keys(persistedResult as object).length > 0
        );

        return (
          <div
            key={plugin.plugin_id}
            className="rounded-lg border border-gray-100 dark:border-gray-800"
          >
            <div className="flex items-center gap-2 p-3">
              {plugin.status === 'done' ? (
                <PiCheckCircleBold className="h-4 w-4 shrink-0 text-green-500" />
              ) : plugin.status === 'pending' ? (
                <PiClockBold className="h-4 w-4 shrink-0 text-yellow-500" />
              ) : plugin.status === 'failed' ? (
                <PiWarningCircleBold className="h-4 w-4 shrink-0 text-red-500" />
              ) : (
                <PiPlayBold className="h-4 w-4 shrink-0 text-gray-300" />
              )}
              <div className="flex-1 min-w-0">
                <code className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {plugin.plugin_id}
                </code>
                {plugin.executed_at && (
                  <Text className="text-xs text-gray-400">
                    {dayjs(plugin.executed_at).format('YYYY-MM-DD HH:mm')}
                  </Text>
                )}
              </div>
              {(showPreview || hasPersistedDetails) && (
                <ActionIcon
                  size="sm"
                  variant="text"
                  onClick={() => toggleExpanded(plugin.plugin_id)}
                  title={isExpanded ? 'Hide details' : 'Show details'}
                  className="h-7 w-7"
                >
                  {isExpanded ? (
                    <PiCaretUpBold className="h-3.5 w-3.5" />
                  ) : (
                    <PiCaretDownBold className="h-3.5 w-3.5" />
                  )}
                </ActionIcon>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRun(plugin.plugin_id)}
                isLoading={isRunning}
                disabled={runningId !== null}
                className="h-7 gap-1 px-2 text-[11px]"
              >
                <PiPlayBold className="h-3 w-3" />
                {plugin.status === 'done' || last?.ok ? 'Re-run' : 'Run'}
              </Button>
            </div>

            {showError && (
              <div className="mx-3 mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/50 dark:bg-red-950/30">
                <div className="flex items-start gap-2">
                  <PiWarningCircleBold className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                  <Text className="break-all text-[11px] leading-relaxed text-red-700 dark:text-red-300">
                    {showError}
                  </Text>
                </div>
              </div>
            )}

            {last?.ok && !isExpanded && (
              <div className="mx-3 mb-3 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-1.5 dark:border-green-900/50 dark:bg-green-950/30">
                <PiCheckCircleBold className="h-3.5 w-3.5 shrink-0 text-green-500" />
                <Text className="text-[11px] text-green-700 dark:text-green-300">
                  Execution succeeded
                </Text>
              </div>
            )}

            {isExpanded && (showPreview || hasPersistedDetails) && (
              <div className="mx-3 mb-3 rounded-md border border-muted bg-gray-50 dark:bg-gray-100">
                <div className="flex items-center justify-between border-b border-muted px-3 py-2">
                  <Text className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Result
                  </Text>
                  <ActionIcon
                    size="sm"
                    variant="text"
                    onClick={() => handleCopyJson(plugin.plugin_id)}
                    title="Copy JSON"
                    className="h-6 w-6"
                  >
                    <PiCopyBold className="h-3.5 w-3.5" />
                  </ActionIcon>
                </div>
                <pre className="max-h-64 overflow-auto p-3 text-[11px] leading-relaxed text-gray-700 dark:text-gray-300">
                  {showPreview ?? JSON.stringify(persistedResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ==========================================
// FileDetailPanel — Main Component
// ==========================================

/**
 * FileDetailPanel — Right panel of File Explorer.
 *
 * Loads the canonical bundle via plugin.file_manager.detail (see FILE_MANAGER_DETAIL_ENDPOINT).
 * Tabs: Info, Tool outputs (all tools / JSON or native renderer), Processing (run & re-run).
 *
 * @example
 * ```tsx
 * <FileDetailPanel artifact={selected} onDeleted={handleDelete} onClose={() => setSelected(null)} />
 * ```
 */
export default function FileDetailPanel({
  artifact,
  onDeleted,
  onClose,
  onPreview,
  onConfirmDelete,
  className,
}: FileDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('info');
  const [detail, setDetail] = useState<ArtifactDetail | null>(null);
  // Raw response from plugin.file_manager.detail — kept around so we can
  // render `plugins` and `share` info that aren't in the lightweight
  // ArtifactDetail shape.
  const [rawDetail, setRawDetail] = useState<FileManagerDetailResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toolsStatus, setToolsStatus] = useState<FileManagerToolStatus[]>([]);

  /**
   * Load (or reload) the file_manager detail bundle. Exposed as a callback
   * so child tabs can request a refresh after mutating actions like
   * "Run plugin".
   */
  const reloadDetail = useCallback(async () => {
    if (!artifact) return;
    setLoadError(null);
    setLoading(true);
    console.info('[FileDetailPanel] Fetching detail via plugin.file_manager.detail:', {
      id: artifact.id,
    });
    try {
      const raw = await storageService.getFileManagerDetail({
        artifact_id: artifact.id,
      });
      setRawDetail(raw);
      setDetail(storageService.toArtifactDetail(raw));
      console.info('[FileDetailPanel] Detail loaded:', {
        id: artifact.id,
        plugins: raw.plugins?.length ?? 0,
      });
      const tools = await storageService.getToolsForArtifact(artifact.id);
      setToolsStatus(tools);
    } catch (err) {
      console.error('[FileDetailPanel] Failed to load detail:', { id: artifact.id, err });
      // Fall back to the lightweight artifact so the Info tab still works.
      setDetail(artifact as ArtifactDetail);
      setRawDetail(null);
      const message = err instanceof Error ? err.message : 'Failed to load file details';
      setLoadError(message);
      toast.error('Failed to load file details');
    } finally {
      setLoading(false);
    }
  }, [artifact]);

  // Fetch full detail when artifact changes.
  useEffect(() => {
    if (!artifact) return;
    setDetail(null);
    setRawDetail(null);
    setToolsStatus([]);
    setActiveTab('info');
    reloadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifact?.id]);

  useEffect(() => {
    if (!artifact?.id) {
      setToolsStatus([]);
      return;
    }
    let cancelled = false;
    storageService.getToolsForArtifact(artifact.id).then((tools) => {
      if (!cancelled) setToolsStatus(tools);
    });
    return () => {
      cancelled = true;
    };
  }, [artifact?.id]);

  const handleDelete = useCallback(async () => {
    if (!artifact) return;
    // v0.44.0 — guard with confirmation modal when available.
    if (onConfirmDelete) {
      const ok = await onConfirmDelete({
        title: 'Delete file',
        message: `Are you sure you want to delete "${artifact.filename}"? This action cannot be undone.`,
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        destructive: true,
      });
      if (!ok) {
        console.info('[FileDetailPanel] Delete cancelled by user', { id: artifact.id });
        return;
      }
    }
    console.info('[FileDetailPanel] Deleting artifact:', { id: artifact.id });
    setDeleting(true);
    try {
      await storageService.deleteArtifactsViaBatch([artifact.id]);
      toast.success('File deleted successfully');
      onDeleted(artifact.id);
      console.info('[FileDetailPanel] Artifact deleted:', { id: artifact.id });
    } catch (error) {
      console.error('[FileDetailPanel] Delete failed:', { id: artifact.id, error });
      toast.error('Failed to delete file');
    } finally {
      setDeleting(false);
    }
  }, [artifact, onDeleted, onConfirmDelete]);

  if (!artifact) return null;

  const fileIconNode = getFileIcon(artifact.mime_type, 'h-7 w-7');

  const tabs: { key: DetailTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'info', label: 'Info', icon: PiInfoBold },
    { key: 'tools', label: 'Tool outputs', icon: PiCodeBold },
    { key: 'processing', label: 'Processing', icon: PiGearBold },
  ];

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* ── Panel Header ────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-gray-200 p-4 dark:border-gray-700">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center">
              {fileIconNode}
            </div>
            <div className="flex-1 min-w-0">
              <Title
                as="h4"
                className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100"
                title={artifact.filename}
              >
                {artifact.filename}
              </Title>
              <Text className="text-xs text-gray-500">{formatSize(artifact.file_size)}</Text>
              {toolsStatus.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {toolsStatus.map((tool) => (
                    <Badge key={tool.tool_id} size="sm" variant="outline" color="secondary">
                      {tool.tool_id.split('.').pop() ?? tool.tool_id}
                      {tool.row_count > 0 ? ` (${tool.row_count})` : ''}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <PiXBold className="h-4 w-4" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="flex flex-1 gap-1.5"
            onClick={() => {
              void storageService
                .downloadArtifact(artifact.id, artifact.filename)
                .catch((error) => {
                  console.error('[FileDetailPanel] Download failed:', error);
                  toast.error('Download failed');
                });
            }}
          >
            <PiDownloadSimpleBold className="h-3.5 w-3.5" />
            Download
          </Button>
          {onPreview && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => onPreview(artifact)}
              title="Preview file"
            >
              <PiMagnifyingGlassPlusBold className="h-3.5 w-3.5" />
              Preview
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setShareOpen(true)}
            title="Create share link"
          >
            <PiShareNetworkBold className="h-3.5 w-3.5" />
            Share
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={reloadDetail}
            isLoading={loading}
            title="Refresh details"
          >
            <PiArrowsClockwiseBold className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
            onClick={handleDelete}
            isLoading={deleting}
          >
            <PiTrashBold className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex border-b border-muted">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors',
              activeTab === key
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader size="md" />
          </div>
        ) : detail ? (
          <>
            {loadError && (
              <Alert color="warning" className="mb-4">
                <Text className="text-sm font-medium">
                  جزئیات فایل به‌صورت کامل بارگذاری نشد. اطلاعات پایه هنوز نمایش داده می‌شود.
                </Text>
                <Text className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                  {loadError}
                </Text>
              </Alert>
            )}
            {activeTab === 'info' && <InfoTab artifact={detail} />}
            {activeTab === 'tools' && (
              <ToolOutputsTab
                artifactId={artifact.id}
                plugins={rawDetail?.plugins}
                detail={detail}
                processingStatus={artifact.processing_status}
                rawDetail={rawDetail}
              />
            )}
            {activeTab === 'processing' && (
              <ProcessingTab
                artifactId={artifact.id}
                plugins={rawDetail?.plugins}
                processingStatus={artifact.processing_status}
                detail={detail}
                onRefresh={reloadDetail}
              />
            )}
          </>
        ) : null}
      </div>

      {/* Share modal */}
      {shareOpen && (
        <ShareModal
          artifactId={artifact.id}
          filename={artifact.filename}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
