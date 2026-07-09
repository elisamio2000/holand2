// ============================================
// Holand Plugins Service
// Handles plugin/tool discovery, execution, and management
// Backend: API Gateway (browser â†’ /api/gateway; server â†’ API_GATEWAY_URL from check-and-run.ps1)
// ============================================

import { gatewayClient } from '@/lib/api-client';
import { assertGatewayToolSuccess } from '@/utils/gateway-tool-success';
import {
  normalizeFileManagerShareResult,
  unwrapToolExecuteData,
} from '@/utils/tool-execute';
import { toolExecutePath, toolInfoPath, toApiToolId } from '@/utils/tool-id';
import type {
  PluginInfo,
  PluginRunRequest,
  PluginRunResult,
  FileManagerListArgs,
  FileManagerListData,
  FileManagerDetailArgs,
  FileManagerDetailData,
  FileManagerFoldersArgs,
  FileManagerFoldersData,
  FileManagerFacetsArgs,
  FileManagerFacetsData,
  FileManagerShareArgs,
  FileManagerShareData,
} from '@/types/plugins.types';

async function postPluginExecute<T>(url: string, body: unknown) {
  const res = await gatewayClient.post<T>(url, body);
  assertGatewayToolSuccess(res);
  return res;
}

/**
 * Normalize GET /tools (and similar) payloads from gateways that return:
 * - PluginInfo[]
 * - { tools: PluginInfo[] } | { items: PluginInfo[] }
 * - { count, tools: Record<tool_id, Partial<PluginInfo>> } â€” tool_id is the object key
 */
function normalizeToolsListPayload(data: unknown): PluginInfo[] {
  if (Array.isArray(data)) {
    return data as PluginInfo[];
  }
  if (data && typeof data === 'object') {
    const root = data as Record<string, unknown>;
    if ('data' in root && root.data !== undefined && root.data !== null) {
      const nested = normalizeToolsListPayload(root.data);
      if (nested.length > 0) {
        return nested;
      }
    }
    const inner = root.tools ?? root.items;
    if (Array.isArray(inner)) {
      return inner as PluginInfo[];
    }
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      return Object.entries(inner as Record<string, unknown>).map(([toolId, value]) => {
        const base =
          value && typeof value === 'object' && value !== null
            ? { ...(value as Record<string, unknown>) }
            : {};
        const nameGuess =
          typeof base.name === 'string' ? base.name : toolId;
        return {
          ...base,
          tool_id: toApiToolId(toolId),
          name: nameGuess,
        } as PluginInfo;
      });
    }
  }
  return [];
}

export const pluginsService = {
  // ==========================================
  // Plugin Discovery (Gateway â€” /tools)
  // ==========================================

  /**
   * Get list of all available plugins/tools.
   *
   * @endpoint GET /tools
   * @returns Array of plugin information objects
   * @throws {AxiosError} 401 if token is invalid
   */
  async listTools(): Promise<PluginInfo[]> {
    console.info('[PluginsService] Fetching tools...');
    try {
      const res = await gatewayClient.get<unknown>('/tools');
      const data = res.data;

      console.debug('[PluginsService] Raw response:', data);

      const tools = normalizeToolsListPayload(data);

      if (tools.length === 0 && data !== null && data !== undefined) {
        console.warn(
          '[PluginsService] Parsed zero tools from /tools â€” check gateway payload shape vs normalizeToolsListPayload'
        );
      }

      console.info('[PluginsService] Tools fetched:', { count: tools.length, sample: tools[0]?.tool_id });
      return tools;
    } catch (error: unknown) {
      console.error('[PluginsService] Failed to fetch tools:', error);
      throw error;
    }
  },

  /**
   * Get list of plugin categories.
   *
   * @endpoint GET /tools/categories
   * @returns Array of category names
   * @throws {AxiosError} 401 if token is invalid
   */
  async listCategories(): Promise<string[]> {
    console.info('[PluginsService] Fetching categories...');
    try {
      const res = await gatewayClient.get<string[] | { categories?: string[] }>('/tools/categories');
      const data = res.data;
      
      console.debug('[PluginsService] Raw categories response:', data);
      
      // Backend may return array directly or wrapped in 'categories' field
      let categories: string[];
      if (Array.isArray(data)) {
        categories = data;
      } else if (data && typeof data === 'object') {
        categories = (data as any).categories || [];
      } else {
        console.warn('[PluginsService] Unexpected categories format, returning empty array');
        categories = [];
      }
      
      console.info('[PluginsService] Categories fetched:', { count: categories.length, sample: categories.slice(0, 3) });
      return categories;
    } catch (error: unknown) {
      console.error('[PluginsService] Failed to fetch categories:', error);
      throw error;
    }
  },

  /**
   * Get detailed information about a specific plugin.
   *
   * @endpoint GET /tools/{tool_id}
   * @param toolId - Plugin ID (e.g., "file.meta")
   * @returns Plugin information object
   * @throws {AxiosError} 404 if plugin not found
   * @throws {AxiosError} 401 if token is invalid
   */
  async getToolInfo(toolId: string): Promise<PluginInfo> {
    console.info('[PluginsService] Fetching tool info:', { toolId });
    try {
      const apiToolId = toApiToolId(toolId);
      const res = await gatewayClient.get<PluginInfo>(toolInfoPath(toolId));
      const normalized: PluginInfo = {
        ...res.data,
        tool_id: res.data.tool_id ?? res.data.id ?? apiToolId,
      };
      console.info('[PluginsService] Tool info fetched:', {
        toolId,
        resolvedToolId: normalized.tool_id,
        name: normalized.name,
      });
      return normalized;
    } catch (error: unknown) {
      console.error('[PluginsService] Failed to fetch tool info:', { toolId, error });
      throw error;
    }
  },

  // ==========================================
  // Plugin Execution (Gateway â€” /tools/{tool_id}/execute)
  // ==========================================

  /**
   * Execute a plugin with the given arguments.
   *
   * âš ï¸ Uses /execute endpoint (NOT /run â€” which does not exist in the API Gateway).
   *
   * @endpoint POST /tools/{tool_id}/execute
   * @param toolId - Plugin ID to execute
   * @param args - Arguments object for the plugin
   * @param options - Optional session_id, user_id
   * @returns Plugin execution result
   * @throws {AxiosError} 400 if arguments are invalid
   * @throws {AxiosError} 404 if plugin not found
   * @throws {AxiosError} 500 if plugin execution fails
   */
  async runTool(
    toolId: string,
    args: Record<string, unknown>,
    options?: {
      session_id?: string | null;
      user_id?: string | null;
    }
  ): Promise<PluginRunResult> {
    console.info('[PluginsService] Running tool:', { toolId, args });
    try {
      const payload: Partial<PluginRunRequest> = {
        args,
        session_id: options?.session_id,
        user_id: options?.user_id,
      };

      // Remove null/undefined fields
      const cleanPayload = Object.fromEntries(
        Object.entries(payload).filter(([, v]) => v !== null && v !== undefined)
      );

      const res = await postPluginExecute<PluginRunResult>(
        toolExecutePath(toolId),
        cleanPayload
      );
      
      console.info('[PluginsService] Tool executed successfully:', {
        toolId,
        status: res.data.status,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[PluginsService] Tool execution failed:', { toolId, args, error });
      throw error;
    }
  },

  // ==========================================
  // MIME-based Tool Discovery (Gateway â€” /tools/by-mime)
  // ==========================================

  /**
   * Get tools that support a specific MIME type.
   * Useful in file-explorer to show applicable tools per file.
   *
   * @endpoint GET /tools/by-mime/{mime_type}
   * @param mimeType - MIME type (e.g., "image/jpeg", "application/pdf")
   * @returns Array of plugins supporting this MIME type
   * @throws {AxiosError} 401 if token is invalid
   */
  async getToolsByMime(mimeType: string): Promise<PluginInfo[]> {
    // Encode the MIME type for URL (e.g., "image/jpeg" â†’ "image%2Fjpeg")
    const encoded = encodeURIComponent(mimeType);
    console.info('[PluginsService] Fetching tools by MIME:', { mimeType });
    try {
      const res = await gatewayClient.get<unknown>(`/tools/by-mime/${encoded}`);
      const tools = normalizeToolsListPayload(res.data);

      console.info('[PluginsService] Tools by MIME fetched:', {
        mimeType,
        count: tools.length,
      });
      return tools;
    } catch (error: unknown) {
      console.error('[PluginsService] Failed to fetch tools by MIME:', { mimeType, error });
      throw error;
    }
  },

  // ==========================================
  // Tool Execution (Gateway â€” /tools/{tool_id}/execute)
  // ==========================================

  /**
   * Execute a tool via the /execute endpoint.
   * Unlike runTool (/run), this uses the standard Gateway execute path.
   *
   * @endpoint POST /tools/{tool_id}/execute
   * @param toolId - Tool ID to execute (e.g., "image.ocr", "file.meta")
   * @param args - Arguments object for the tool
   * @param sessionId - Optional session ID for context
   * @returns Tool execution result
   * @throws {AxiosError} 400 if arguments are invalid
   * @throws {AxiosError} 404 if tool not found
   * @throws {AxiosError} 500 if tool execution fails
   */
  async executeTool(
    toolId: string,
    args: Record<string, unknown>,
    sessionId?: string | null,
  ): Promise<PluginRunResult> {
    console.info('[PluginsService] Executing tool:', { toolId, args });
    try {
      const payload: { args: Record<string, unknown>; session_id?: string } = { args };
      if (sessionId) {
        payload.session_id = sessionId;
      }

      const res = await postPluginExecute<PluginRunResult>(
        toolExecutePath(toolId),
        payload
      );

      console.info('[PluginsService] Tool executed successfully:', {
        toolId,
        status: res.data.status,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[PluginsService] Tool execution failed:', { toolId, args, error });
      throw error;
    }
  },

  // ==========================================
  // Helper Methods
  // ==========================================

  /**
   * Get plugins filtered by category.
   *
   * @param plugins - Array of all plugins
   * @param category - Category to filter by (or 'all')
   * @returns Filtered plugins
   */
  filterByCategory(plugins: PluginInfo[], category: string): PluginInfo[] {
    if (category === 'all') return plugins;
    return plugins.filter((p) => p.category?.toLowerCase() === category.toLowerCase());
  },

  /**
   * Search plugins by name, ID, or description.
   *
   * @param plugins - Array of all plugins
   * @param query - Search query string
   * @returns Filtered plugins
   */
  searchPlugins(plugins: PluginInfo[], query: string): PluginInfo[] {
    if (!query.trim()) return plugins;
    
    const q = query.toLowerCase();
    return plugins.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.tool_id?.toLowerCase().includes(q) ||
        (p.id || '').toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.description_en?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
    );
  },

  /**
   * Sort plugins by specified field.
   *
   * @param plugins - Array of plugins
   * @param field - Field to sort by
   * @param direction - Sort direction ('asc' or 'desc')
   * @returns Sorted plugins
   */
  sortPlugins(
    plugins: PluginInfo[],
    field: 'name' | 'category' | 'tool_id' | 'updated_at',
    direction: 'asc' | 'desc' = 'asc'
  ): PluginInfo[] {
    const sorted = [...plugins].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (field) {
        case 'name':
          aVal = a.name || a.tool_id || '';
          bVal = b.name || b.tool_id || '';
          break;
        case 'category':
          aVal = a.category || '';
          bVal = b.category || '';
          break;
        case 'tool_id':
          aVal = a.tool_id || a.id || '';
          bVal = b.tool_id || b.id || '';
          break;
        case 'updated_at':
          aVal = a.updated_at || '';
          bVal = b.updated_at || '';
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      return direction === 'asc' ? aNum - bNum : bNum - aNum;
    });

    return sorted;
  },

  /**
   * Get category badge color based on category name.
   * Consistent color mapping for visual identification.
   *
   * @param category - Category name
   * @returns RizzUI badge color
   */
  getCategoryColor(
    category?: string
  ): 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger' {
    if (!category) return 'secondary';
    
    // Hash-based color assignment for consistency
    const hash = category.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const colors: Array<'primary' | 'info' | 'success' | 'warning' | 'danger'> = [
      'primary',
      'info',
      'success',
      'warning',
      'danger',
    ];
    
    return colors[hash % colors.length];
  },

  // ==========================================
  // File Manager Plugin (plugin_file_manager_*)
  // POST /tools/plugin_file_manager_{action}/execute
  // Primary interface for all file management in the UI.
  // ==========================================

  /**
   * List files accessible to the current user.
   * Supports pagination, sorting, ownership filter, and media type filter.
   *
   * NOTE: user_id in args is ignored â€” API Gateway extracts it from the JWT.
   *
   * @endpoint POST /tools/plugin_file_manager_list/execute
   * @param args - Pagination, sort, filter parameters
   * @returns Paginated file list with optional per-type stats
   * @throws {AxiosError} 401 if token invalid, 404 if plugin not registered
   */
  async listFiles(args: FileManagerListArgs): Promise<FileManagerListData> {
    console.info('[PluginsService] Listing files via file_manager plugin:', { args });
    try {
      const res = await postPluginExecute<PluginRunResult>(
        toolExecutePath('plugin.file_manager.list'),
        { args }
      );
      const data = res.data?.data as FileManagerListData | undefined;
      if (!data?.items) {
        throw new Error('Invalid response from plugin.file_manager.list: missing items');
      }
      console.info('[PluginsService] Files listed:', {
        count: data.items.length,
        total: data.total_count,
        page: data.page,
      });
      return data;
    } catch (error: unknown) {
      console.error('[PluginsService] Failed to list files:', { args, error });
      throw error;
    }
  },

  /**
   * Get detailed info for a single file, including download link, thumbnail, and optional share token.
   *
   * NOTE: user_id in args is ignored â€” API Gateway extracts it from the JWT.
   *
   * @endpoint POST /tools/plugin_file_manager_detail/execute
   * @param args - artifact_id, optional thumbnail params and share TTL
   * @returns Detailed file info with download/thumbnail/share paths
   * @throws {AxiosError} 404 if artifact not found
   */
  async getFileDetail(args: FileManagerDetailArgs): Promise<FileManagerDetailData> {
    console.info('[PluginsService] Fetching file detail via plugin:', { artifactId: args.artifact_id });
    try {
      const res = await postPluginExecute<PluginRunResult>(
        toolExecutePath('plugin.file_manager.detail'),
        { args }
      );
      const data = res.data?.data as FileManagerDetailData | undefined;
      if (!data?.id) {
        throw new Error('Invalid response from plugin.file_manager.detail: missing id');
      }
      console.info('[PluginsService] File detail fetched:', {
        id: data.id,
        hasShare: !!data.share?.token,
      });
      return data;
    } catch (error: unknown) {
      console.error('[PluginsService] Failed to get file detail:', { args, error });
      throw error;
    }
  },

  /**
   * Get virtual folder tree for the current user (S3-like prefix/delimiter).
   *
   * NOTE: user_id in args is ignored â€” API Gateway extracts it from the JWT.
   *
   * @endpoint POST /tools/plugin_file_manager_folders/execute
   * @param args - Optional prefix, delimiter, limit, offset
   * @returns List of folder nodes with file count and size
   * @throws {AxiosError} 401 if token invalid
   */
  async getFileFolders(args?: FileManagerFoldersArgs): Promise<FileManagerFoldersData> {
    console.info('[PluginsService] Fetching file folders via plugin:', { args });
    try {
      const res = await postPluginExecute<PluginRunResult>(
        toolExecutePath('plugin.file_manager.folders'),
        { args: args ?? {} }
      );
      const data = res.data?.data as FileManagerFoldersData | undefined;
      console.info('[PluginsService] Folders fetched:', {
        count: data?.folders?.length ?? 0,
      });
      return data ?? { folders: [] };
    } catch (error: unknown) {
      console.error('[PluginsService] Failed to get file folders:', { args, error });
      throw error;
    }
  },

  /**
   * Get facets for building filter UI (media_type counts, mime_type counts, etc.).
   *
   * NOTE: user_id in args is ignored â€” API Gateway extracts it from the JWT.
   *
   * @endpoint POST /tools/plugin_file_manager_facets/execute
   * @param args - Optional filters, top_mimes, top_tags, top_sessions
   * @returns Facet data for sidebar/chip filter UI
   * @throws {AxiosError} 401 if token invalid
   */
  async getFileFacets(args?: FileManagerFacetsArgs): Promise<FileManagerFacetsData> {
    console.info('[PluginsService] Fetching file facets via plugin:', { args });
    try {
      const res = await postPluginExecute<PluginRunResult>(
        toolExecutePath('plugin.file_manager.facets'),
        { args: args ?? {} }
      );
      const data = res.data?.data as FileManagerFacetsData | undefined;
      console.info('[PluginsService] Facets fetched:', {
        mediaTypes: Object.keys(data?.media_type ?? {}),
      });
      return data ?? {};
    } catch (error: unknown) {
      console.error('[PluginsService] Failed to get file facets:', { args, error });
      throw error;
    }
  },

  /**
   * Create or revoke a share token for an artifact.
   *
   * IMPORTANT: For action=create, pass token="" (empty string) â€” the validator requires the field.
   * IMPORTANT: For action=revoke, pass artifact_id="" (empty string).
   *
   * Share download URL is: GET /storage/shares/{token}/download (public, no Bearer needed)
   *
   * @endpoint POST /tools/plugin_file_manager_share/execute
   * @param args - action, artifact_id, token, expires_sec
   * @returns Share token info (create) or confirmation message (revoke)
   * @throws {AxiosError} 403 if not authorized to share this file
   */
  async manageFileShare(args: FileManagerShareArgs): Promise<FileManagerShareData> {
    console.info('[PluginsService] Managing file share via plugin:', {
      action: args.action,
      artifactId: args.artifact_id,
    });
    try {
      const res = await postPluginExecute<PluginRunResult>(
        toolExecutePath('plugin.file_manager.share'),
        { args }
      );
      const raw = unwrapToolExecuteData(res.data) ?? res.data?.data;
      const data = normalizeFileManagerShareResult(raw) as
        | FileManagerShareData
        | null;
      console.info('[PluginsService] File share managed:', {
        action: args.action,
        hasToken: !!data?.token,
      });
      return data ?? {};
    } catch (error: unknown) {
      console.error('[PluginsService] Failed to manage file share:', { args, error });
      throw error;
    }
  },
};

