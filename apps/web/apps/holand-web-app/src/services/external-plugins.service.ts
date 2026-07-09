// ============================================
// External Plugins Service
// Handles local plugins from D:\UI_V4_1\UI_V4_1\Plugins
// These plugins run via Plugin Executor Server
// ============================================

import type {
  ExternalPluginInfo,
  ExternalPluginInput,
  ExternalPluginBatchResult,
} from '@/types/plugins.types';
import { PLUGIN_EXECUTOR_PROXY_BASE } from '@/lib/service-urls';

// ==========================================
// Configuration
// ==========================================

/** Same-origin proxy — PLUGIN_EXECUTOR_URL is server-side only (check-and-run.ps1). */
const EXECUTOR_BASE_URL = PLUGIN_EXECUTOR_PROXY_BASE;

/**
 * Static list of external plugins.
 * In future, this will be fetched from Plugin Executor Server.
 *
 * NOTE: Each plugin corresponds to a folder in Plugins/
 */
const EXTERNAL_PLUGINS: ExternalPluginInfo[] = [
  {
    id: 'file.meta',
    name: 'استخراج متادیتای یونیورسال',
    name_en: 'Universal Metadata Extraction',
    description: 'استخراج متادیتای جامع از هر نوع فایل: تصاویر، صوت، ویدیو، اسناد، آرشیوها. منبع مرجع GPS.',
    description_en: 'Universal metadata extraction from any file: images, audio, video, documents, archives. Canonical GPS source.',
    version: '2.5.0',
    updated_at: '2026-01-05',
    category: 'general',
    capabilities: [
      'universal_metadata',
      'canonical_gps_source',
      'exif_extraction',
      'audio_metadata',
      'video_metadata',
      'document_metadata',
      'archive_inspection',
    ],
    mime_types: ['image/*', 'video/*', 'audio/*', 'application/pdf', 'application/zip'],
    supported_formats: [
      'Images: JPEG, PNG, GIF, WebP, HEIC',
      'Audio: MP3, WAV, FLAC, M4A',
      'Video: MP4, MKV, MOV, AVI',
      'Documents: PDF, DOCX, XLSX',
      'Archives: ZIP, TAR, RAR, 7z',
    ],
    has_ui: true,
    ui_path: 'ui/index.html',
    folder_path: 'D:\\UI_V4_1\\UI_V4_1\\Plugins\\file.meta',
    is_available: true,
  },
  {
    id: 'file.secure',
    name: 'تحلیل امنیتی فایل',
    name_en: 'File Security Analysis',
    description: 'تحلیل امنیتی فایل شامل هش‌ها، entropy، YARA، binwalk و تشخیص داده‌های پنهان.',
    description_en: 'File security analysis including hashes, entropy, YARA, binwalk, and hidden data detection.',
    version: '2.0.0',
    category: 'security',
    capabilities: ['hash_calculation', 'entropy_analysis', 'yara_scan', 'binwalk_analysis'],
    mime_types: ['*/*'],
    has_ui: false,
    folder_path: 'D:\\UI_V4_1\\UI_V4_1\\Plugins\\file.secure',
    is_available: true,
  },
  {
    id: 'image.describe',
    name: 'توصیف تصویر با AI',
    name_en: 'AI Image Description',
    description: 'توصیف محتوای تصویر با استفاده از مدل‌های هوش مصنوعی.',
    description_en: 'Describe image content using AI models.',
    version: '1.5.0',
    category: 'image',
    capabilities: ['image_captioning', 'scene_detection', 'object_detection'],
    mime_types: ['image/jpeg', 'image/png', 'image/webp'],
    has_ui: true,
    ui_path: 'ui/index.html',
    folder_path: 'D:\\UI_V4_1\\UI_V4_1\\Plugins\\image.describe',
    is_available: true,
  },
  {
    id: 'image.ocr',
    name: 'تشخیص متن از تصویر',
    name_en: 'Image OCR',
    description: 'استخراج متن از تصاویر با پشتیبانی فارسی و انگلیسی.',
    description_en: 'Extract text from images with Persian and English support.',
    version: '2.0.0',
    category: 'image',
    capabilities: ['ocr', 'persian_ocr', 'english_ocr', 'handwriting'],
    mime_types: ['image/jpeg', 'image/png', 'image/tiff'],
    has_ui: true,
    ui_path: 'ui/index.html',
    folder_path: 'D:\\UI_V4_1\\UI_V4_1\\Plugins\\image.ocr',
    is_available: true,
  },
  {
    id: 'image.faces',
    name: 'تشخیص چهره',
    name_en: 'Face Detection',
    description: 'تشخیص و استخراج چهره‌ها از تصاویر.',
    description_en: 'Detect and extract faces from images.',
    version: '1.8.0',
    category: 'image',
    capabilities: ['face_detection', 'face_extraction', 'face_landmarks'],
    mime_types: ['image/jpeg', 'image/png'],
    has_ui: true,
    ui_path: 'ui/index.html',
    folder_path: 'D:\\UI_V4_1\\UI_V4_1\\Plugins\\image.faces',
    is_available: true,
  },
  {
    id: 'audio.transcribe',
    name: 'تبدیل صدا به متن',
    name_en: 'Audio Transcription',
    description: 'تبدیل فایل‌های صوتی به متن با پشتیبانی فارسی.',
    description_en: 'Convert audio files to text with Persian support.',
    version: '1.5.0',
    category: 'audio',
    capabilities: ['speech_to_text', 'persian_transcription', 'english_transcription'],
    mime_types: ['audio/wav', 'audio/mp3', 'audio/m4a', 'audio/flac'],
    has_ui: false,
    folder_path: 'D:\\UI_V4_1\\UI_V4_1\\Plugins\\audio.transcribe',
    is_available: true,
  },
  {
    id: 'text.search',
    name: 'جستجوی متن',
    name_en: 'Text Search',
    description: 'جستجوی متن کامل با پشتیبانی فارسی و ranking.',
    description_en: 'Full-text search with Persian support and ranking.',
    version: '1.2.0',
    category: 'text',
    capabilities: ['full_text_search', 'persian_search', 'ranking'],
    mime_types: ['text/*', 'application/json'],
    has_ui: false,
    folder_path: 'D:\\UI_V4_1\\UI_V4_1\\Plugins\\text.search',
    is_available: true,
  },
  {
    id: 'analysis.geo_location',
    name: 'تحلیل موقعیت جغرافیایی',
    name_en: 'Geo Location Analysis',
    description: 'تحلیل موقعیت جغرافیایی از GPS، آدرس، یا نقشه.',
    description_en: 'Analyze geographic location from GPS, address, or map.',
    version: '1.0.0',
    category: 'analysis',
    capabilities: ['gps_analysis', 'reverse_geocoding', 'map_visualization'],
    mime_types: [],
    has_ui: true,
    ui_path: 'ui/index.html',
    folder_path: 'D:\\UI_V4_1\\UI_V4_1\\Plugins\\analysis.geo_location',
    is_available: true,
  },
];

// ==========================================
// Service Methods
// ==========================================

export const externalPluginsService = {
  // ==========================================
  // Plugin Discovery
  // ==========================================

  /**
   * Get list of all external plugins.
   * Tries Plugin Executor Server first, falls back to static list if unavailable.
   *
   * @endpoint GET {EXECUTOR_BASE_URL}/plugins (dynamic)
   * @returns Array of external plugin info
   */
  async listPlugins(): Promise<ExternalPluginInfo[]> {
    console.info('[ExternalPluginsService] Listing external plugins...');

    // WHY dynamic-first: The static list may become outdated as new plugins are
    // installed on the executor server. Fetching dynamically ensures the UI always
    // reflects the actual available plugins.
    try {
      const res = await fetch(`${EXECUTOR_BASE_URL}/plugins`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const dynamicPlugins = (await res.json()) as ExternalPluginInfo[];
        if (Array.isArray(dynamicPlugins) && dynamicPlugins.length > 0) {
          console.info('[ExternalPluginsService] Plugins loaded from executor:', {
            count: dynamicPlugins.length,
          });
          return dynamicPlugins;
        }
      }
    } catch {
      console.warn('[ExternalPluginsService] Executor unreachable, using static fallback');
    }

    // Fallback to static list when executor is unavailable
    console.info('[ExternalPluginsService] Using static plugin list:', {
      count: EXTERNAL_PLUGINS.length,
    });

    return EXTERNAL_PLUGINS;
  },

  /**
   * Get external plugin by ID.
   *
   * @param pluginId Plugin identifier
   * @returns Plugin info or null if not found
   */
  async getPlugin(pluginId: string): Promise<ExternalPluginInfo | null> {
    console.info('[ExternalPluginsService] Getting plugin:', { pluginId });

    const plugin = EXTERNAL_PLUGINS.find((p) => p.id === pluginId);

    if (!plugin) {
      console.warn('[ExternalPluginsService] Plugin not found:', { pluginId });
      return null;
    }

    return plugin;
  },

  /**
   * Get unique categories from external plugins.
   *
   * @returns Array of category names
   */
  async listCategories(): Promise<string[]> {
    const plugins = await this.listPlugins();
    const categories = Array.from(
      new Set(plugins.map((p) => p.category).filter((c): c is string => Boolean(c)))
    );
    console.info('[ExternalPluginsService] Categories:', { categories });
    return categories;
  },

  // ==========================================
  // Plugin Execution
  // ==========================================

  /**
   * Run external plugin on a single file.
   *
   * @param pluginId Plugin identifier
   * @param file File to process
   * @param options Additional options (session_id, engine, lang, etc.)
   * @returns Plugin result
   */
  async runPlugin(
    pluginId: string,
    file: File,
    options?: Record<string, string>
  ): Promise<unknown> {
    console.info('[ExternalPluginsService] Running plugin:', {
      pluginId,
      filename: file.name,
      size: file.size,
      options,
    });

    const formData = new FormData();
    formData.append('file', file);
    
    // Append all options as form fields
    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    try {
      const res = await fetch(`${EXECUTOR_BASE_URL}/plugins/${pluginId}/run`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Plugin execution failed: ${res.status}`);
      }

      const result = await res.json() as { status?: string };
      console.info('[ExternalPluginsService] Plugin result:', {
        pluginId,
        status: result.status || 'ok',
      });

      return result;
    } catch (error: unknown) {
      console.error('[ExternalPluginsService] Plugin execution failed:', {
        pluginId,
        error,
      });
      throw error;
    }
  },

  /**
   * Run external plugin on multiple files (batch mode).
   * Returns a ReadableStream for progress updates.
   *
   * @param pluginId Plugin identifier
   * @param input Input configuration
   * @returns Async generator of progress events
   */
  async *runBatch(
    pluginId: string,
    input: ExternalPluginInput
  ): AsyncGenerator<{
    type: 'progress' | 'result' | 'complete' | 'error';
    data: unknown;
  }> {
    console.info('[ExternalPluginsService] Starting batch processing:', {
      pluginId,
      mode: input.mode,
      fileCount: input.files?.length,
    });

    const formData = new FormData();
    formData.append('mode', input.mode);
    formData.append('recursive', String(input.recursive ?? true));

    if (input.mode === 'upload' && input.files) {
      input.files.forEach((f) => formData.append('files', f));
    } else if (input.mode === 'directory' && input.directoryPath) {
      formData.append('directory', input.directoryPath);
    } else if (input.mode === 'api' && input.apiUrl) {
      formData.append('api_source', input.apiUrl);
      if (input.apiHeaders) {
        formData.append('api_headers', JSON.stringify(input.apiHeaders));
      }
    }

    try {
      const res = await fetch(`${EXECUTOR_BASE_URL}/plugins/${pluginId}/batch`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Batch execution failed: ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value).split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const event = JSON.parse(line) as {
              type: 'progress' | 'result' | 'complete' | 'error';
              data: unknown;
            };
            yield event;
          } catch {
            console.warn('[ExternalPluginsService] Invalid JSON line:', line);
          }
        }
      }
    } catch (error: unknown) {
      console.error('[ExternalPluginsService] Batch execution failed:', error);
      yield {
        type: 'error',
        data: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  },

  // ==========================================
  // Export Functions
  // ==========================================

  /**
   * Export results to CSV.
   *
   * @param results Array of results
   * @returns CSV blob
   */
  async exportToCsv(results: unknown[]): Promise<Blob> {
    console.info('[ExternalPluginsService] Exporting to CSV:', {
      count: results.length,
    });

    const res = await fetch(`${EXECUTOR_BASE_URL}/export/csv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results }),
    });

    if (!res.ok) {
      throw new Error(`CSV export failed: ${res.status}`);
    }

    return res.blob();
  },

  /**
   * Export results to SQLite database.
   *
   * @param results Array of results
   * @returns SQLite database blob
   */
  async exportToSqlite(results: unknown[]): Promise<Blob> {
    console.info('[ExternalPluginsService] Exporting to SQLite:', {
      count: results.length,
    });

    const res = await fetch(`${EXECUTOR_BASE_URL}/export/sqlite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results }),
    });

    if (!res.ok) {
      throw new Error(`SQLite export failed: ${res.status}`);
    }

    return res.blob();
  },

  /**
   * Send results to an API endpoint.
   *
   * @param results Array of results
   * @param endpoint API endpoint URL
   * @param method HTTP method
   * @returns API response
   */
  async sendToApi(
    results: unknown[],
    endpoint: string,
    method: 'POST' | 'PUT' = 'POST'
  ): Promise<unknown> {
    console.info('[ExternalPluginsService] Sending to API:', {
      count: results.length,
      endpoint,
      method,
    });

    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results }),
    });

    if (!res.ok) {
      throw new Error(`API send failed: ${res.status}`);
    }

    return res.json();
  },

  // ==========================================
  // Helper Functions
  // ==========================================

  /**
   * Filter plugins by category.
   *
   * @param plugins Array of plugins
   * @param category Category to filter by
   * @returns Filtered plugins
   */
  filterByCategory(plugins: ExternalPluginInfo[], category: string): ExternalPluginInfo[] {
    return plugins.filter((p) => p.category === category);
  },

  /**
   * Search plugins by name or description.
   *
   * @param plugins Array of plugins
   * @param query Search query
   * @returns Filtered plugins
   */
  searchPlugins(plugins: ExternalPluginInfo[], query: string): ExternalPluginInfo[] {
    const lowerQuery = query.toLowerCase();
    return plugins.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.description.toLowerCase().includes(lowerQuery) ||
        p.id.toLowerCase().includes(lowerQuery) ||
        (p.name_en && p.name_en.toLowerCase().includes(lowerQuery)) ||
        (p.description_en && p.description_en.toLowerCase().includes(lowerQuery)) ||
        (p.capabilities && p.capabilities.some((c) => c.toLowerCase().includes(lowerQuery)))
    );
  },

  /**
   * Get color for category badge.
   *
   * @param category Category name
   * @returns Badge color
   */
  getCategoryColor(category: string): 'primary' | 'info' | 'success' | 'warning' | 'danger' {
    const colorMap: Record<string, 'primary' | 'info' | 'success' | 'warning' | 'danger'> = {
      general: 'primary',
      image: 'info',
      audio: 'success',
      text: 'warning',
      security: 'danger',
      analysis: 'primary',
    };
    return colorMap[category] || 'primary';
  },

  /**
   * Check if Plugin Executor Server is running.
   *
   * @returns True if server is running
   */
  async isExecutorAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${EXECUTOR_BASE_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};

export default externalPluginsService;
