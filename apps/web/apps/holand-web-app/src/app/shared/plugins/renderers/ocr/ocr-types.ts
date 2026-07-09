// ============================================
// OCR Types — تایپ‌های اختصاصی پلاگین image.ocr
//
// این تایپ‌ها بر اساس ساختار واقعی خروجی tool.py (v3.0.2)
// و engine_results تعریف شده‌اند.
// ============================================

import type { EngineInfo } from '../../plugin-ui-types';

// ==========================================
// Word / BBox
// ==========================================

/**
 * یک نقطه در فضای 2D
 */
export type BBoxPoint = [number, number];

/**
 * یک کلمه تشخیص داده شده با موقعیت و confidence
 */
export interface OcrWord {
  text: string;
  confidence: number;
  /** [[x1,y1],[x2,y2],[x3,y3],[x4,y4]] — چهار گوشه */
  bbox: BBoxPoint[];
  engine: string;
}

// ==========================================
// Engine Result
// ==========================================

/**
 * نتیجه یک موتور OCR به صورت مجزا
 */
export interface OcrEngineResult {
  engine: string;
  engine_display: string;
  success: boolean;
  text: string;
  words: OcrWord[];
  confidence_avg: number;
  duration_ms: number;
  error?: string | null;
  char_count: number;
  word_count: number;
}

// ==========================================
// Language Info
// ==========================================

export interface OcrLanguageMap {
  tesseract?: string;
  easyocr?: string[];
  paddle?: string;
  rapidocr?: string;
}

// ==========================================
// Main OCR Data (ساختار data در response)
// ==========================================

/**
 * ساختار کامل data که backend برمی‌گرداند.
 * بر اساس تحلیل tool.py — تابع run()
 */
export interface OcrResultData {
  /** مسیر فایل پردازش شده */
  filepath?: string;
  /** متن اصلی (از primary engine) */
  text: string;
  /** آیا متنی پیدا شد */
  has_text: boolean;
  /** تعداد کاراکتر */
  char_count: number;
  /** تعداد کلمه */
  word_count: number;
  /** میانگین confidence */
  confidence_avg: number;
  /** موتور اصلی (e.g., "tesseract:fas") */
  primary_engine: string;
  /** نام نمایشی موتور اصلی */
  primary_engine_display: string;
  /** کلمات با bbox */
  words: OcrWord[];
  /** نتایج تمام موتورهای اجرا شده */
  engine_results: OcrEngineResult[];
  /** وضعیت تمام موتورها */
  engines_available: Record<string, EngineInfo>;
  /** ترتیب اجرای موتورها */
  engine_order: string[];
  /** تنظیمات زبانی */
  languages: OcrLanguageMap;
  /** زبان تشخیص داده شده */
  detected_language?: string;
}

/**
 * Response کامل از API
 */
export interface OcrApiResponse {
  ok: boolean;
  data?: OcrResultData;
  error?: string;
  warnings?: string[];
  timings_ms?: Record<string, number>;
}

// ==========================================
// UI State
// ==========================================

/** موتورهای قابل انتخاب توسط کاربر */
export type OcrEngineKey = 'rapidocr' | 'easyocr' | 'tesseract' | 'paddle' | 'speed' | 'accuracy';

/** تنظیمات انتخاب کاربر */
export interface OcrUserSettings {
  engine: OcrEngineKey | null;
  languages: string[];
}

/** ابعاد تصویر برای bbox canvas */
export interface ImageDimensions {
  width: number;
  height: number;
  displayWidth: number;
  displayHeight: number;
}

// ==========================================
// Helpers
// ==========================================

/**
 * تبدیل bbox چهار نقطه‌ای به xywh
 */
export function bboxToRect(pts: BBoxPoint[]): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  if (!pts || pts.length < 2) return { x: 0, y: 0, w: 0, h: 0 };
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const w = Math.max(...xs) - x;
  const h = Math.max(...ys) - y;
  return { x, y, w, h };
}

/**
 * رنگ confidence:
 * >= 0.85 → green
 * >= 0.60 → amber
 * < 0.60  → red
 */
export function getConfidenceColor(
  conf: number
): 'success' | 'warning' | 'danger' {
  if (conf >= 0.85) return 'success';
  if (conf >= 0.6) return 'warning';
  return 'danger';
}

/**
 * درصد confidence با یک رقم اعشار
 */
export function formatConfidence(conf: number | null | undefined): string {
  if (conf == null || isNaN(conf)) return '—';
  return `${Math.round(conf * 100)}%`;
}

/**
 * فرمت زمان millisecond به خوانا
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * آیکون و label موتور OCR
 */
export const ENGINE_META: Record<
  string,
  { label: string; icon: string; colorClass: string }
> = {
  rapidocr: {
    label: 'RapidOCR',
    icon: '⚡',
    colorClass: 'text-green-600 dark:text-green-400',
  },
  easyocr: {
    label: 'EasyOCR',
    icon: '👁️',
    colorClass: 'text-purple-600 dark:text-purple-400',
  },
  tesseract: {
    label: 'Tesseract',
    icon: '🔤',
    colorClass: 'text-blue-600 dark:text-blue-400',
  },
  paddle: {
    label: 'PaddleOCR',
    icon: '🚣',
    colorClass: 'text-orange-600 dark:text-orange-400',
  },
  user_edit: {
    label: 'ویرایش دستی',
    icon: '✏️',
    colorClass: 'text-primary',
  },
};

export function getEngineMeta(engineKey: string) {
  const base = engineKey.split(':')[0];
  return ENGINE_META[base] ?? { label: engineKey, icon: '🔧', colorClass: '' };
}
