// ============================================
// Tool Result Renderers Registry
// Maps tool IDs to their respective renderer components
// ============================================

import type { ComponentType } from 'react';
import FileMetaRenderer from './file-meta-renderer';

/**
 * Type for tool renderer components.
 * All renderers receive the tool result data and display it appropriately.
 */
export type ToolRenderer = ComponentType<{ result: Record<string, any> }>;

/**
 * Registry of tool renderers.
 * Maps tool_id → Renderer component.
 *
 * To add a new tool renderer:
 * 1. Create a new renderer component in this folder (e.g., image-ocr-renderer.tsx)
 * 2. Import it here
 * 3. Add it to the TOOL_RENDERERS map
 */
export const TOOL_RENDERERS: Record<string, ToolRenderer> = {
  'file.meta': FileMetaRenderer,
  // Add more tool renderers here:
  // 'image.meta': ImageMetaRenderer,
  // 'image.ocr': ImageOcrRenderer,
  // 'text.search': TextSearchRenderer,
  // 'audio.transcribe': AudioTranscribeRenderer,
};

/**
 * Get the appropriate renderer for a tool.
 *
 * @param toolId - The tool identifier (e.g., "file.meta")
 * @returns The renderer component, or null if no renderer is registered
 */
export function getToolRenderer(toolId: string): ToolRenderer | null {
  return TOOL_RENDERERS[toolId] || null;
}
