// ============================================
// ImportForm — Case import form with file upload + mode selection
// Supports file upload from browser or manual server path entry
// ============================================

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Checkbox, Input, Text, Title, Loader, Progressbar } from 'rizzui';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  PiFolderOpenDuotone,
  PiFolderDuotone,
  PiTagDuotone,
  PiRocketLaunchDuotone,
  PiLightningDuotone,
  PiMagnifyingGlassDuotone,
  PiInfoBold,
  PiWarningDuotone,
  PiUploadSimpleBold,
  PiFilesDuotone,
  PiTrashBold,
  PiCloudArrowUpDuotone,
  PiTerminalWindowDuotone,
  PiXBold,
  PiCheckCircleDuotone,
  PiCaretDownBold,
  PiCaretRightBold,
  PiCheckSquareBold,
  PiSquareBold,
  PiMinusBold,
  PiStackBold,
  PiTreeStructureBold,
  PiListNumbersBold,
  PiTextTBold,
  PiGearBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import { caseImporterService } from '@/services/case-importer.service';
import type { ImportMode, UploadFilesResponse, PluginId } from '@/types/case-importer.types';
import {
  applyCaseNameTemplate,
  collectBatchRoots,
  filterFilePathsFromRoots,
  getStagingRelativePath,
  isServerSideBatchPath,
  isStagingSessionComplete,
  resolveBatchGroupKeyByDepth,
  resolveServerFolderPaths,
  resolveToolAllowlistForImport,
} from '@/utils/batch-import-utils';
import Link from 'next/link';
import { useStagingUploadWebSocket } from '@/hooks/use-staging-upload-websocket';

// ==========================================
// Types & Constants
// ==========================================

/** How the user provides the source files */
type SourceMode = 'upload' | 'path' | 'batch';

/** Batch import split strategy */
type SplitStrategy = 'none' | 'pattern' | 'depth' | 'manual';

/** Tree node for tree view (can be folder or file) */
interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
  files: number; // For folders: count of direct files; for files: 0
  selected: boolean;
  expanded: boolean;
  isFile: boolean; // true if this is a file, false if folder
  size?: number; // File size in bytes (only for files)
}

/**
 * System files to exclude when selecting a folder.
 * These are OS-generated files that have no value for import.
 */
const IGNORED_FILES = new Set([
  '.DS_Store', 'Thumbs.db', 'desktop.ini', '.gitkeep',
  'thumbs.db', '.directory', '__MACOSX',
]);

/**
 * Extract a human-readable error message from any error.
 * Handles AxiosError shapes with response.data.detail or response.data.message.
 *
 * @param err - The caught error (unknown type)
 * @returns A user-friendly error message string
 */
function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const axiosErr = err as {
      response?: {
        data?: {
          detail?: string | Array<{ msg: string; loc: string[] }>;
          message?: string;
          error?: string;
        };
        status?: number;
      };
    };

    const data = axiosErr.response?.data;
    if (data) {
      // FastAPI validation error (422) — array of { msg, loc }
      if (Array.isArray(data.detail)) {
        return data.detail
          .map((d) => `${d.loc?.join('.')}: ${d.msg}`)
          .join('; ');
      }
      if (typeof data.detail === 'string') return data.detail;
      if (typeof data.message === 'string') return data.message;
      if (typeof data.error === 'string') return data.error;
    }

    if (axiosErr.response?.status) {
      return `Server error (HTTP ${axiosErr.response.status})`;
    }
  }

  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred';
}

/**
 * Format file size in human-readable format.
 *
 * @param bytes - File size in bytes
 * @returns Formatted string like "1.2 MB"
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Convert user-friendly pattern to RegExp for folder matching.
 *
 * Pattern Syntax:
 * - `#` = one digit (0-9)
 * - `@` = one letter (a-zA-Z)
 * - `?` = any single character
 * - `*` = zero or more of any character
 * - All other characters = literal match
 *
 * @param pattern - User pattern like "#######-####/##/##-*"
 * @returns RegExp for matching folder names
 * @throws {Error} If pattern contains invalid syntax
 *
 * @example
 * ```typescript
 * patternToRegex("IMG_####.jpg") // → /^IMG_[0-9]{4}\.jpg$/
 * patternToRegex("#######-2005/##/##-*") // → /^[0-9]{7}-2005\/[0-9]{2}\/[0-9]{2}-.*$/
 * patternToRegex("@@@-####") // → /^[a-zA-Z]{3}-[0-9]{4}$/
 * ```
 */
function patternToRegex(pattern: string): RegExp {
  if (!pattern.trim()) {
    throw new Error('Pattern cannot be empty');
  }

  let regex = '^';
  let i = 0;
  
  while (i < pattern.length) {
    const char = pattern[i];
    
    if (char === '#') {
      // Count consecutive # symbols
      let count = 0;
      while (i < pattern.length && pattern[i] === '#') {
        count++;
        i++;
      }
      regex += `[0-9]{${count}}`;
    } else if (char === '@') {
      // Count consecutive @ symbols
      let count = 0;
      while (i < pattern.length && pattern[i] === '@') {
        count++;
        i++;
      }
      regex += `[a-zA-Z]{${count}}`;
    } else if (char === '*') {
      regex += '.*';
      i++;
    } else if (char === '?') {
      regex += '.';
      i++;
    } else {
      // Escape special regex characters
      const specialChars = /[.+^${}()|[\]\\]/g;
      if (specialChars.test(char)) {
        regex += '\\' + char;
      } else {
        regex += char;
      }
      i++;
    }
  }
  
  regex += '$';
  
  try {
    return new RegExp(regex);
  } catch (err) {
    throw new Error(`Invalid pattern: ${pattern}`);
  }
}

/**
 * Validate pattern syntax and return error message if invalid.
 *
 * @param pattern - User pattern to validate
 * @returns Error message or null if valid
 */
function validatePattern(pattern: string): string | null {
  if (!pattern.trim()) {
    return 'Pattern cannot be empty';
  }
  
  try {
    patternToRegex(pattern);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid pattern';
  }
}

/**
 * Visual metadata for import modes. Labels/descriptions come from i18n.
 */
const MODE_META: Record<
  ImportMode,
  {
    icon: React.ReactNode;
    color: string;
  }
> = {
  async: {
    icon: <PiRocketLaunchDuotone className="h-6 w-6" />,
    color: 'border-primary bg-primary-lighter/30',
  },
  sync: {
    icon: <PiLightningDuotone className="h-6 w-6" />,
    color:
      'border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30',
  },
  review: {
    icon: <PiMagnifyingGlassDuotone className="h-6 w-6" />,
    color:
      'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30',
  },
};

// ==========================================
// TreeNodeView Component — Recursive tree node
// ==========================================

interface TreeNodeViewProps {
  node: FolderNode;
  level: number;
  onToggleExpand: (path: string) => void;
  onToggleSelection: (path: string, recursive: boolean) => void;
  caseNameTemplate: string;
}

/**
 * Recursive component to display folder tree node with expand/collapse and checkbox.
 */
function TreeNodeView({ node, level, onToggleExpand, onToggleSelection, caseNameTemplate }: TreeNodeViewProps) {
  const hasChildren = node.children.length > 0 && !node.isFile;

  return (
    <div>
      {/* Current node */}
      <div
        className={cn(
          'flex items-center gap-2 rounded px-2 py-1.5 transition-colors',
          node.selected ? 'bg-blue-50 dark:bg-blue-950/10' : 'hover:bg-gray-50 dark:hover:bg-gray-100'
        )}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        {/* Expand/collapse button (only for folders with children) */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggleExpand(node.path)}
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-300"
          >
            {node.expanded ? (
              <PiCaretDownBold className="h-3 w-3 text-gray-600" />
            ) : (
              <PiCaretRightBold className="h-3 w-3 text-gray-600" />
            )}
          </button>
        ) : (
          <div className="h-5 w-5 flex-shrink-0" />
        )}

        {/* Checkbox */}
        <Checkbox
          checked={node.selected}
          onChange={() => {
            onToggleSelection(node.path, false);
          }}
          className="flex-shrink-0"
        />

        {/* Icon (folder or file) */}
        {node.isFile ? (
          <PiFilesDuotone
            className={cn(
              'h-4 w-4 flex-shrink-0',
              node.selected ? 'text-green-500' : 'text-gray-400'
            )}
          />
        ) : (
          <PiFolderDuotone
            className={cn(
              'h-4 w-4 flex-shrink-0',
              node.selected ? 'text-blue-500' : 'text-gray-400'
            )}
          />
        )}

        {/* Name */}
        <Text className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">
          {node.name}
        </Text>

        {/* Info badge */}
        {node.isFile && node.size !== undefined ? (
          <Badge variant="flat" color="secondary" size="sm" className="flex-shrink-0">
            {(node.size / 1024).toFixed(1)} KB
          </Badge>
        ) : node.files > 0 ? (
          <Badge variant="flat" color="info" size="sm" className="flex-shrink-0">
            {node.files} files
          </Badge>
        ) : null}
      </div>

      {/* Children (recursive) */}
      {hasChildren && node.expanded && (
        <div>
          {node.children.map((child) => (
            <TreeNodeView
              key={child.path}
              node={child}
              level={level + 1}
              onToggleExpand={onToggleExpand}
              onToggleSelection={onToggleSelection}
              caseNameTemplate={caseNameTemplate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// Component
// ==========================================

/**
 * ImportForm — Form for importing files into the Case Importer.
 *
 * Provides two source modes:
 * 1. **Upload** (default) — drag & drop or click to browse files from local computer,
 *    files are uploaded to the server, then import starts automatically.
 * 2. **Server Path** — enter a path to a folder already on the backend server.
 *
 * And three processing modes:
 * 1. **Async** (default) — queues full pipeline in background
 * 2. **Sync** — runs full pipeline and waits for completion
 * 3. **Review** — runs Phase 1 only, user manually triggers Phase 2 & 3
 *
 * @requires caseImporterService — for API calls (upload + import)
 * @requires routes — for navigation after import
 *
 * @param className - Optional CSS classes
 * @param initialSourceMode - Initial import source mode from route
 *
 * @example
 * ```tsx
 * <ImportForm initialSourceMode="upload" />
 * ```
 */
export default function ImportForm({ 
  className, 
  initialSourceMode = 'upload' 
}: { 
  className?: string; 
  initialSourceMode?: SourceMode;
}) {
  const { t } = useTranslation();
  const router = useRouter();

  //Source mode: upload files from browser vs enter server path
  const [sourceMode, setSourceMode] = useState<SourceMode>(initialSourceMode);

  // Form state
  const [folderPath, setFolderPath] = useState('');
  const [caseName, setCaseName] = useState('');
  const [mode, setMode] = useState<ImportMode>('async');

  // File upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stagingSessionId, setStagingSessionId] = useState<string | null>(null);
  const [activeUploadSessionId, setActiveUploadSessionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const batchFolderInputRef = useRef<HTMLInputElement>(null);
  
  // Collapsible groups state — track which folder groups are collapsed
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  
  // Multi-select state — track selected file indices for batch operations
  const [selectedFileIndices, setSelectedFileIndices] = useState<Set<number>>(new Set());
  
  // Search state — filter files by name, path, or folder
  const [searchQuery, setSearchQuery] = useState('');

  // Batch import state
  const [batchRootPath, setBatchRootPath] = useState('');
  const [batchFiles, setBatchFiles] = useState<File[]>([]); // Store selected files for analysis
  const [splitStrategy, setSplitStrategy] = useState<SplitStrategy>('pattern');
  const [splitPattern, setSplitPattern] = useState('ID*');
  const [splitDepth, setSplitDepth] = useState(1);
  const [showPatternGuide, setShowPatternGuide] = useState(false);
  const [patternPreview, setPatternPreview] = useState<{ matched: string[]; total: number } | null>(null);
  const [caseNameTemplate, setCaseNameTemplate] = useState('{folder_name}');
  const [folderTree, setFolderTree] = useState<FolderNode[]>([]);
  const [analyzingFolder, setAnalyzingFolder] = useState(false);

  // Plugin selection state — loaded from backend user preferences (Settings page)
  const [selectedPlugins, setSelectedPlugins] = useState<PluginId[]>(
    // Default until backend preferences are loaded
    ['file.identify', 'file.meta', 'image.meta', 'text.search']
  );
  const [catalogToolIds, setCatalogToolIds] = useState<string[]>([]);

  useStagingUploadWebSocket(activeUploadSessionId, {
    enabled: uploading && activeUploadSessionId !== null,
    onProgress: (update) => {
      if (update.overall > 0) {
        setUploadProgress(Math.min(100, Math.round(update.overall * 100)));
      }
    },
  });

  // Load user's saved tool_allowlist from backend preferences on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        console.info('[ImportForm] Loading tools and preferences for tool_allowlist...');
        const [toolsData, prefs] = await Promise.all([
          caseImporterService.getImportTools(),
          caseImporterService.getUserPreferences(),
        ]);
        if (cancelled) return;

        const allToolIds = (Array.isArray(toolsData.tools) ? toolsData.tools : []).map(
          (t) => t.tool_id
        );
        setCatalogToolIds(allToolIds);

        if (prefs.tool_allowlist === null) {
          setSelectedPlugins(allToolIds as PluginId[]);
          console.info('[ImportForm] tool_allowlist null — using all catalog tools:', {
            count: allToolIds.length,
          });
        } else if (prefs.tool_allowlist.length === 0) {
          setSelectedPlugins([]);
          console.info('[ImportForm] tool_allowlist empty — no tools selected');
        } else {
          setSelectedPlugins(prefs.tool_allowlist as PluginId[]);
          console.info('[ImportForm] tool_allowlist loaded from backend preferences:', {
            count: prefs.tool_allowlist.length,
            plugins: prefs.tool_allowlist,
          });
        }
      } catch (err) {
        console.warn('[ImportForm] Failed to load user preferences, using defaults:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ⚠️ Set webkitdirectory attribute via ref because it's non-standard
  // and TypeScript's InputHTMLAttributes doesn't include it
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '');
      folderInputRef.current.setAttribute('directory', '');
    }
    if (batchFolderInputRef.current) {
      batchFolderInputRef.current.setAttribute('webkitdirectory', '');
      batchFolderInputRef.current.setAttribute('directory', '');
    }
  }, []);

  // Sync URL with sourceMode changes
  useEffect(() => {
    const currentPath = window.location.pathname;
    // Map internal sourceMode to URL format ('path' → 'server-path')
    const urlMode = sourceMode === 'path' ? 'server-path' : sourceMode;
    const expectedPath = routes.caseImporter.import(urlMode);
    
    // Only navigate if path is different (avoid infinite loop)
    if (currentPath !== expectedPath) {
      console.info('[ImportForm] Syncing URL with sourceMode:', { 
        sourceMode, 
        urlMode,
        from: currentPath, 
        to: expectedPath 
      });
      router.push(expectedPath);
    }
  }, [sourceMode, router]);

  // Submit state
  const [submitting, setSubmitting] = useState(false);

  // ==========================================
  // Validation
  // ==========================================

  /** Validate form before submission */
  const batchRoots = useMemo(
    () => collectBatchRoots(folderTree, splitStrategy, batchRootPath),
    [folderTree, splitStrategy, batchRootPath]
  );

  const isValid = useMemo(() => {
    if (sourceMode === 'upload') {
      return (
        caseName.trim().length > 0 &&
        (selectedFiles.length > 0 || stagingSessionId !== null)
      );
    }
    if (sourceMode === 'path') {
      return caseName.trim().length > 0 && folderPath.trim().length > 0;
    }
    if (!batchRootPath.trim()) return false;
    if (splitStrategy === 'pattern' && splitPattern.trim() && validatePattern(splitPattern)) {
      return false;
    }
    if (splitStrategy === 'none') return true;
    return batchRoots.length > 0;
  }, [
    sourceMode,
    caseName,
    selectedFiles,
    stagingSessionId,
    folderPath,
    batchRootPath,
    splitStrategy,
    splitPattern,
    batchRoots,
  ]);

  // ==========================================
  // File Selection Handlers
  // ==========================================

  /** Handle files selected via the file input dialog */
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) {
        console.info('[ImportForm] Files selected via browser:', {
          count: files.length,
          names: files.map((f) => f.name),
        });
        setSelectedFiles((prev) => [...prev, ...files]);
        // Reset uploaded state since new files were added
        setStagingSessionId(null);
      }
      // Reset input so the same file can be re-selected
      e.target.value = '';
    },
    []
  );

  /**
   * Handle folder selected via the folder input dialog.
   * Filters out zero-byte and system files (.DS_Store, Thumbs.db, etc.).
   * Files retain their webkitRelativePath for display.
   */
  const handleFolderSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawFiles = Array.from(e.target.files ?? []);
      // Filter out system/hidden files and zero-byte files
      const files = rawFiles.filter((f) => {
        if (f.size === 0) return false;
        const name = f.name;
        if (IGNORED_FILES.has(name)) return false;
        // Skip hidden files (starting with .)
        if (name.startsWith('.')) return false;
        // Skip files inside __MACOSX folders
        if ((f as File & { webkitRelativePath?: string }).webkitRelativePath?.includes('__MACOSX/')) return false;
        return true;
      });

      if (files.length > 0) {
        // Extract top-level folder name from the first file's relative path
        const firstPath = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath ?? '';
        const topFolder = firstPath.split('/')[0] ?? 'folder';
        console.info('[ImportForm] Folder selected:', {
          folder: topFolder,
          totalFiles: rawFiles.length,
          afterFilter: files.length,
          filtered: rawFiles.length - files.length,
        });
        setSelectedFiles((prev) => [...prev, ...files]);
        setStagingSessionId(null);
      }
      // Reset input so the same folder can be re-selected
      e.target.value = '';
    },
    []
  );

  /** Open the native file browser dialog */
  const openFileBrowser = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /** Open the native folder browser dialog (uses webkitdirectory) */
  const openFolderBrowser = useCallback(() => {
    folderInputRef.current?.click();
  }, []);

  /** Open the batch folder browser dialog */
  const openBatchFolderBrowser = useCallback(() => {
    batchFolderInputRef.current?.click();
  }, []);

  /**
   * Analyze folder structure from selected files.
   * Groups files by folder and builds preview.
   */
  const analyzeFolderStructure = useCallback(
    (files: File[]) => {
      console.info('[BatchImport] Analyzing folder structure...', { fileCount: files.length });
      
      if (splitStrategy === 'manual') {
        // Build complete folder tree with files for manual selection
        const folderMap: Record<string, FolderNode> = {};
        const filesByFolder: Record<string, File[]> = {};
        
        // First pass: collect all folders and group files by parent folder
        for (const file of files) {
          const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
          if (!relativePath) continue;
          
          const parts = relativePath.split('/');
          if (parts.length < 2) continue;
          
          // Build all folder nodes in the path (skip root folder at index 0)
          for (let i = 1; i < parts.length - 1; i++) {
            const folderPath = parts.slice(0, i + 1).join('/');
            
            if (!folderMap[folderPath]) {
              folderMap[folderPath] = {
                name: parts[i],
                path: folderPath,
                children: [],
                files: 0,
                selected: false,
                expanded: i === 1, // Auto-expand first level
                isFile: false,
                size: undefined,
              };
            }
          }
          
          // Group files by their parent folder
          const parentFolderPath = parts.slice(0, -1).join('/');
          if (!filesByFolder[parentFolderPath]) {
            filesByFolder[parentFolderPath] = [];
          }
          filesByFolder[parentFolderPath].push(file);
        }
        
        // Second pass: add file nodes as children to their parent folders
        for (const [folderPath, filesInFolder] of Object.entries(filesByFolder)) {
          const parentNode = folderMap[folderPath];
          if (parentNode) {
            parentNode.files = filesInFolder.length;
            
            // Create file nodes
            for (const file of filesInFolder) {
              const fileName = file.name;
              const filePath = `${folderPath}/${fileName}`;
              
              const fileNode: FolderNode = {
                name: fileName,
                path: filePath,
                children: [],
                files: 0,
                selected: false,
                expanded: false,
                isFile: true,
                size: file.size,
              };
              
              parentNode.children.push(fileNode);
            }
          }
        }
        
        // Third pass: build hierarchical structure
        const allFolderPaths = Object.keys(folderMap).sort();
        const topLevel: FolderNode[] = [];
        
        for (const folderPath of allFolderPaths) {
          const node = folderMap[folderPath];
          const parts = folderPath.split('/');
          
          if (parts.length === 2) {
            // Top-level folder
            topLevel.push(node);
          } else {
            // Nested folder - add to parent's children
            const parentPath = parts.slice(0, -1).join('/');
            const parent = folderMap[parentPath];
            if (parent && !parent.children.find(c => c.path === folderPath)) {
              parent.children.push(node);
            }
          }
        }
        
        // Sort children (folders first, then files)
        const sortChildren = (nodes: FolderNode[]): FolderNode[] => {
          return nodes.sort((a, b) => {
            if (a.isFile === b.isFile) return a.name.localeCompare(b.name);
            return a.isFile ? 1 : -1; // Folders first
          });
        };
        
        const sortAllChildren = (nodes: FolderNode[]) => {
          for (const node of nodes) {
            if (node.children.length > 0) {
              node.children = sortChildren(node.children);
              sortAllChildren(node.children);
            }
          }
        };
        
        sortAllChildren(topLevel);
        setFolderTree(sortChildren(topLevel));
        
        const totalFiles = Object.values(filesByFolder).flat().length;
        console.info('[BatchImport] Tree built:', {
          totalFolders: allFolderPaths.length,
          totalFiles,
          topLevelFolders: topLevel.length,
        });
        
        toast.success(
          t('caseImporter.import.batch.toastFoundFoldersAndFiles', {
            defaultValue: 'Found {{folders}} folders and {{files}} files',
            folders: topLevel.length,
            files: totalFiles,
          })
        );
      } else {
        // Pattern/Depth/None - flat list
        const folderGroups: Record<string, File[]> = {};
        
        for (const file of files) {
          const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
          if (!relativePath) continue;

          const parts = relativePath.split('/');
          if (parts.length < 2) continue;

          let groupKey = '';

          if (splitStrategy === 'pattern') {
            // Use advanced pattern matching
            if (!splitPattern.trim()) {
              console.warn('[BatchImport] Pattern is empty, skipping pattern matching');
              continue;
            }
            
            try {
              const regex = patternToRegex(splitPattern);
              
              for (let i = 1; i < parts.length - 1; i++) {
                if (regex.test(parts[i])) {
                  groupKey = parts.slice(0, i + 1).join('/');
                  break;
                }
              }
              
              if (!groupKey) continue;
            } catch (err) {
              console.error('[BatchImport] Invalid pattern:', { pattern: splitPattern, error: err });
              continue;
            }
          } else if (splitStrategy === 'depth') {
            groupKey = resolveBatchGroupKeyByDepth(relativePath, splitDepth) ?? '';
          } else if (splitStrategy === 'none') {
            groupKey = parts[0];
          }

          if (groupKey) {
            if (!folderGroups[groupKey]) folderGroups[groupKey] = [];
            folderGroups[groupKey].push(file);
          }
        }

        const nodes: FolderNode[] = Object.keys(folderGroups)
          .sort()
          .map((path) => ({
            name: path.split('/').pop() || path,
            path,
            children: [],
            files: folderGroups[path].length,
            selected: true,
            expanded: false,
            isFile: false,
            size: undefined,
          }));

        setFolderTree(nodes);
        
        console.info('[BatchImport] Analysis complete:', {
          matchedFolders: nodes.length,
          totalFiles: files.reduce((sum) => sum + 1, 0),
          strategy: splitStrategy,
        });

        if (nodes.length === 0) {
          if (splitStrategy === 'pattern') {
            toast.error(
              t('caseImporter.import.batch.toastNoFoldersMatchedPattern', {
                defaultValue: 'No folders matched pattern: {{pattern}}',
                pattern: splitPattern,
              })
            );
          } else {
            toast.error(t('caseImporter.import.batch.toastNoFoldersFound', 'No folders found to import'));
          }
        } else {
          toast.success(
            t('caseImporter.import.batch.toastFoundMatchingFolders', {
              defaultValue: 'Found {{count}} folder(s) matching criteria',
              count: nodes.length,
            })
          );
        }
      }
    },
    [splitStrategy, splitPattern, splitDepth]
  );

  /**
   * Handle folder selected for batch import.
   * Extracts the root path and analyzes folder structure.
   */
  const handleBatchFolderSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawFiles = Array.from(e.target.files ?? []);
      
      if (rawFiles.length === 0) return;

      // Store files for later analysis
      setBatchFiles(rawFiles);

      // Extract root path from first file's webkitRelativePath
      const firstFile = rawFiles[0] as File & { webkitRelativePath?: string };
      const relativePath = firstFile.webkitRelativePath;
      
      if (relativePath) {
        // Get the top-level folder name
        const topFolder = relativePath.split('/')[0];
        setBatchRootPath(topFolder);
        
        console.info('[BatchImport] Folder selected:', {
          topFolder,
          totalFiles: rawFiles.length,
          samplePath: relativePath,
        });

        // Auto-analyze the folder structure
        analyzeFolderStructure(rawFiles);
      }

      // Reset input
      e.target.value = '';
    },
    [analyzeFolderStructure]
  );

  /**
   * Toggle expand/collapse for a node in the tree
   */
  const toggleNodeExpand = useCallback((targetPath: string) => {
    const toggleInTree = (nodes: FolderNode[]): FolderNode[] => {
      return nodes.map(node => {
        if (node.path === targetPath) {
          return { ...node, expanded: !node.expanded };
        }
        if (node.children.length > 0) {
          return { ...node, children: toggleInTree(node.children) };
        }
        return node;
      });
    };
    setFolderTree(prev => toggleInTree(prev));
  }, []);

  /**
   * Toggle selection for a node (and optionally its children)
   */
  const toggleNodeSelection = useCallback((targetPath: string, recursive = false) => {
    const toggleInTree = (nodes: FolderNode[]): FolderNode[] => {
      return nodes.map(node => {
        if (node.path === targetPath) {
          const newSelected = !node.selected;
          if (recursive && node.children.length > 0) {
            // Recursively select/deselect children
            const toggleChildren = (children: FolderNode[]): FolderNode[] => {
              return children.map(child => ({
                ...child,
                selected: newSelected,
                children: toggleChildren(child.children),
              }));
            };
            return { ...node, selected: newSelected, children: toggleChildren(node.children) };
          }
          return { ...node, selected: newSelected };
        }
        if (node.children.length > 0) {
          return { ...node, children: toggleInTree(node.children) };
        }
        return node;
      });
    };
    setFolderTree(prev => toggleInTree(prev));
  }, []);

  /**
   * Count total selected nodes in tree (folders and files separately)
   */
  const countSelected = useCallback((nodes: FolderNode[]): { folders: number; files: number } => {
    let folders = 0;
    let files = 0;
    for (const node of nodes) {
      if (node.selected) {
        if (node.isFile) {
          files++;
        } else {
          folders++;
        }
      }
      if (node.children.length > 0) {
        const childCounts = countSelected(node.children);
        folders += childCounts.folders;
        files += childCounts.files;
      }
    }
    return { folders, files };
  }, []);

  /**
   * Count total nodes in tree (folders and files separately)
   */
  const countTotal = useCallback((nodes: FolderNode[]): { folders: number; files: number } => {
    let folders = 0;
    let files = 0;
    for (const node of nodes) {
      if (node.isFile) {
        files++;
      } else {
        folders++;
      }
      if (node.children.length > 0) {
        const childCounts = countTotal(node.children);
        folders += childCounts.folders;
        files += childCounts.files;
      }
    }
    return { folders, files };
  }, []);

  /**
   * Select/deselect all nodes in tree
   */
  const setAllNodesSelected = useCallback((selected: boolean) => {
    const updateAll = (nodes: FolderNode[]): FolderNode[] => {
      return nodes.map(node => ({
        ...node,
        selected,
        children: updateAll(node.children),
      }));
    };
    setFolderTree(prev => updateAll(prev));
  }, []);

  /** Remove a file from the selected list */
  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setStagingSessionId(null);
  }, []);

  /** Clear all selected files */
  const clearAllFiles = useCallback(() => {
    setSelectedFiles([]);
    setStagingSessionId(null);
    setUploadProgress(0);
    setCollapsedGroups(new Set());
    setSelectedFileIndices(new Set());
    setSearchQuery('');
  }, []);

  /** Toggle a folder group's collapsed state */
  const toggleGroup = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }, []);

  /** Remove all files in a specific folder group */
  const removeGroup = useCallback((groupKey: string, groupFiles: File[]) => {
    setSelectedFiles((prev) => prev.filter((f) => !groupFiles.includes(f)));
    setStagingSessionId(null);
    setSelectedFileIndices(new Set());
  }, []);

  // ==========================================
  // Multi-Select Operations
  // ==========================================

  /** Toggle selection of a single file by index */
  const toggleFileSelection = useCallback((index: number) => {
    setSelectedFileIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  /** Toggle selection of all files in a group */
  const toggleGroupSelection = useCallback((groupFiles: File[]) => {
    const indices = groupFiles.map((f) => selectedFiles.indexOf(f));
    const allSelected = indices.every((idx) => selectedFileIndices.has(idx));

    setSelectedFileIndices((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        // Deselect all
        indices.forEach((idx) => next.delete(idx));
      } else {
        // Select all
        indices.forEach((idx) => next.add(idx));
      }
      return next;
    });
  }, [selectedFiles, selectedFileIndices]);

  /** Check if all files in a group are selected */
  const isGroupFullySelected = useCallback(
    (groupFiles: File[]) => {
      const indices = groupFiles.map((f) => selectedFiles.indexOf(f));
      return indices.length > 0 && indices.every((idx) => selectedFileIndices.has(idx));
    },
    [selectedFiles, selectedFileIndices]
  );

  /** Check if some (but not all) files in a group are selected */
  const isGroupPartiallySelected = useCallback(
    (groupFiles: File[]) => {
      const indices = groupFiles.map((f) => selectedFiles.indexOf(f));
      const selectedCount = indices.filter((idx) => selectedFileIndices.has(idx)).length;
      return selectedCount > 0 && selectedCount < indices.length;
    },
    [selectedFiles, selectedFileIndices]
  );

  /** Select all files */
  const selectAllFiles = useCallback(() => {
    setSelectedFileIndices(new Set(selectedFiles.map((_, idx) => idx)));
  }, [selectedFiles]);

  /** Clear selection */
  const clearSelection = useCallback(() => {
    setSelectedFileIndices(new Set());
  }, []);

  /** Remove selected files */
  const removeSelectedFiles = useCallback(() => {
    if (selectedFileIndices.size === 0) return;
    
    setSelectedFiles((prev) => prev.filter((_, idx) => !selectedFileIndices.has(idx)));
    setSelectedFileIndices(new Set());
    setStagingSessionId(null);
  }, [selectedFileIndices]);

  // ==========================================
  // Drag & Drop Handlers
  // ==========================================

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    // Try to read dropped folders recursively via webkitGetAsEntry API
    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const entries: FileSystemEntry[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) entries.push(entry);
      }

      // If any entry is a directory, read recursively
      const hasDirectory = entries.some((e) => e.isDirectory);
      if (hasDirectory) {
        console.info('[ImportForm] Folder(s) dropped, reading recursively...');
        readEntriesRecursive(entries).then((files) => {
          if (files.length > 0) {
            console.info('[ImportForm] Folder drop resolved:', {
              totalFiles: files.length,
              names: files.slice(0, 5).map((f) => f.name),
            });
            setSelectedFiles((prev) => [...prev, ...files]);
            setStagingSessionId(null);
          }
        });
        return;
      }
    }

    // Fallback: regular file drop
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      console.info('[ImportForm] Files dropped:', {
        count: files.length,
        names: files.map((f) => f.name),
      });
      setSelectedFiles((prev) => [...prev, ...files]);
      setStagingSessionId(null);
    }
  }, []);

  /**
   * Recursively read all files from FileSystemEntry items (folders + files).
   * Used for drag & drop of folders.
   *
   * @param entries - Array of FileSystemEntry from DataTransfer
   * @returns Promise resolving to flat array of File objects
   */
  const readEntriesRecursive = async (
    entries: FileSystemEntry[]
  ): Promise<File[]> => {
    const files: File[] = [];

    const readEntry = async (entry: FileSystemEntry): Promise<void> => {
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry;
        const file = await new Promise<File>((resolve, reject) => {
          fileEntry.file(resolve, reject);
        });
        // Filter out system files
        if (
          file.size > 0 &&
          !IGNORED_FILES.has(file.name) &&
          !file.name.startsWith('.')
        ) {
          files.push(file);
        }
      } else if (entry.isDirectory) {
        // Skip __MACOSX folders
        if (entry.name === '__MACOSX') return;
        const dirEntry = entry as FileSystemDirectoryEntry;
        const reader = dirEntry.createReader();
        const subEntries = await new Promise<FileSystemEntry[]>(
          (resolve, reject) => {
            reader.readEntries(resolve, reject);
          }
        );
        for (const subEntry of subEntries) {
          await readEntry(subEntry);
        }
      }
    };

    for (const entry of entries) {
      await readEntry(entry);
    }

    return files;
  };

  // ==========================================
  // Upload & Submit
  // ==========================================

  /**
   * Upload files to staging (preserves folder structure via webkitRelativePath).
   */
  const uploadFilesToStagingSession = async (
    files: File[],
    onProgress?: (percent: number) => void
  ): Promise<string> => {
    console.info('[ImportForm] Starting staging upload...', { count: files.length });
    setUploading(true);
    setUploadProgress(0);

    let sessionId = '';
    try {
      const session = await caseImporterService.createStagingSession();
      sessionId = session.session_id;
      setActiveUploadSessionId(sessionId);

      const totalFiles = files.length;
      for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        const relativePath = getStagingRelativePath(file);

        const registrationResponse = await caseImporterService.registerStagingFile(sessionId, {
          relative_path: relativePath,
          upload_length: file.size,
        });

        const backendFileId = registrationResponse.file_id;
        const CHUNK_SIZE = 512 * 1024;
        const arrayBuffer = await file.arrayBuffer();
        let offset = 0;

        while (offset < file.size) {
          const chunkEnd = Math.min(offset + CHUNK_SIZE, file.size);
          const chunk = arrayBuffer.slice(offset, chunkEnd);
          await caseImporterService.uploadFileChunk(
            sessionId,
            backendFileId,
            offset,
            new Blob([chunk])
          );
          offset = chunkEnd;
          const totalProgress = ((i + (offset / file.size)) / totalFiles) * 100;
          onProgress?.(totalProgress);
          setUploadProgress(totalProgress);
        }
      }

      console.info('[ImportForm] All files uploaded to staging:', { sessionId });
      return sessionId;
    } catch (error: unknown) {
      console.error('[ImportForm] Staging upload failed:', error);
      throw error;
    } finally {
      setUploading(false);
      setActiveUploadSessionId(null);
    }
  };

  const uploadFilesToStaging = async (): Promise<string> => {
    const sessionId = await uploadFilesToStagingSession(selectedFiles, setUploadProgress);
    setStagingSessionId(sessionId);
    return sessionId;
  };

  /**
   * Handle form submission based on source mode and selected processing mode.
   *
   * For "upload" mode: uploads files, then uses /import/analyze with artifacts
   * (bypasses folder_path which doesn't work with MinIO storage).
   *
   * For "path" mode: uses /import/folder with the server filesystem path.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || submitting || uploading) return;

    setSubmitting(true);

    const toolAllowlist = resolveToolAllowlistForImport(selectedPlugins, catalogToolIds);

    console.info('[ImportForm] Selected plugins for import:', {
      count: selectedPlugins.length,
      plugins: selectedPlugins,
      tool_allowlist_for_api: toolAllowlist,
    });

    try {
      // ---- Batch Mode ----
      if (sourceMode === 'batch') {
        let roots = batchRoots;
        if (roots.length === 0) {
          toast.error(
            t(
              'caseImporter.import.batch.toastNoCasesToImport',
              'No cases to import. Run Analyze or adjust split strategy.'
            )
          );
          setSubmitting(false);
          return;
        }

        if (!isServerSideBatchPath(batchRootPath) && batchFiles.length > 0) {
          const filePaths = batchFiles.map(getStagingRelativePath);
          roots = filterFilePathsFromRoots(roots, filePaths);
          if (roots.length === 0) {
            toast.error(
              'No valid folder roots found. Adjust depth or split strategy — file paths cannot be used as case roots.'
            );
            setSubmitting(false);
            return;
          }
        }

        const caseNames = roots.map((root, idx) =>
          applyCaseNameTemplate(caseNameTemplate, root, idx)
        );
        const serverSide = isServerSideBatchPath(batchRootPath);

        console.info('[ImportForm] Batch import:', {
          serverSide,
          roots,
          caseNames,
          splitStrategy,
          mode,
          tool_allowlist: toolAllowlist,
        });

        if (serverSide) {
          if (batchFiles.length === 0 && splitStrategy !== 'none') {
            toast.error(
              'Use Browse to analyze the folder structure, or choose Single Case for a server path only.'
            );
            setSubmitting(false);
            return;
          }

          const folders = resolveServerFolderPaths(batchRootPath, roots);

          if (mode === 'review') {
            for (let i = 0; i < folders.length; i++) {
              await caseImporterService.reviewFiles({
                folder_path: folders[i],
                case_name: caseNames[i],
                force: false,
                tool_allowlist: toolAllowlist,
              });
            }
            toast.success(
              t('caseImporter.import.batch.toastReviewStarted', {
                defaultValue: 'Review started for {{count}} case(s)',
                count: folders.length,
              })
            );
          } else if (folders.length === 1 && splitStrategy === 'none') {
            const request = {
              folder_path: folders[0],
              case_name: caseNames[0],
              tool_allowlist: toolAllowlist,
            };
            if (mode === 'sync') {
              toast.loading(t('toast.runningSyncImport'), { id: 'sync-import' });
              await caseImporterService.importFolderSync(request);
              toast.dismiss('sync-import');
              toast.success(t('toast.syncImportCompleted'));
            } else {
              const result = await caseImporterService.importFolder(request);
              toast.success(
                t('caseImporter.import.batch.toastImportStarted', {
                  defaultValue: 'Import started: {{message}}',
                  message: result.message,
                })
              );
              router.push(routes.caseImporter.detail(result.case_id));
              return;
            }
          } else {
            await caseImporterService.importFoldersBatch({
              folders,
              case_names: caseNames,
              tool_allowlist: toolAllowlist,
            });
            toast.success(
              t('caseImporter.import.batch.toastBatchQueued', {
                defaultValue: 'Batch import queued for {{count}} case(s)',
                count: folders.length,
              })
            );
          }

          router.push(routes.caseImporter.dashboard);
          return;
        }

        if (batchFiles.length === 0) {
          toast.error(
            t(
              'caseImporter.import.batch.toastBrowseOrServerPath',
              'Browse and select a folder from your computer, or enter a server path.'
            )
          );
          setSubmitting(false);
          return;
        }

        const sessionId = await uploadFilesToStagingSession(batchFiles, setUploadProgress);
        setStagingSessionId(sessionId);

        const stagingStatus = await caseImporterService.getStagingSessionStatus(sessionId);
        if (!isStagingSessionComplete(stagingStatus)) {
          toast.error(
            t(
              'toast.stagingIncomplete',
              'Upload is not complete. Please wait for all files to finish uploading.'
            )
          );
          setSubmitting(false);
          return;
        }

        if (roots.length === 1 && splitStrategy === 'none') {
          const result = await caseImporterService.importFromStaging({
            staging_id: sessionId,
            case_name: caseNames[0],
            tool_allowlist: toolAllowlist,
          });
          toast.success(
            t('caseImporter.import.batch.toastImportStarted', {
              defaultValue: 'Import started: {{message}}',
              message: result.message,
            })
          );
          const { cleanupStagingSessionAfterImport } = await import(
            '@/utils/staging-cleanup'
          );
          await cleanupStagingSessionAfterImport(sessionId);
          router.push(routes.caseImporter.detail(result.case_id));
          return;
        }

        await caseImporterService.importFromStagingBatch({
          staging_id: sessionId,
          roots,
          case_names: caseNames,
          tool_allowlist: toolAllowlist,
        });
        toast.success(
          t('caseImporter.import.batch.toastBatchQueued', {
            defaultValue: 'Batch import queued for {{count}} case(s)',
            count: roots.length,
          })
        );
        const { cleanupStagingSessionAfterImport: cleanupBatch } = await import(
          '@/utils/staging-cleanup'
        );
        await cleanupBatch(sessionId);
        router.push(routes.caseImporter.dashboard);
        return;
      }

      // ---- Upload Mode: staging-based import ----
      if (sourceMode === 'upload') {
        // Step 1: Upload files to staging if not already uploaded
        let sessionId = stagingSessionId;
        if (!sessionId) {
          sessionId = await uploadFilesToStaging();
        }

        if (!sessionId) {
          toast.error(t('toast.noFilesUploaded'));
          setSubmitting(false);
          return;
        }

        const stagingStatus = await caseImporterService.getStagingSessionStatus(sessionId);
        if (!isStagingSessionComplete(stagingStatus)) {
          toast.error(
            t(
              'toast.stagingIncomplete',
              'Upload is not complete. Please wait for all files to finish uploading.'
            )
          );
          setSubmitting(false);
          return;
        }

        console.info('[ImportForm] Importing from staging:', {
          staging_id: sessionId,
          case_name: caseName.trim(),
          mode,
          tool_allowlist: selectedPlugins,
        });

        // Step 2: Import from staging with tool_allowlist
        // Uses /import/from-staging which properly supports tool_allowlist
        if (mode === 'sync') {
          toast.loading(t('toast.runningImport'), {
            id: 'sync-import',
          });
        }

        const result = await caseImporterService.importFromStaging({
          staging_id: sessionId,
          case_name: caseName.trim(),
          tool_allowlist: toolAllowlist,
        });

        if (mode === 'sync') {
          toast.dismiss('sync-import');
        }

        toast.success(
          t('caseImporter.import.batch.toastImportStarted', {
            defaultValue: 'Import started: {{message}}',
            message: result.message,
          })
        );
        console.info('[ImportForm] Import from staging completed:', {
          case_id: result.case_id,
          mode,
        });

        const { cleanupStagingSessionAfterImport: cleanupUpload } = await import(
          '@/utils/staging-cleanup'
        );
        await cleanupUpload(sessionId);

        router.push(routes.caseImporter.detail(result.case_id));
        return;
      }

      // ---- Server Path Mode: folder-based import ----
      const importPath = folderPath.trim();
      if (!importPath) {
        toast.error(t('toast.enterFolderPath'));
        setSubmitting(false);
        return;
      }

      const request = {
        folder_path: importPath,
        case_name: caseName.trim(),
        tool_allowlist: toolAllowlist,
      };

      console.info('[ImportForm] Submitting folder import:', { ...request, mode });

      switch (mode) {
        case 'async': {
          const result = await caseImporterService.importFolder(request);
          toast.success(
            t('caseImporter.import.batch.toastImportStarted', {
              defaultValue: 'Import started: {{message}}',
              message: result.message,
            })
          );
          console.info('[ImportForm] Async import started:', {
            case_id: result.case_id,
          });
          router.push(routes.caseImporter.detail(result.case_id));
          break;
        }
        case 'sync': {
          toast.loading(t('toast.runningSyncImport'), {
            id: 'sync-import',
          });
          await caseImporterService.importFolderSync(request);
          toast.dismiss('sync-import');
          toast.success(t('toast.syncImportCompleted'));
          console.info('[ImportForm] Sync import completed');
          router.push(routes.caseImporter.dashboard);
          break;
        }
        case 'review': {
          const result = await caseImporterService.reviewFiles({
            ...request,
            force: false,
          });
          toast.success(t('toast.reviewCompleted'));
          console.info('[ImportForm] Review completed:', result);
          const caseId = (result as Record<string, unknown>).case_id;
          if (typeof caseId === 'string') {
            router.push(routes.caseImporter.detail(caseId));
          } else {
            router.push(routes.caseImporter.dashboard);
          }
          break;
        }
      }
    } catch (err: unknown) {
      console.error('[ImportForm] Import failed:', { mode, sourceMode, err });
      const message = extractErrorMessage(err);
      toast.error(message, { duration: 6000 });
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // Group files by folder (for collapsible display)
  // ==========================================

  const fileGroups = useMemo(() => {
    const groups: Record<string, File[]> = {};
    
    for (const file of selectedFiles) {
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
      
      let groupKey = '__individual__'; // Default for single files
      
      if (relativePath) {
        // Extract top-level folder or parent folder
        const parts = relativePath.split('/');
        if (parts.length > 1) {
          // Use top-level folder as group key
          groupKey = parts[0];
        }
      }
      
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(file);
    }
    
    // Sort groups: folders first (by name), then individual files
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === '__individual__') return 1;
      if (b === '__individual__') return -1;
      return a.localeCompare(b);
    });
    
    return { groups, sortedKeys };
  }, [selectedFiles]);

  // ==========================================
  // Filter groups and files based on search query
  // ==========================================

  const filteredFileGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return fileGroups;
    }

    const query = searchQuery.toLowerCase().trim();
    const filteredGroups: Record<string, File[]> = {};

    for (const groupKey of fileGroups.sortedKeys) {
      const groupFiles = fileGroups.groups[groupKey];
      const groupLabel = groupKey === '__individual__' ? 'Individual Files' : groupKey;

      // Check if group name matches
      const groupMatches = groupLabel.toLowerCase().includes(query);

      if (groupMatches) {
        // If group matches, include all files in that group
        filteredGroups[groupKey] = groupFiles;
      } else {
        // Check if any file in the group matches
        const matchingFiles = groupFiles.filter((file) => {
          const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
          const fileName = file.name.toLowerCase();
          const filePath = (relativePath || '').toLowerCase();

          return fileName.includes(query) || filePath.includes(query);
        });

        if (matchingFiles.length > 0) {
          filteredGroups[groupKey] = matchingFiles;
        }
      }
    }

    const sortedKeys = Object.keys(filteredGroups).sort((a, b) => {
      if (a === '__individual__') return 1;
      if (b === '__individual__') return -1;
      return a.localeCompare(b);
    });

    return { groups: filteredGroups, sortedKeys };
  }, [fileGroups, searchQuery]);

  // ==========================================
  // Render
  // ==========================================

  const totalFileSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
  const isProcessing = submitting || uploading;

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-6', className)}>
      {/* Hidden file input (individual files) */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        accept="*/*"
      />

      {/* Hidden folder input (recursive folder selection — webkitdirectory set via useEffect) */}
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        onChange={handleFolderSelect}
        multiple
      />

      {/* Hidden batch folder input (for batch import folder selection) */}
      <input
        ref={batchFolderInputRef}
        type="file"
        className="hidden"
        onChange={handleBatchFolderSelect}
        multiple
      />

      {/* ---- Source Mode Selector ---- */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <Title
            as="h5"
            className="text-sm font-semibold text-gray-900 dark:text-gray-700"
          >
            {t('caseImporter.import.sourceTitle')}
          </Title>
          <Link
            href={routes.caseImporter.settings}
            className={cn(
              'flex items-center gap-2 rounded-md border border-muted px-3 py-1.5 text-xs transition-all',
              'hover:border-primary hover:bg-primary/5',
              'bg-gray-0 dark:bg-gray-50'
            )}
          >
            <PiGearBold className="h-3.5 w-3.5" />
            <span className="font-medium">
              {t('caseImporter.import.pluginSettings')}
            </span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              ({selectedPlugins.length})
            </span>
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Upload from computer */}
          <button
            type="button"
            onClick={() => setSourceMode('upload')}
            className={cn(
              'flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all',
              sourceMode === 'upload'
                ? 'border-primary bg-primary-lighter/20'
                : 'border-muted bg-gray-0 hover:border-gray-300 dark:bg-gray-50 dark:hover:border-gray-200'
            )}
          >
            <PiCloudArrowUpDuotone className="h-7 w-7 flex-shrink-0 text-primary" />
            <div>
              <Text className="font-semibold text-gray-900 dark:text-gray-700">
                {t('caseImporter.import.sourceModes.upload.title')}
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                {t('caseImporter.import.sourceModes.upload.description')}
              </Text>
            </div>
          </button>

          {/* Server path */}
          <button
            type="button"
            onClick={() => setSourceMode('path')}
            className={cn(
              'flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all',
              sourceMode === 'path'
                ? 'border-primary bg-primary-lighter/20'
                : 'border-muted bg-gray-0 hover:border-gray-300 dark:bg-gray-50 dark:hover:border-gray-200'
            )}
          >
            <PiTerminalWindowDuotone className="h-7 w-7 flex-shrink-0 text-gray-500 dark:text-gray-400" />
            <div>
              <Text className="font-semibold text-gray-900 dark:text-gray-700">
                {t('caseImporter.import.sourceModes.path.title')}
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                {t('caseImporter.import.sourceModes.path.description')}
              </Text>
            </div>
          </button>

          {/* Batch Import */}
          <button
            type="button"
            onClick={() => setSourceMode('batch')}
            className={cn(
              'flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all',
              sourceMode === 'batch'
                ? 'border-primary bg-primary-lighter/20'
                : 'border-muted bg-gray-0 hover:border-gray-300 dark:bg-gray-50 dark:hover:border-gray-200'
            )}
          >
            <PiStackBold className="h-7 w-7 flex-shrink-0 text-blue-500" />
            <div>
              <Text className="font-semibold text-gray-900 dark:text-gray-700">
                {t('caseImporter.import.sourceModes.batch.title')}
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                {t('caseImporter.import.sourceModes.batch.description')}
              </Text>
            </div>
          </button>
        </div>
      </div>

      {/* ---- Upload Zone (when sourceMode === 'upload') ---- */}
      {sourceMode === 'upload' && (
        <div className="space-y-3">
          {/* Drag & Drop Zone */}
          <div
            role="button"
            tabIndex={0}
            onClick={openFileBrowser}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') openFileBrowser();
            }}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all',
              isDragging
                ? 'border-primary bg-primary-lighter/20 scale-[1.01]'
                : 'border-gray-300 bg-gray-0 hover:border-primary hover:bg-gray-50 dark:border-gray-200 dark:bg-gray-50 dark:hover:border-primary dark:hover:bg-gray-100/50'
            )}
          >
            <PiUploadSimpleBold
              className={cn(
                'mb-3 h-10 w-10 transition-colors',
                isDragging ? 'text-primary' : 'text-gray-400'
              )}
            />
            <Text className="mb-1 font-semibold text-gray-700 dark:text-gray-300">
              {isDragging
                ? t('caseImporter.import.upload.dropActive')
                : t('caseImporter.import.upload.dropIdle')}
            </Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              {t('caseImporter.import.upload.dropHint')}
            </Text>
          </div>

          {/* Folder Selection Button */}
          <button
            type="button"
            onClick={openFolderBrowser}
            className="flex w-full items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 bg-gray-0 p-4 text-left transition-all hover:border-primary hover:bg-gray-50 dark:border-gray-200 dark:bg-gray-50 dark:hover:border-primary dark:hover:bg-gray-100/50"
          >
            <PiFolderDuotone className="h-7 w-7 flex-shrink-0 text-primary" />
            <div>
              <Text className="font-semibold text-gray-700 dark:text-gray-300">
                {t('caseImporter.import.upload.selectFolder')}
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                {t('caseImporter.import.upload.selectFolderHint')}
              </Text>
            </div>
          </button>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="rounded-lg border border-muted bg-gray-0 dark:bg-gray-50">
              {/* Header */}
              <div className="space-y-3 border-b border-muted px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PiFilesDuotone className="h-4 w-4 text-gray-500" />
                    <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {selectedFiles.length} file
                      {selectedFiles.length > 1 ? 's' : ''} selected
                    </Text>
                    <Text className="text-xs text-gray-400">
                      ({formatFileSize(totalFileSize)})
                    </Text>
                    {selectedFileIndices.size > 0 && (
                      <Badge variant="flat" color="primary" size="sm" className="text-xs">
                        {selectedFileIndices.size} selected
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                  {selectedFileIndices.size > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-200"
                      >
                        <PiXBold className="h-3 w-3" />
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={removeSelectedFiles}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/20"
                      >
                        <PiTrashBold className="h-3.5 w-3.5" />
                        Delete ({selectedFileIndices.size})
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={selectAllFiles}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
                      >
                        <PiCheckSquareBold className="h-3.5 w-3.5" />
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={clearAllFiles}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/20"
                      >
                        <PiTrashBold className="h-3.5 w-3.5" />
                        Clear all
                      </button>
                    </>
                  )}
                  </div>
                </div>
                
                {/* Search Input */}
                <div className="relative">
                  <PiMagnifyingGlassDuotone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search files or folders..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-md border border-muted bg-gray-0 py-2 pl-9 pr-3 text-sm text-gray-700 placeholder-gray-400 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-gray-50 dark:text-gray-300"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-200"
                      title="Clear search"
                    >
                      <PiXBold className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* File list (max 200px scroll) - GROUPED by folder */}
              <div className="max-h-[200px] overflow-y-auto p-2">
                {filteredFileGroups.sortedKeys.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <PiMagnifyingGlassDuotone className="mb-2 h-8 w-8 text-gray-300" />
                    <Text className="text-sm text-gray-500 dark:text-gray-400">
                      No files match your search
                    </Text>
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="mt-2 text-xs text-primary hover:underline"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                filteredFileGroups.sortedKeys.map((groupKey) => {
                  const groupFiles = filteredFileGroups.groups[groupKey];
                  const isCollapsed = collapsedGroups.has(groupKey);
                  const groupLabel = groupKey === '__individual__' ? 'Individual Files' : groupKey;
                  const groupSize = groupFiles.reduce((sum, f) => sum + f.size, 0);
                  const isFullySelected = isGroupFullySelected(groupFiles);
                  const isPartiallySelected = isGroupPartiallySelected(groupFiles);

                  return (
                    <div key={groupKey} className="mb-2 overflow-hidden rounded-lg border border-muted">
                      {/* Group Header */}
                      <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 dark:bg-gray-100">
                        {/* Group Checkbox */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleGroupSelection(groupFiles);
                          }}
                          className="shrink-0 text-gray-400 hover:text-primary"
                          title={isFullySelected ? 'Deselect all in group' : 'Select all in group'}
                        >
                          {isFullySelected ? (
                            <PiCheckSquareBold className="h-4 w-4 text-primary" />
                          ) : isPartiallySelected ? (
                            <PiMinusBold className="h-4 w-4 text-primary" />
                          ) : (
                            <PiSquareBold className="h-4 w-4" />
                          )}
                        </button>

                        {/* Collapse/Expand button */}
                        <button
                          type="button"
                          onClick={() => toggleGroup(groupKey)}
                          className="flex flex-1 items-center gap-2 text-left"
                        >
                          {isCollapsed ? (
                            <PiCaretRightBold className="h-3 w-3 shrink-0 text-gray-400" />
                          ) : (
                            <PiCaretDownBold className="h-3 w-3 shrink-0 text-gray-400" />
                          )}
                          <PiFolderDuotone className="h-4 w-4 shrink-0 text-primary" />
                          <Text className="flex-1 truncate text-sm font-medium text-gray-700 dark:text-gray-300" title={groupLabel}>
                            {groupLabel}
                          </Text>
                          <Badge variant="flat" size="sm" className="text-xs">
                            {groupFiles.length}
                          </Badge>
                          <Text className="text-xs text-gray-400">
                            {formatFileSize(groupSize)}
                          </Text>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeGroup(groupKey, groupFiles)}
                          className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20"
                          title={`Remove all files in ${groupLabel}`}
                        >
                          <PiTrashBold className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Group Files */}
                      {!isCollapsed && (
                        <div className="bg-white dark:bg-gray-50">
                          {groupFiles.map((file, index) => {
                            const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
                            // For display: show only filename if it's part of a folder, or full path if individual
                            const displayName = groupKey === '__individual__' 
                              ? (relativePath || file.name)
                              : (relativePath ? relativePath.split('/').slice(1).join('/') : file.name);
                            
                            const fileIndex = selectedFiles.indexOf(file);
                            const isSelected = selectedFileIndices.has(fileIndex);
                            
                            return (
                              <div
                                key={`${groupKey}-${file.name}-${index}`}
                                className="flex items-center justify-between border-t border-muted/50 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-100/50"
                              >
                                <div className="flex items-center gap-2 overflow-hidden">
                                  {/* File Checkbox */}
                                  <button
                                    type="button"
                                    onClick={() => toggleFileSelection(fileIndex)}
                                    className="shrink-0 text-gray-400 hover:text-primary"
                                    title={isSelected ? 'Deselect' : 'Select'}
                                  >
                                    {isSelected ? (
                                      <PiCheckSquareBold className="h-3.5 w-3.5 text-primary" />
                                    ) : (
                                      <PiSquareBold className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                  
                                  <PiFilesDuotone className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                                  <Text className="truncate text-xs text-gray-700 dark:text-gray-300" title={displayName}>
                                    {displayName}
                                  </Text>
                                  <Text className="flex-shrink-0 text-xs text-gray-400">
                                    {formatFileSize(file.size)}
                                  </Text>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeFile(selectedFiles.indexOf(file))}
                                  className="ml-2 flex-shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20"
                                >
                                  <PiXBold className="h-3 w-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
                )}
              </div>

              {/* Upload Progress */}
              {uploading && (
                <div className="border-t border-muted px-4 py-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <Text className="text-xs font-medium text-primary">
                      Uploading files...
                    </Text>
                    <Text className="text-xs text-gray-500">
                      {uploadProgress}%
                    </Text>
                  </div>
                  <Progressbar value={uploadProgress} size="sm" color="primary" />
                </div>
              )}

              {/* Upload Success */}
              {stagingSessionId && !uploading && (
                <div className="flex items-center gap-2 border-t border-muted px-4 py-2.5">
                  <PiCheckCircleDuotone className="h-4 w-4 flex-shrink-0 text-green-500" />
                  <Text className="text-xs text-green-700 dark:text-green-400">
                    {selectedFiles.length} file(s) uploaded successfully — ready to import
                  </Text>
                </div>
              )}
            </div>
          )}

          {/* Add more files/folder buttons */}
          {selectedFiles.length > 0 && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openFileBrowser}
                className="gap-1.5"
              >
                <PiUploadSimpleBold className="h-4 w-4" />
                Add more files
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openFolderBrowser}
                className="gap-1.5"
              >
                <PiFolderDuotone className="h-4 w-4" />
                Add folder
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ---- Server Path Input (when sourceMode === 'path') ---- */}
      {sourceMode === 'path' && (
        <div>
          <Input
            label="Folder Path (Server-side)"
            placeholder="/data/case-files/my-case"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            prefix={
              <PiFolderOpenDuotone className="h-5 w-5 text-gray-400" />
            }
            helperText="Full path to an existing folder on the backend server (e.g., /data/uploads/...)"
            required
          />
        </div>
      )}

      {/* ---- Batch Import Configuration (when sourceMode === 'batch') ---- */}
      {sourceMode === 'batch' && (
        <div className="space-y-6 rounded-lg border border-blue-300 bg-blue-50/30 p-6 dark:border-blue-800 dark:bg-blue-950/20">
          {/* Step 1: Root Folder */}
          <div>
            <Title as="h5" className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-700">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs text-white">1</span>
              Root Folder Path
            </Title>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="C:\Users\Alex\Pictures\test"
                  value={batchRootPath}
                  onChange={(e) => setBatchRootPath(e.target.value)}
                  prefix={<PiFolderOpenDuotone className="h-5 w-5 text-blue-500" />}
                  helperText="Select a folder from your computer or enter server path"
                  className="bg-white dark:bg-gray-50"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={openBatchFolderBrowser}
                className="mt-0 h-10 border-blue-300 text-blue-600 hover:bg-blue-50"
                title="Browse and select folder from your computer"
              >
                <PiFolderDuotone className="h-4 w-4" />
                Browse
              </Button>
            </div>
          </div>

          {/* Step 2: Split Strategy */}
          <div>
            <Title as="h5" className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-700">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs text-white">2</span>
              Split Strategy
            </Title>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Pattern-based */}
              <button
                type="button"
                onClick={() => setSplitStrategy('pattern')}
                className={cn(
                  'flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-all',
                  splitStrategy === 'pattern'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-muted bg-white hover:border-blue-300 dark:bg-gray-50'
                )}
              >
                <PiTextTBold className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
                <div className="flex-1">
                  <Text className="font-semibold text-gray-900 dark:text-gray-700">
                    By Pattern
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400">
                    Match folder names with wildcards (e.g., ID*, Case_*)
                  </Text>
                </div>
              </button>

              {/* Depth-based */}
              <button
                type="button"
                onClick={() => setSplitStrategy('depth')}
                className={cn(
                  'flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-all',
                  splitStrategy === 'depth'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-muted bg-white hover:border-blue-300 dark:bg-gray-50'
                )}
              >
                <PiListNumbersBold className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
                <div className="flex-1">
                  <Text className="font-semibold text-gray-900 dark:text-gray-700">
                    By Depth
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400">
                    Split at a specific folder depth level
                  </Text>
                </div>
              </button>

              {/* Manual selection */}
              <button
                type="button"
                onClick={() => setSplitStrategy('manual')}
                className={cn(
                  'flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-all',
                  splitStrategy === 'manual'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-muted bg-white hover:border-blue-300 dark:bg-gray-50'
                )}
              >
                <PiTreeStructureBold className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
                <div className="flex-1">
                  <Text className="font-semibold text-gray-900 dark:text-gray-700">
                    Manual Selection
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400">
                    Pick specific folders from tree view
                  </Text>
                </div>
              </button>

              {/* None (keep as one) */}
              <button
                type="button"
                onClick={() => setSplitStrategy('none')}
                className={cn(
                  'flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-all',
                  splitStrategy === 'none'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-muted bg-white hover:border-blue-300 dark:bg-gray-50'
                )}
              >
                <PiFolderDuotone className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
                <div className="flex-1">
                  <Text className="font-semibold text-gray-900 dark:text-gray-700">
                    Single Case
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400">
                    Import entire folder as one case
                  </Text>
                </div>
              </button>
            </div>

            {/* Strategy-specific inputs */}
            <div className="mt-4">
              {splitStrategy === 'pattern' && (
                <div className="space-y-3">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Folder Pattern
                      </Text>
                      <button
                        type="button"
                        onClick={() => setShowPatternGuide(!showPatternGuide)}
                        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {showPatternGuide ? 'Hide Guide' : 'Show Pattern Guide'}
                      </button>
                    </div>
                    <Input
                      placeholder="Example: #######-####/##/##-*"
                      value={splitPattern}
                      onChange={(e) => {
                        setSplitPattern(e.target.value);
                        setPatternPreview(null); // Clear preview on change
                      }}
                      prefix={<PiTextTBold className="h-4 w-4 text-blue-500" />}
                      suffix={
                        splitPattern && validatePattern(splitPattern) ? (
                          <PiWarningDuotone className="h-4 w-4 text-red-500" title={validatePattern(splitPattern) || ''} />
                        ) : splitPattern ? (
                          <PiCheckCircleDuotone className="h-4 w-4 text-green-500" title="Valid pattern" />
                        ) : null
                      }
                      className="bg-white dark:bg-gray-50"
                    />
                    {splitPattern && validatePattern(splitPattern) && (
                      <Text className="mt-1 text-xs text-red-500">
                        {validatePattern(splitPattern)}
                      </Text>
                    )}
                  </div>

                  {/* Pattern Guide */}
                  {showPatternGuide && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-800 dark:bg-blue-950/20">
                      <div className="mb-3 flex items-center gap-2">
                        <PiInfoBold className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <Text className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                          Pattern Syntax Reference
                        </Text>
                      </div>
                      
                      {/* Symbols Table */}
                      <div className="mb-3 space-y-1.5 text-xs">
                        <div className="grid grid-cols-[60px_1fr] gap-2">
                          <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            #
                          </code>
                          <Text className="text-gray-700 dark:text-gray-300">
                            One digit (0-9)
                          </Text>
                        </div>
                        <div className="grid grid-cols-[60px_1fr] gap-2">
                          <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            @
                          </code>
                          <Text className="text-gray-700 dark:text-gray-300">
                            One letter (a-z, A-Z)
                          </Text>
                        </div>
                        <div className="grid grid-cols-[60px_1fr] gap-2">
                          <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            *
                          </code>
                          <Text className="text-gray-700 dark:text-gray-300">
                            Zero or more of any character
                          </Text>
                        </div>
                        <div className="grid grid-cols-[60px_1fr] gap-2">
                          <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            ?
                          </code>
                          <Text className="text-gray-700 dark:text-gray-300">
                            Exactly one character (any)
                          </Text>
                        </div>
                        <div className="grid grid-cols-[60px_1fr] gap-2">
                          <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            text
                          </code>
                          <Text className="text-gray-700 dark:text-gray-300">
                            Literal text (must match exactly)
                          </Text>
                        </div>
                      </div>

                      {/* Examples */}
                      <div className="border-t border-blue-200 pt-3 dark:border-blue-800">
                        <Text className="mb-2 text-xs font-semibold text-blue-900 dark:text-blue-300">
                          Examples:
                        </Text>
                        <div className="space-y-1.5 text-xs">
                          <div>
                            <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              ID*
                            </code>
                            <Text className="ml-2 inline text-gray-600 dark:text-gray-400">
                              → ID1, ID2, ID_anything
                            </Text>
                          </div>
                          <div>
                            <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              ####-##-##
                            </code>
                            <Text className="ml-2 inline text-gray-600 dark:text-gray-400">
                              → 2005-12-31, 1999-01-01
                            </Text>
                          </div>
                          <div>
                            <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              #######-####/##/##-*
                            </code>
                            <Text className="ml-2 inline text-gray-600 dark:text-gray-400">
                              → 2135468-2005/12/02-family
                            </Text>
                          </div>
                          <div>
                            <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              Case_@@@@_####
                            </code>
                            <Text className="ml-2 inline text-gray-600 dark:text-gray-400">
                              → Case_ABCD_0001
                            </Text>
                          </div>
                          <div>
                            <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              IMG_####.???
                            </code>
                            <Text className="ml-2 inline text-gray-600 dark:text-gray-400">
                              → IMG_1234.jpg, IMG_5678.png
                            </Text>
                          </div>
                          <div>
                            <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              2005/##/##-*
                            </code>
                            <Text className="ml-2 inline text-gray-600 dark:text-gray-400">
                              → 2005/01/15-report, 2005/12/31-data
                            </Text>
                          </div>
                        </div>
                      </div>

                      {/* Tips */}
                      <div className="mt-3 border-t border-blue-200 pt-3 dark:border-blue-800">
                        <Text className="text-xs font-semibold text-blue-900 dark:text-blue-300">
                          💡 Tips:
                        </Text>
                        <ul className="mt-1 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                          <li>• Combine multiple # or @ for exact counts: ### = exactly 3 digits</li>
                          <li>• Use * at end for flexible matching: ID* matches ID1, ID_new, ID_anything</li>
                          <li>• Special chars (. / - _) are matched literally</li>
                          <li>• Pattern is case-sensitive for literal text</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Preview Button */}
                  {batchFiles.length > 0 && splitPattern && !validatePattern(splitPattern) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        try {
                          const regex = patternToRegex(splitPattern);
                          const uniqueFolders = new Set<string>();
                          
                          batchFiles.forEach(file => {
                            const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
                            if (relativePath) {
                              const parts = relativePath.split('/');
                              // Check each folder in path
                              parts.slice(0, -1).forEach(folderName => {
                                uniqueFolders.add(folderName);
                              });
                            }
                          });
                          
                          const allFolders = Array.from(uniqueFolders);
                          const matched = allFolders.filter(name => regex.test(name));
                          
                          setPatternPreview({
                            matched,
                            total: allFolders.length
                          });
                          
                          if (matched.length === 0) {
                            toast.error(
                              t(
                                'caseImporter.import.batch.toastNoFoldersMatchPattern',
                                'No folders match this pattern'
                              )
                            );
                          } else {
                            toast.success(
                              t('caseImporter.import.batch.toastFoundMatchingFoldersSimple', {
                                defaultValue: 'Found {{count}} matching folder(s)',
                                count: matched.length,
                              })
                            );
                          }
                        } catch (err) {
                          toast.error(
                            t('caseImporter.import.batch.toastInvalidPattern', 'Invalid pattern')
                          );
                        }
                      }}
                      className="w-full border-blue-500 text-blue-600 hover:bg-blue-50"
                    >
                      <PiMagnifyingGlassDuotone className="mr-2 h-4 w-4" />
                      Test Pattern
                    </Button>
                  )}

                  {/* Preview Results */}
                  {patternPreview && (
                    <div className="rounded-lg border border-green-200 bg-green-50/70 p-3 dark:border-green-800 dark:bg-green-950/20">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <PiCheckCircleDuotone className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <Text className="text-sm font-semibold text-green-900 dark:text-green-300">
                            Pattern Match Results
                          </Text>
                        </div>
                        <Badge variant="flat" color="success" size="sm">
                          {patternPreview.matched.length} of {patternPreview.total}
                        </Badge>
                      </div>
                      {patternPreview.matched.length > 0 ? (
                        <div className="max-h-32 space-y-1 overflow-y-auto">
                          {patternPreview.matched.slice(0, 10).map((name, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                              <PiFolderDuotone className="h-3 w-3 text-green-600 dark:text-green-400" />
                              <Text className="font-mono text-green-800 dark:text-green-200">{name}</Text>
                            </div>
                          ))}
                          {patternPreview.matched.length > 10 && (
                            <Text className="text-xs italic text-green-600 dark:text-green-400">
                              ... and {patternPreview.matched.length - 10} more
                            </Text>
                          )}
                        </div>
                      ) : (
                        <Text className="text-xs text-green-600 dark:text-green-400">
                          No folders match this pattern
                        </Text>
                      )}
                    </div>
                  )}
                </div>
              )}

              {splitStrategy === 'depth' && (
                <div>
                  <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Folder Depth Level
                  </Text>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="5"
                      value={splitDepth}
                      onChange={(e) => setSplitDepth(Number(e.target.value))}
                      className="flex-1"
                    />
                    <Badge variant="flat" color="info" size="lg" className="w-12 justify-center">
                      {splitDepth}
                    </Badge>
                  </div>
                  <Text className="mt-1 text-xs text-gray-500">
                    0 = root, 1 = immediate children, 2 = grandchildren, etc.
                  </Text>
                </div>
              )}

              {splitStrategy === 'manual' && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/10">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                    <PiInfoBold className="h-4 w-4" />
                    <Text className="text-xs font-medium">
                      Analyze the folder first to see the tree view and select folders
                    </Text>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Case Naming Template */}
          <div>
            <Title as="h5" className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-700">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs text-white">3</span>
              Case Name Template
            </Title>
            <Input
              placeholder="{folder_name}"
              value={caseNameTemplate}
              onChange={(e) => setCaseNameTemplate(e.target.value)}
              prefix={<PiTagDuotone className="h-5 w-5 text-blue-500" />}
              helperText="Use {folder_name} for folder name, {index} for number, {date} for timestamp"
              className="bg-white dark:bg-gray-50"
            />
          </div>

          {/* Analyze Button */}
          <div className="flex items-center gap-3 rounded-lg border border-blue-300 bg-blue-500/5 p-4">
            <PiWarningDuotone className="h-5 w-5 flex-shrink-0 text-blue-600" />
            <div className="flex-1">
              <Text className="text-sm font-medium text-blue-900 dark:text-blue-300">
                Preview Before Import
              </Text>
              <Text className="text-xs text-blue-700 dark:text-blue-400">
                Click Analyze to see which folders will become separate cases
              </Text>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!batchRootPath.trim() || analyzingFolder}
              onClick={() => {
                console.info('[BatchImport] Analyzing folder:', { 
                  root: batchRootPath, 
                  strategy: splitStrategy, 
                  pattern: splitPattern,
                  depth: splitDepth
                });
                
                // Re-analyze with stored files
                if (batchFiles.length > 0) {
                  analyzeFolderStructure(batchFiles);
                } else {
                  toast.error(
                    t(
                      'caseImporter.import.batch.toastSelectFolderFirst',
                      'Please select a folder first using the Browse button'
                    )
                  );
                }
              }}
              className="border-blue-500 text-blue-600 hover:bg-blue-50"
            >
              {analyzingFolder ? (
                <>
                  <Loader className="h-4 w-4" />
                  Analyzing...
                </>
              ) : (
                <>
                  <PiMagnifyingGlassDuotone className="h-4 w-4" />
                  Analyze Folder
                </>
              )}
            </Button>
          </div>

          {/* Preview */}
          {folderTree.length > 0 && (
            <div className="rounded-lg border border-muted bg-white p-4 dark:bg-gray-50">
              <div className="mb-3 flex items-center justify-between">
                <Title as="h6" className="text-sm font-semibold text-gray-900 dark:text-gray-700">
                  {splitStrategy === 'manual' ? 'Select Folders to Import' : 'Preview: Cases to Create'}
                </Title>
                {splitStrategy === 'manual' && (
                  <Text className="text-xs text-gray-500">
                    Click <PiCaretRightBold className="inline h-3 w-3" /> to expand folders
                  </Text>
                )}
              </div>

              {splitStrategy === 'manual' ? (
                // Tree view for manual selection
                <div className="space-y-1">
                  {folderTree.map((node) => (
                    <TreeNodeView
                      key={node.path}
                      node={node}
                      level={0}
                      onToggleExpand={toggleNodeExpand}
                      onToggleSelection={toggleNodeSelection}
                      caseNameTemplate={caseNameTemplate}
                    />
                  ))}
                </div>
              ) : (
                // Flat list for pattern/depth/none
                <div className="space-y-2">
                  {folderTree.filter(node => node.selected).map((node, idx) => (
                    <div 
                      key={node.path} 
                      className="flex items-center justify-between rounded-lg border border-muted bg-gray-50 px-4 py-2 dark:bg-gray-100"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="flat" color="info" size="sm">
                          {idx + 1}
                        </Badge>
                        <PiFolderDuotone className="h-4 w-4 text-blue-500" />
                        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {caseNameTemplate.replace('{folder_name}', node.name).replace('{index}', String(idx + 1))}
                        </Text>
                      </div>
                      <Text className="text-xs text-gray-500">
                        {node.files} files
                      </Text>
                    </div>
                  ))}
                </div>
              )}

              {splitStrategy === 'manual' && (
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Text className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Selected:
                    </Text>
                    <Badge variant="flat" color="info" size="sm">
                      {countSelected(folderTree).folders} folders
                    </Badge>
                    <Badge variant="flat" color="success" size="sm">
                      {countSelected(folderTree).files} files
                    </Badge>
                  </div>
                  <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />
                  <div className="flex items-center gap-2">
                    <Text className="text-xs text-gray-500">
                      Total:
                    </Text>
                    <Text className="text-xs text-gray-500">
                      {countTotal(folderTree).folders} folders + {countTotal(folderTree).files} files
                    </Text>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <Button
                      type="button"
                      variant="text"
                      size="sm"
                      onClick={() => setAllNodesSelected(true)}
                      className="text-xs text-blue-600"
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="text"
                      size="sm"
                      onClick={() => setAllNodesSelected(false)}
                      className="text-xs text-blue-600"
                    >
                      Clear All
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---- Case Name ---- */}
      {sourceMode !== 'batch' && (
        <Input
          label={t('caseImporter.import.caseNameLabel')}
          placeholder="my-case-001"
          value={caseName}
          onChange={(e) => setCaseName(e.target.value)}
          prefix={<PiTagDuotone className="h-5 w-5 text-gray-400" />}
          helperText={t('caseImporter.import.caseNameHelper')}
          required
        />
      )}



      {/* ---- Import Mode Selection ---- */}
      <div>
        <Title
          as="h5"
          className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-700"
        >
          {t('caseImporter.import.modesTitle')}
        </Title>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(Object.keys(MODE_META) as ImportMode[]).map((m) => {
            const config = MODE_META[m];
            const isSelected = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-lg border-2 p-4 text-left transition-all',
                  isSelected
                    ? config.color + ' border-current'
                    : 'border-muted bg-gray-0 hover:border-gray-300 dark:bg-gray-50 dark:hover:border-gray-200'
                )}
              >
                <div className="flex items-center gap-2">
                  {config.icon}
                  <Text className="font-semibold text-gray-900 dark:text-gray-700">
                    {t(`caseImporter.import.modes.${m}.label`)}
                  </Text>
                </div>
                <Text className="text-xs text-gray-500 dark:text-gray-400">
                  {t(`caseImporter.import.modes.${m}.description`)}
                </Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400">
                  {t(`caseImporter.import.modes.${m}.capability`)}
                </Text>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sync mode warning */}
      {mode === 'sync' && (
        <div className="flex items-start gap-3 rounded-lg border border-orange-300 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/30">
          <PiWarningDuotone className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-500" />
          <div>
            <Text className="font-medium text-orange-800 dark:text-orange-300">
              {t('caseImporter.import.syncWarningTitle')}
            </Text>
            <Text className="mt-1 text-xs text-orange-600 dark:text-orange-400">
              {t('caseImporter.import.syncWarningHint')}
            </Text>
          </div>
        </div>
      )}

      {/* Review mode info */}
      {mode === 'review' && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-300 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
          <PiInfoBold className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
          <div>
            <Text className="font-medium text-blue-800 dark:text-blue-300">
              {t('caseImporter.import.reviewInfoTitle')}
            </Text>
            <Text className="mt-1 text-xs text-blue-600 dark:text-blue-400">
              {t('caseImporter.import.reviewInfoHint')}
            </Text>
          </div>
        </div>
      )}

      {/* ---- Submit Button ---- */}
      <div className="flex items-center gap-3 pt-2">
        {sourceMode === 'batch' && batchRoots.length > 1 && (
          <Text className="flex-1 text-sm text-gray-600 dark:text-gray-400">
            {batchRoots.length} cases will be created using the split strategy above
          </Text>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={!isValid || isProcessing}
          className="min-w-[180px]"
        >
          {isProcessing ? (
            <Loader variant="spinner" size="sm" className="me-2" />
          ) : (
            <PiRocketLaunchDuotone className="me-2 h-5 w-5" />
          )}
          {uploading
            ? t('caseImporter.import.submit.uploading')
            : submitting
              ? sourceMode === 'batch' && batchRoots.length > 1
                ? t('caseImporter.import.submit.startingBatch')
                : t('caseImporter.import.submit.importing')
              : sourceMode === 'batch' && batchRoots.length > 1
                ? t('caseImporter.import.submit.importCases', {
                    count: batchRoots.length,
                  })
                : t('caseImporter.import.submit.start')}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(routes.caseImporter.dashboard)}
        >
          {t('caseImporter.import.submit.cancel')}
        </Button>
      </div>
    </form>
  );
}
