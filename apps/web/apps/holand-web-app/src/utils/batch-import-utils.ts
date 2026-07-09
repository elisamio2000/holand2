// ============================================
// Batch import helpers — split roots, paths, case names
// ============================================

import { toBackendToolAllowlist } from '@/utils/case-importer-tool-ids';

export type BatchSplitStrategy = 'none' | 'pattern' | 'depth' | 'manual';

export interface BatchFolderNode {
  name: string;
  path: string;
  children: BatchFolderNode[];
  files: number;
  selected: boolean;
  expanded: boolean;
  isFile: boolean;
  size?: number;
}

/** True when path looks like a server filesystem path (not a browser folder label). */
export function isServerSideBatchPath(path: string): boolean {
  const p = path.trim();
  return p.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(p);
}

/** Apply case name template for a batch root folder. */
export function applyCaseNameTemplate(
  template: string,
  folderPath: string,
  index: number
): string {
  const folderName = folderPath.split('/').pop() || folderPath;
  return template
    .replace(/\{folder_name\}/g, folderName)
    .replace(/\{index\}/g, String(index + 1));
}

/**
 * Collect staging/server-relative root paths from analyzed folder tree.
 */
export function collectBatchRoots(
  nodes: BatchFolderNode[],
  strategy: BatchSplitStrategy,
  fallbackTopFolder?: string
): string[] {
  if (strategy === 'none') {
    if (nodes.length > 0) {
      return nodes.filter((n) => !n.isFile).map((n) => n.path);
    }
    if (fallbackTopFolder?.trim()) {
      return [fallbackTopFolder.trim()];
    }
    return [];
  }

  if (strategy === 'manual') {
    const selected: string[] = [];
    const walk = (list: BatchFolderNode[]) => {
      for (const node of list) {
        if (node.isFile) continue;
        if (node.selected) selected.push(node.path);
        if (node.children.length > 0) walk(node.children);
      }
    };
    walk(nodes);
    return [...new Set(selected)];
  }

  return [...new Set(nodes.filter((n) => !n.isFile).map((n) => n.path))];
}

/**
 * Map webkit-relative batch roots to absolute server folder paths.
 * e.g. root `/data/cases/Pictures` + rel `Pictures/CaseA` → `/data/cases/Pictures/CaseA`
 */
export function resolveServerFolderPaths(serverRoot: string, relativeRoots: string[]): string[] {
  const normalizedRoot = serverRoot.replace(/\\/g, '/').replace(/\/$/, '');
  const rootBase = normalizedRoot.split('/').pop() || '';

  return relativeRoots.map((rel) => {
    const relNorm = rel.replace(/\\/g, '/');
    const parts = relNorm.split('/');

    if (rootBase && parts[0] === rootBase) {
      const suffix = parts.slice(1).join('/');
      return suffix ? `${normalizedRoot}/${suffix}` : normalizedRoot;
    }

    if (relNorm.startsWith('/')) return relNorm;
    return `${normalizedRoot}/${relNorm}`.replace(/\/+/g, '/');
  });
}

/** Staging-relative path for a file (preserves folder structure). */
export function getStagingRelativePath(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return rel?.replace(/\\/g, '/') || file.name;
}

/**
 * Resolve the staging/server folder root for a file using depth-based splitting.
 * Depth is measured from the uploaded tree root (parts[0]); never returns a file path.
 */
export function resolveBatchGroupKeyByDepth(
  relativePath: string,
  splitDepth: number
): string | null {
  const parts = relativePath.replace(/\\/g, '/').split('/');
  if (parts.length < 2) return null;

  const folderDepthEnd = Math.min(splitDepth + 1, parts.length - 1);
  if (folderDepthEnd < 1) return null;

  return parts.slice(0, folderDepthEnd).join('/');
}

/** Drop roots that exactly match a staged file path (backend rejects file paths as roots). */
export function filterFilePathsFromRoots(roots: string[], fileRelativePaths: string[]): string[] {
  const fileSet = new Set(fileRelativePaths.map((p) => p.replace(/\\/g, '/')));
  return roots.filter((root) => !fileSet.has(root.replace(/\\/g, '/')));
}

export interface StagingCompletionStatus {
  all_complete?: boolean;
  file_count?: number;
  total_files?: number;
  completed_files?: number;
  files?: Array<{ complete?: boolean }>;
}

/** Normalize backend staging status (`all_complete` / `file_count`) for upload checks. */
export function isStagingSessionComplete(status: StagingCompletionStatus): boolean {
  if (status.all_complete === true) return true;

  const files = status.files ?? [];
  if (files.length > 0) {
    return files.every((file) => file.complete === true);
  }

  const total = status.file_count ?? status.total_files;
  const completed = status.completed_files;
  if (typeof total === 'number' && typeof completed === 'number') {
    return completed >= total;
  }

  return false;
}

/**
 * Resolve tool_allowlist for import requests per backend contract:
 * - null → use saved user prefs / backend defaults (all selected in UI)
 * - [] → disable all tools
 * - string[] → explicit override for this import
 */
export function resolveToolAllowlistForImport(
  selectedUiIds: string[],
  catalogUiIds: string[]
): string[] | null {
  if (selectedUiIds.length === 0) return [];

  const catalogSet = new Set(catalogUiIds);
  const selectedInCatalog = selectedUiIds.filter((id) => catalogSet.has(id));

  if (
    catalogUiIds.length > 0 &&
    selectedInCatalog.length === catalogUiIds.length &&
    catalogUiIds.every((id) => selectedInCatalog.includes(id))
  ) {
    return null;
  }

  return toBackendToolAllowlist(selectedInCatalog) ?? [];
}
