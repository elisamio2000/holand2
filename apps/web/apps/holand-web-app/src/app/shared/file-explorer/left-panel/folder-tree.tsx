// ============================================
// FolderTree — Left Panel Navigation
// Builds a virtual folder tree from artifact folder_path fields.
// Supports expand/collapse, selection, and file count display.
// ============================================

'use client';

import { useState, useMemo } from 'react';
import { Text } from 'rizzui';
import { useTranslation } from 'react-i18next';
import {
  PiCaretRightBold,
  PiCaretDownBold,
  PiClockBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import FolderIcon from '@core/components/icons/folder-solid';
import DriveIcon from '@core/components/icons/drive-solid';
import type {
  FolderNode,
  Artifact,
  FileManagerFolderBucket,
} from '@/types/storage.types';

// ==========================================
// Types
// ==========================================

interface FolderTreeProps {
  /** All artifacts (current page) — used as a fallback to build the tree
   *  client-side when the server folders endpoint is unavailable. */
  artifacts: Artifact[];
  /**
   * Top-level folder buckets fetched from `plugin.file_manager.folders`.
   * When provided, takes precedence over `artifacts` so folders that aren't
   * on the current page are still visible.
   */
  serverFolders?: FileManagerFolderBucket[];
  /** Currently selected folder path ('' = root) */
  selectedPath: string;
  /** Called when user selects a folder */
  onSelectPath: (path: string) => void;
  /** @deprecated Upload is now in the main toolbar. Kept for backward compat. */
  onUpload?: () => void;
  /** Whether to show the Starred section */
  starredCount?: number;
  /** Full library count from parent pagination metadata. */
  libraryTotal?: number;
  className?: string;
}

// ==========================================
// Tree Builder
// ==========================================

/**
 * Build a virtual FolderNode tree from a flat list of artifacts.
 * Uses artifact.folder_path to derive hierarchy.
 *
 * Example: folder_path="Documents/Reports" → root > Documents > Reports
 *
 * @param artifacts - Flat artifact list from API
 * @returns Root-level FolderNode array
 */
function buildFolderTree(artifacts: Artifact[]): FolderNode[] {
  const nodeByPath = new Map<string, FolderNode>();
  const roots: FolderNode[] = [];

  for (const artifact of artifacts) {
    const path = artifact.folder_path?.trim() || '';
    if (!path) continue;
    const parts = path.split('/').filter(Boolean);
    let parentPath = '';

    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      const currentPath = parentPath ? `${parentPath}/${part}` : part;
      let node = nodeByPath.get(currentPath);
      if (!node) {
        node = { name: part, path: currentPath, children: [], fileCount: 0, fileCountRecursive: 0 };
        nodeByPath.set(currentPath, node);
        if (!parentPath) roots.push(node);
        else nodeByPath.get(parentPath)?.children.push(node);
      }
      if (i === parts.length - 1) node.fileCount += 1;
      parentPath = currentPath;
    }
  }

  const accumulate = (node: FolderNode): number => {
    const childTotal = node.children.reduce((sum, child) => sum + accumulate(child), 0);
    node.fileCountRecursive = node.fileCount + childTotal;
    return node.fileCountRecursive;
  };
  roots.forEach((node) => accumulate(node));
  return roots;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim();
}

function buildTreeFromCounts(allFolderCounts: Record<string, number>): FolderNode[] {
  const nodeByPath = new Map<string, FolderNode>();
  const roots: FolderNode[] = [];
  for (const [rawPath, count] of Object.entries(allFolderCounts)) {
    const cleanPath = normalizePath(rawPath);
    if (!cleanPath) continue;
    const parts = cleanPath.split('/').filter(Boolean);
    let parentPath = '';
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      const currentPath = parentPath ? `${parentPath}/${part}` : part;
      let node = nodeByPath.get(currentPath);
      if (!node) {
        node = {
          name: part,
          path: currentPath,
          children: [],
          fileCount: 0,
          fileCountRecursive: 0,
        };
        nodeByPath.set(currentPath, node);
        if (!parentPath) roots.push(node);
        else nodeByPath.get(parentPath)?.children.push(node);
      }
      if (i === parts.length - 1) {
        node.fileCount += count;
      }
      parentPath = currentPath;
    }
  }

  const accumulate = (node: FolderNode): number => {
    const childTotal = node.children.reduce((sum, child) => sum + accumulate(child), 0);
    node.fileCountRecursive = node.fileCount + childTotal;
    return node.fileCountRecursive;
  };
  roots.forEach((node) => accumulate(node));
  return roots;
}

// ==========================================
// TreeNode — Recursive folder item
// ==========================================

interface TreeNodeProps {
  node: FolderNode;
  level: number;
  selectedPath: string;
  onSelect: (path: string) => void;
}

function TreeNode({ node, level, selectedPath, onSelect }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedPath === node.path;

  const handleClick = () => {
    onSelect(node.path);
    if (hasChildren) setExpanded((prev) => !prev);
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
          isSelected
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-100/10'
        )}
        style={{ paddingLeft: `${(level + 1) * 12}px` }}
      >
        {/* Caret */}
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {hasChildren ? (
            expanded ? (
              <PiCaretDownBold className="h-3 w-3 text-gray-400" />
            ) : (
              <PiCaretRightBold className="h-3 w-3 text-gray-400" />
            )
          ) : (
            <span className="h-3 w-3" />
          )}
        </span>

        {/* Folder icon */}
        <FolderIcon className="h-4 w-4 shrink-0" />

        {/* Name */}
        <span className="flex-1 truncate">{node.name}</span>

        {/* File count badge */}
        {(node.fileCountRecursive ?? node.fileCount) > 0 && (
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
            {node.fileCountRecursive ?? node.fileCount}
          </span>
        )}
      </button>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              level={level + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// FolderTree — Main Component
// ==========================================

/**
 * FolderTree — Left panel navigation for File Explorer.
 *
 * Builds a virtual folder tree from artifact.folder_path fields (client-side).
 * Provides shortcuts: All Files, Starred, Recent.
 * Highlights selected path and shows file counts per folder.
 *
 * @example
 * ```tsx
 * <FolderTree
 *   artifacts={artifacts}
 *   selectedPath={currentPath}
 *   onSelectPath={setCurrentPath}
 *   onUpload={() => setUploadOpen(true)}
 * />
 * ```
 */
/**
 * Convert backend folder buckets (e.g. `[{prefix:"chat/abc/", file_count_recursive:42}]`)
 * into FolderNode entries. Strips trailing delimiters and uses the bucket
 * count as `fileCount`. Children are not pre-fetched — clicking the folder
 * navigates into it and a future expansion can lazy-load via another call.
 */
function bucketsToNodes(buckets: FileManagerFolderBucket[]): FolderNode[] {
  const nodeByPath = new Map<string, FolderNode>();
  const roots: FolderNode[] = [];

  for (const bucket of buckets) {
    const cleanPath = (bucket.prefix || '').replace(/\/+$/, '');
    if (!cleanPath) continue;
    const segments = cleanPath.split('/').filter(Boolean);
    let parentPath = '';

    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i];
      const currentPath = parentPath ? `${parentPath}/${segment}` : segment;
      let node = nodeByPath.get(currentPath);

      if (!node) {
        node = {
          name: segment,
          path: currentPath,
          children: [],
          fileCount: 0,
          fileCountRecursive: 0,
        };
        nodeByPath.set(currentPath, node);
        if (!parentPath) {
          roots.push(node);
        } else {
          const parentNode = nodeByPath.get(parentPath);
          if (parentNode) parentNode.children.push(node);
        }
      }

      if (i === segments.length - 1) {
        node.fileCount = 0;
        node.fileCountRecursive = bucket.file_count_recursive ?? 0;
      }

      parentPath = currentPath;
    }
  }

  const accumulate = (node: FolderNode): number => {
    const childTotal = node.children.reduce((sum, child) => sum + accumulate(child), 0);
    if (!node.fileCountRecursive || node.fileCountRecursive === 0) {
      node.fileCountRecursive = node.fileCount + childTotal;
    }
    return node.fileCountRecursive;
  };
  roots.forEach((node) => accumulate(node));
  return roots;
}

export default function FolderTree({
  artifacts,
  serverFolders,
  selectedPath,
  onSelectPath,
  onUpload,
  starredCount = 0,
  libraryTotal,
  className,
}: FolderTreeProps) {
  const { t } = useTranslation();
  // Prefer server-side folder list when present; fall back to client tree
  // built from the in-memory artifact set.
  const tree = useMemo(() => {
    if (serverFolders && serverFolders.length > 0) {
      return bucketsToNodes(serverFolders);
    }
    return buildFolderTree(artifacts);
  }, [artifacts, serverFolders]);

  // Shortcut items — Recent uses server sort; Starred hidden until backend supports it.
  const shortcuts = [
    {
      key: '',
      label: t('fileExplorer.ownership.any'),
      icon: DriveIcon,
      count: libraryTotal ?? artifacts.length,
    },
    {
      key: '__recent__',
      label: t('fileExplorer.recent'),
      icon: PiClockBold,
      count: null,
    },
  ];

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
        {/* Shortcuts */}
        <div className="mb-3">
          {shortcuts.map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => onSelectPath(key)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                selectedPath === key
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-100/10'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {count !== null && (
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Folder Divider */}
        {tree.length > 0 && (
          <>
            <div className="mb-2 flex items-center justify-between gap-2 px-3">
              <Text className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {t('fileExplorer.folders')}
              </Text>
              <button
                type="button"
                className="text-[10px] font-medium text-primary hover:underline"
                onClick={() => {
                  const name = window.prompt(t('fileExplorer.createFolderPrompt'));
                  if (!name?.trim()) return;
                  const base = selectedPath && !selectedPath.startsWith('__') ? selectedPath : '';
                  const next = base ? `${base}/${name.trim()}` : name.trim();
                  onSelectPath(next);
                }}
                title={t('fileExplorer.createFolderHint')}
              >
                + {t('fileExplorer.createFolder')}
              </button>
            </div>

            {/* Folder Tree */}
            <div>
              {tree.map((node) => (
                <TreeNode
                  key={node.path}
                  node={node}
                  level={0}
                  selectedPath={selectedPath}
                  onSelect={onSelectPath}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
