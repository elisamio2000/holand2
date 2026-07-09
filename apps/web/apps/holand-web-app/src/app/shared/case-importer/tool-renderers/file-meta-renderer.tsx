// ============================================
// FileMetaRenderer — Adapter for case-importer context
//
// WHY adapter: Bridges case-importer ToolRenderer interface
// ({ result: Record<string,any> }) with the plugin system's
// canonical FileMetaRenderer (PluginUIProps).
// This prevents duplication — the full renderer lives in
// shared/plugins/renderers/file-meta/ and is the single source of truth.
// ============================================

'use client';

import PluginRenderer from '@/app/shared/plugins/plugin-renderer';
import type { PluginRunResult } from '@/types/plugins.types';

/**
 * FileMetaRenderer — Case-importer adapter for file.meta plugin renderer.
 *
 * Converts case-importer's simple `{ result }` prop into the plugin
 * system's PluginUIProps format, then delegates to the canonical
 * PluginRenderer in readOnly mode.
 *
 * WHY adapter pattern: The canonical FileMetaRenderer in
 * shared/plugins/renderers/file-meta/ has full functionality
 * (EXIF, GPS map, audio, video, archive, etc.). This adapter
 * reuses it instead of maintaining a separate simplified copy.
 *
 * @param result - Raw tool result from case-importer backend
 */
export default function FileMetaRenderer({ result }: { result: Record<string, any> }) {
  // Convert case-importer result format → PluginRunResult envelope
  const pluginResult: PluginRunResult = {
    tool_id: 'file.meta',
    status: 'success',
    data: result?.data ?? result,
    warnings: result?.warnings,
  };

  return (
    <PluginRenderer
      pluginId="file.meta"
      result={pluginResult}
      isRunning={false}
      readOnly
      onRun={async () => {}}
    />
  );
}
