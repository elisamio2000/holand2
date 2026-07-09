// ============================================
// Plugin UI Registry — نگاشت plugin ID به React Component
//
// هر پلاگین می‌تواند یک native renderer داشته باشد یا
// به generic fallback سقوط کند.
//
// چرا lazy()؟ چون:
// - هر renderer می‌تواند صدها KB bundle داشته باشد
// - در صفحه plugin marketplace نباید همه load شوند
// - Next.js code splitting به صورت خودکار chunk می‌سازد
// ============================================
import { lazy, type ComponentType } from 'react';
import type { PluginUIProps, PluginRendererMeta } from './plugin-ui-types';
import { toApiToolId, toolIdsEqual } from '@/utils/tool-id';

// ==========================================
// Lazy Renderers
// ==========================================

/**
 * OCR Renderer — تشخیص متن از تصویر
 * Capabilities: multi-engine, RTL, confidence, bbox overlay
 */
const OcrRenderer = lazy(() => import('./renderers/ocr'));

/**
 * File.Meta Renderer — استخراج متادیتای یونیورسال از فایل
 * Capabilities: EXIF, GPS, audio tags, video streams, archive preview
 */
const FileMetaRenderer = lazy(() => import('./renderers/file-meta'));

/**
 * Generic Fallback — برای پلاگین‌های بدون native UI
 * نمایش JSON + form ورودی ساده
 */
const GenericRenderer = lazy(() => import('./generic/generic-plugin-ui'));

// ==========================================
// Registry Map
// ==========================================

type RendererEntry = {
  component: ComponentType<PluginUIProps>;
  meta: PluginRendererMeta;
};

const REGISTRY = new Map<string, RendererEntry>([
  [
    'image_ocr',
    {
      component: OcrRenderer,
      meta: {
        pluginId: 'image_ocr',
        displayName: 'تشخیص متن از تصویر',
        icon: 'PiTextTBold',
        category: 'image',
        hasNativeUI: true,
      },
    },
  ],
  [
    'file_meta',
    {
      component: FileMetaRenderer,
      meta: {
        pluginId: 'file_meta',
        displayName: 'استخراج متادیتای فایل',
        icon: 'PiFileBold',
        category: 'file',
        hasNativeUI: true,
      },
    },
  ],
  // ---- پلاگین‌های بعدی اینجا اضافه می‌شوند ----
  // ['image.meta', { component: lazy(() => import('./renderers/image-meta')), meta: {...} }],
  // ['audio.transcribe', { component: lazy(() => import('./renderers/audio-transcribe')), meta: {...} }],
]);

// ==========================================
// Public API
// ==========================================

/**
 * دریافت component مناسب برای یک plugin ID.
 *
 * اگر plugin ID در registry نباشد، GenericRenderer برمی‌گردد.
 * این تضمین می‌کند هیچ پلاگینی بدون UI رها نمی‌شود.
 *
 * @example
 * const Renderer = getPluginRenderer('image.ocr');
 * <Renderer pluginId="image.ocr" result={result} onRun={handleRun} isRunning={false} />
 */
function resolveRegistryEntry(pluginId: string): RendererEntry | undefined {
  const direct = REGISTRY.get(pluginId);
  if (direct) return direct;
  const apiId = toApiToolId(pluginId);
  if (REGISTRY.has(apiId)) return REGISTRY.get(apiId);
  for (const [key, entry] of REGISTRY.entries()) {
    if (toolIdsEqual(key, pluginId)) return entry;
  }
  return undefined;
}

export function getPluginRenderer(pluginId: string): ComponentType<PluginUIProps> {
  return resolveRegistryEntry(pluginId)?.component ?? GenericRenderer;
}

export function getPluginRendererMeta(pluginId: string): PluginRendererMeta | null {
  return resolveRegistryEntry(pluginId)?.meta ?? null;
}

export function hasNativeRenderer(pluginId: string): boolean {
  return resolveRegistryEntry(pluginId) !== undefined;
}

/**
 * لیست تمام پلاگین‌هایی که native renderer دارند.
 * برای نمایش badge "دارای UI اختصاصی" در marketplace استفاده می‌شود.
 */
export function listNativeRenderers(): PluginRendererMeta[] {
  return Array.from(REGISTRY.values()).map((entry) => entry.meta);
}

/**
 * ثبت یک renderer جدید در runtime.
 * برای plugin systems قابل توسعه — در حال حاضر برای تست استفاده می‌شود.
 */
export function registerRenderer(
  pluginId: string,
  component: ComponentType<PluginUIProps>,
  meta: Omit<PluginRendererMeta, 'pluginId'>
): void {
  REGISTRY.set(pluginId, {
    component,
    meta: { ...meta, pluginId },
  });
}
