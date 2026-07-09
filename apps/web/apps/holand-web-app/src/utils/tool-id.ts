// ============================================
// Tool ID helpers — Gateway v2026+ uses underscores in URL paths
// (e.g. plugin_file_manager_list) while legacy UI/registry may still
// reference dotted IDs (plugin.file_manager.list, file.meta).
// ============================================

/** Canonical API path segment for GET/POST /tools/{tool_id}[/execute] */
export function toApiToolId(toolId: string): string {
  return toolId.trim().replace(/\./g, '_');
}

/** Legacy dotted display id (file_meta → file.meta) — best-effort for simple ids */
export function toLegacyToolId(toolId: string): string {
  const id = toolId.trim();
  if (id.includes('.')) return id;
  // plugin_file_manager_list → plugin.file_manager.list
  if (id.startsWith('plugin_')) {
    const rest = id.slice('plugin_'.length);
    const parts = rest.split('_');
    if (parts.length >= 2) {
      const action = parts.pop()!;
      const plugin = parts.join('_');
      return `plugin.${plugin}.${action}`;
    }
  }
  const idx = id.indexOf('_');
  if (idx > 0) {
    return `${id.slice(0, idx)}.${id.slice(idx + 1)}`;
  }
  return id;
}

/** Compare two tool ids regardless of dot/underscore convention */
export function toolIdsEqual(a: string, b: string): boolean {
  return toApiToolId(a) === toApiToolId(b);
}

/** Build execute endpoint path for a tool */
export function toolExecutePath(toolId: string): string {
  return `/tools/${encodeURIComponent(toApiToolId(toolId))}/execute`;
}

/** Build info endpoint path for a tool */
export function toolInfoPath(toolId: string): string {
  return `/tools/${encodeURIComponent(toApiToolId(toolId))}`;
}

/** URL slug for plugin pages (hyphenated) */
export function toolIdToSlug(toolId: string): string {
  return toApiToolId(toolId).replace(/_/g, '-');
}

/** Resolve slug/hyphen/dotted/underscore back to API tool id */
export function slugToApiToolId(slug: string): string {
  return toApiToolId(slug.replace(/-/g, '_'));
}
