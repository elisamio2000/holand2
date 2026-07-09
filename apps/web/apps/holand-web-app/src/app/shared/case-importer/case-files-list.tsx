// ============================================
// CaseFilesList — File listing with tool results and status
// Shows all files in a case with expandable tool result details
// ============================================

'use client';

import { useState, useCallback, type MouseEvent } from 'react';
import { Text, Badge, Collapse, Button } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  PiFileTextDuotone,
  PiImageDuotone,
  PiFileDuotone,
  PiFileAudioDuotone,
  PiFileVideoDuotone,
  PiFileArchiveDuotone,
  PiFilePdfDuotone,
  PiCheckCircleBold,
  PiXCircleBold,
  PiClockBold,
  PiCaretDownBold,
  PiWrenchDuotone,
  PiWarningBold,
  PiEyeBold,
} from 'react-icons/pi';
import type { CaseFile, FileKind, ToolResult } from '@/types/case-importer.types';
import { getToolRenderer } from './tool-renderers';
import { useFilePreview } from '@/hooks/use-file-preview';
import { storageService } from '@/services/storage.service';

/**
 * Icon mapping for file kinds.
 */
const FILE_KIND_ICONS: Record<FileKind, React.ReactNode> = {
  text: <PiFileTextDuotone className="h-5 w-5 text-blue-500" />,
  image: <PiImageDuotone className="h-5 w-5 text-green-500" />,
  document: <PiFilePdfDuotone className="h-5 w-5 text-red-500" />,
  audio: <PiFileAudioDuotone className="h-5 w-5 text-purple-500" />,
  video: <PiFileVideoDuotone className="h-5 w-5 text-orange-500" />,
  archive: <PiFileArchiveDuotone className="h-5 w-5 text-yellow-600" />,
  binary: <PiFileDuotone className="h-5 w-5 text-gray-500" />,
  unknown: <PiFileDuotone className="h-5 w-5 text-gray-400" />,
};

/**
 * Format bytes to human-readable size.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * ToolResultItem — Display a single tool execution result.
 *
 * Shows tool status summary by default. When expanded, displays
 * the full result data using the appropriate plugin renderer.
 *
 * @param tool - The tool result data
 */
function ToolResultItem({ tool }: { tool: ToolResult }) {
  const [expanded, setExpanded] = useState(false);
  const ToolRenderer = getToolRenderer(tool.tool_id);
  const hasResult = tool.result && Object.keys(tool.result).length > 0;

  return (
    <div
      className={cn(
        'rounded border',
        tool.ok
          ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20'
          : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20'
      )}
    >
      {/* Summary row */}
      <div className="flex items-start gap-2 p-2 text-xs">
        {tool.ok ? (
          <PiCheckCircleBold className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-500" />
        ) : (
          <PiXCircleBold className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-500" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <Text className="font-mono font-medium text-gray-700 dark:text-gray-300">
              {tool.tool_id}
            </Text>
            <Text className="text-gray-400">{tool.elapsed_ms}ms</Text>
          </div>
          {tool.error && (
            <Text className="mt-1 text-red-600 dark:text-red-400">
              {tool.error}
            </Text>
          )}
        </div>
        {/* Show details button */}
        {tool.ok && hasResult && (
          <button
            onClick={() => setExpanded(!expanded)}
            className={cn(
              'flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium transition-colors',
              'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            )}
            title={expanded ? 'Hide details' : 'Show details'}
          >
            <PiEyeBold className="h-3 w-3" />
            {expanded ? 'Hide' : 'Details'}
          </button>
        )}
      </div>

      {/* Expanded result details */}
      {expanded && tool.ok && hasResult && (
        <div className="border-t border-green-200 bg-white p-3 dark:border-green-900 dark:bg-gray-50">
          {ToolRenderer ? (
            <ToolRenderer result={tool.result} />
          ) : (
            <div className="space-y-2">
              <Text className="text-xs font-semibold text-gray-500">
                Result Data (no custom renderer available)
              </Text>
              <pre className="max-h-60 overflow-auto rounded bg-gray-100 p-2 text-xs text-gray-700 dark:bg-gray-200">
                {JSON.stringify(tool.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function previewMimeForKind(file: CaseFile): string {
  if (file.media_type?.includes('/')) return file.media_type;
  if (file.kind === 'audio') return 'audio/*';
  if (file.kind === 'video') return 'video/*';
  return file.media_type || 'application/octet-stream';
}

/**
 * FileRow — A single expandable file entry.
 */
function FileRow({ file }: { file: CaseFile }) {
  const [expanded, setExpanded] = useState(false);
  const { openFilePreview } = useFilePreview();
  const icon = FILE_KIND_ICONS[file.kind] ?? FILE_KIND_ICONS.unknown;
  const canMediaPreview = file.kind === 'audio' || file.kind === 'video';

  const handleMediaPreview = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      openFilePreview({
        src: storageService.getDownloadUrl(file.artifact_id, 'inline'),
        name: file.relative_path,
        mimeType: previewMimeForKind(file),
        fileSize: file.size_bytes,
        artifactId: file.artifact_id,
      });
    },
    [file, openFilePreview]
  );

  const completedTools = file.tools.filter((t) => t.ok).length;
  const failedTools = file.tools.filter((t) => !t.ok).length;
  const pendingTools = file.planned_tools.length - file.tools.length;

  return (
    <div className="border-b border-muted last:border-b-0">
      {/* File header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-100/50"
      >
        {icon}
        <div className="min-w-0 flex-1">
          <Text className="truncate font-medium text-gray-900 dark:text-gray-700">
            {file.relative_path}
          </Text>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
            <span>{file.kind}</span>
            <span>·</span>
            <span>{formatBytes(file.size_bytes)}</span>
            {file.media_type && (
              <>
                <span>·</span>
                <span>{file.media_type}</span>
              </>
            )}
          </div>
        </div>

        {/* File status */}
        <div className="flex items-center gap-2">
          {canMediaPreview && (
            <button
              type="button"
              onClick={handleMediaPreview}
              className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-primary dark:hover:bg-gray-200/20"
              title="Preview media"
              aria-label={`Preview ${file.relative_path}`}
            >
              <PiEyeBold className="h-4 w-4" />
            </button>
          )}
          {file.status === 'done' && (
            <Badge variant="flat" color="success" size="sm">
              Done
            </Badge>
          )}
          {file.status === 'pending' && (
            <Badge variant="flat" color="warning" size="sm">
              Pending
            </Badge>
          )}
          {file.status !== 'done' && file.status !== 'pending' && (
            <Badge variant="flat" size="sm">
              {file.status}
            </Badge>
          )}

          {/* Tool results summary */}
          <div className="flex items-center gap-1 text-xs">
            {completedTools > 0 && (
              <span className="flex items-center gap-0.5 text-green-600">
                <PiCheckCircleBold className="h-3 w-3" />
                {completedTools}
              </span>
            )}
            {failedTools > 0 && (
              <span className="flex items-center gap-0.5 text-red-500">
                <PiXCircleBold className="h-3 w-3" />
                {failedTools}
              </span>
            )}
            {pendingTools > 0 && (
              <span className="flex items-center gap-0.5 text-gray-400">
                <PiClockBold className="h-3 w-3" />
                {pendingTools}
              </span>
            )}
          </div>

          <PiCaretDownBold
            className={cn(
              'h-4 w-4 text-gray-400 transition-transform',
              expanded && 'rotate-180'
            )}
          />
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-muted bg-gray-50 px-4 py-3 dark:bg-gray-100/30">
          {/* Planned tools */}
          {file.planned_tools.length > 0 && (
            <div className="mb-3">
              <Text className="mb-1.5 text-xs font-semibold text-gray-500">
                <PiWrenchDuotone className="me-1 inline h-3.5 w-3.5" />
                Planned Tools ({file.planned_tools.length})
              </Text>
              <div className="flex flex-wrap gap-1.5">
                {file.planned_tools.map((toolId) => (
                  <Badge key={toolId} variant="outline" size="sm" className="font-mono text-xs">
                    {toolId}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Tool results */}
          {file.tools.length > 0 && (
            <div className="mb-3">
              <Text className="mb-1.5 text-xs font-semibold text-gray-500">
                Tool Results ({file.tools.length})
              </Text>
              <div className="space-y-1.5">
                {file.tools.map((tool, idx) => (
                  <ToolResultItem key={`${tool.tool_id}-${idx}`} tool={tool} />
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {file.errors.length > 0 && (
            <div>
              <Text className="mb-1.5 text-xs font-semibold text-red-500">
                <PiWarningBold className="me-1 inline h-3.5 w-3.5" />
                Errors ({file.errors.length})
              </Text>
              <div className="space-y-1">
                {file.errors.map((err, idx) => (
                  <Text key={idx} className="text-xs text-red-600 dark:text-red-400">
                    {err}
                  </Text>
                ))}
              </div>
            </div>
          )}

          {file.tools.length === 0 && file.errors.length === 0 && (
            <Text className="text-xs text-gray-400">
              No results yet — processing pending.
            </Text>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * CaseFilesList — Displays all files in a case with expandable tool results.
 *
 * Features:
 * - File kind icons
 * - Size and media type display
 * - Processing status badge
 * - Expandable tool results per file
 * - Planned tools display
 * - Error listing
 *
 * @requires case-importer.types CaseFile
 *
 * @example
 * ```tsx
 * <CaseFilesList files={caseDetail.files} />
 * ```
 */
export default function CaseFilesList({
  files,
  className,
}: {
  /** Array of case files to display */
  files: CaseFile[];
  /** Additional CSS classes */
  className?: string;
}) {
  if (!files || files.length === 0) {
    return (
      <div className={cn('flex min-h-[100px] items-center justify-center rounded-lg border border-dashed border-muted p-6', className)}>
        <Text className="text-sm text-gray-400">
          No files in this case.
        </Text>
      </div>
    );
  }

  // Group files by kind for summary
  const kindCounts = files.reduce<Record<string, number>>((acc, f) => {
    acc[f.kind] = (acc[f.kind] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className={cn('rounded-lg border border-muted', className)}>
      {/* Summary header */}
      <div className="flex items-center justify-between border-b border-muted bg-gray-50 px-4 py-2.5 dark:bg-gray-100">
        <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Files ({files.length})
        </Text>
        <div className="flex items-center gap-2">
          {Object.entries(kindCounts).map(([kind, count]) => (
            <Badge key={kind} variant="outline" size="sm" className="text-xs">
              {kind}: {count}
            </Badge>
          ))}
        </div>
      </div>

      {/* File rows */}
      <div className="max-h-[600px] overflow-y-auto">
        {files.map((file) => (
          <FileRow key={file.artifact_id} file={file} />
        ))}
      </div>
    </div>
  );
}
