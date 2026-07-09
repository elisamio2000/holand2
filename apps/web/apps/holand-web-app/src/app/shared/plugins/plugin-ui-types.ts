// ============================================
// Plugin UI Types — قرارداد مشترک همه Plugin UI Component ها
//
// هر renderer باید این interface را پیاده‌سازی کند.
// این contract تضمین می‌کند که هر plugin UI
// در هر context (صفحه مستقل، modal، sidebar چت)
// به شکل یکسانی قابل استفاده باشد.
// ============================================

import type { PluginRunResult } from '@/types/plugins.types';

// ==========================================
// Core Contract
// ==========================================

/**
 * قرارداد مشترک همه Plugin UI Component ها.
 *
 * هر component که از این interface پشتیبانی کند می‌تواند:
 * - در صفحه مستقل /tools/[id] نمایش داده شود
 * - داخل یک Modal باز شود
 * - در sidebar چت به عنوان inline result نشان داده شود
 * - در chat history به صورت read-only نمایش یابد
 */
export interface PluginUIProps {
  /** شناسه پلاگین (e.g., "image.ocr", "file.meta") */
  pluginId: string;

  /**
   * نتیجه آخرین اجرا.
   * null یعنی هنوز اجرا نشده یا در حال اجراست.
   */
  result: PluginRunResult | null;

  /** آیا در حال اجرا هست — برای نمایش loading state */
  isRunning: boolean;

  /**
   * حالت فقط خواندنی.
   * true: هیچ عملیات جدیدی نمی‌توان انجام داد (مناسب chat history)
   * false (default): کاربر می‌تواند فایل جدید بدهد یا دوباره اجرا کند
   */
  readOnly?: boolean;

  /**
   * فراخوانی اجرای پلاگین با آرگومان‌های جدید.
   * parent این callback را از backend service می‌آورد.
   */
  onRun: (args: Record<string, unknown>) => Promise<void>;

  /**
   * ارسال متن/نتیجه به chat session جاری.
   * اگر undefined باشد، دکمه "ارسال به چت" نشان داده نمی‌شود.
   */
  onSendToChat?: (content: PluginChatPayload) => void;

  /**
   * callback برای copy به clipboard.
   * اگر provide نشود، component از navigator.clipboard استفاده می‌کند.
   */
  onCopy?: (text: string) => void;

  /** کلاس CSS اضافی برای root element */
  className?: string;
}

// ==========================================
// Chat Integration
// ==========================================

/**
 * محتوایی که از plugin به chat session ارسال می‌شود.
 */
export interface PluginChatPayload {
  /** متن خلاصه برای نمایش در چت */
  summary: string;
  /** متن کامل خروجی (مثلاً متن OCR شده) */
  fullText?: string;
  /** نوع محتوا — برای نمایش مناسب در chat bubble */
  contentType: 'text' | 'markdown' | 'json' | 'ocr_result';
  /** metadata اضافی */
  meta?: Record<string, unknown>;
}

// ==========================================
// File Input Contract
// ==========================================

/**
 * فایل آپلود شده موقت.
 * بعد از upload-temp endpoint این object برمی‌گردد.
 */
export interface TempUploadedFile {
  /** مسیر موقت سمت سرور */
  tempPath: string;
  /** نام اصلی فایل */
  originalName: string;
  /** اندازه به بایت */
  sizeBytes: number;
  /** MIME type */
  mimeType: string;
  /** زمان انقضا */
  expiresAt?: string;
  /** preview URL برای نمایش preview تصویر */
  previewUrl?: string;
}

// ==========================================
// Engine Status (مشترک بین OCR و سایر multi-engine tool ها)
// ==========================================

export type EngineStatus = 'available' | 'disabled' | 'not_installed' | 'init_failed';

export interface EngineInfo {
  name: string;
  display_name: string;
  status: EngineStatus;
  speed_rank: number;
  accuracy_rank: number;
  languages?: string[];
  error?: string | null;
}

// ==========================================
// Generic Result Channel Types
// ==========================================

/**
 * ساختار استاندارد ok/data که backend برمی‌گرداند.
 */
export interface StandardPluginResponse<T = Record<string, unknown>> {
  ok: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
  timings_ms?: Record<string, number>;
}

// ==========================================
// Registry Types
// ==========================================

/**
 * متادیتای یک renderer در registry.
 * برای نمایش اطلاعات در plugin marketplace استفاده می‌شود.
 */
export interface PluginRendererMeta {
  /** شناسه پلاگین */
  pluginId: string;
  /** نام نمایشی فارسی */
  displayName: string;
  /** آیکون (Phosphor icon name) */
  icon?: string;
  /** دسته‌بندی */
  category?: string;
  /** آیا native renderer دارد (در مقابل generic fallback) */
  hasNativeUI: boolean;
}
