// ============================================
// File.Meta Plugin — Type Definitions
//
// تعاریف نوع مربوط به پلاگین file.meta
// بر اساس خروجی tool.py (channels: ui, llm, metadata, rawdata, embed)
// ============================================

// ==========================================
// GPS Location
// ==========================================

/**
 * اطلاعات مکان جغرافیایی استخراج شده از EXIF، تگ‌های صوت یا PDF.
 */
export interface GpsLocation {
  /** عرض جغرافیایی */
  latitude: number;
  /** طول جغرافیایی */
  longitude: number;
  /** ارتفاع (متر) - اختیاری */
  altitude?: number;
  /** منبع GPS: "exif", "audio_tag", "ffprobe", "pdf", "unknown" */
  source: string;
}

// ==========================================
// Image Metadata
// ==========================================

/**
 * متادیتای تصویر (EXIF + ExifTool).
 */
export interface ImageMetadata {
  /** عرض تصویر (پیکسل) */
  width?: number;
  /** ارتفاع تصویر (پیکسل) */
  height?: number;
  /** فرمت فایل */
  format?: string;
  /** حالت رنگی */
  mode?: string;
  /** جهت تصویر (0-8) */
  orientation?: number;
  /** مارک دوربین */
  camera_make?: string;
  /** مدل دوربین */
  camera_model?: string;
  /** نرم‌افزار ویرایشگر */
  software?: string;
  /** تاریخ گرفتن عکس */
  date_taken?: string;
  /** اطلاعات GPS */
  gps?: GpsLocation;
  /** EXIF خام */
  exif_raw?: Record<string, unknown>;
  /** ExifTool پیشرفته */
  exiftool?: Record<string, unknown>;
  /** آیا ویرایش شده */
  is_edited?: boolean;
  /** مدل لنز (از ExifTool) */
  lens_model?: string;
  /** شماره سریال دوربین (از ExifTool) */
  serial_number?: string;
  /** شمارش شاتر (از ExifTool) */
  shutter_count?: number;
  /** حالت فوکوس (از ExifTool) */
  focus_mode?: string;
  /** MakerNotes (اطلاعات سازنده) */
  maker_notes?: Record<string, unknown>;
  /** XMP (Adobe Metadata) */
  xmp?: Record<string, unknown>;
  /** IPTC (اطلاعات خبرنگاری) */
  iptc?: Record<string, unknown>;
}

// ==========================================
// Audio Metadata
// ==========================================

/**
 * متادیتای صوتی (mutagen + ffprobe).
 */
export interface AudioMetadata {
  /** مدت زمان (ثانیه) */
  duration?: number;
  /** نرخ بیت (kbps) */
  bitrate?: number;
  /** نرخ نمونه‌برداری (Hz) */
  sample_rate?: number;
  /** تعداد کانال‌ها */
  channels?: number;
  /** Codec صوتی */
  codec?: string;
  /** عنوان */
  title?: string;
  /** داده خام ffprobe */
  probe?: Record<string, unknown>;
  /** هنرمند */
  artist?: string;
  /** آلبوم */
  album?: string;
  /** ژانر */
  genre?: string;
  /** سال */
  year?: string;
  /** شماره قطعه */
  track?: string;
  /** اطلاعات GPS (از تگ‌های صوت) */
  gps?: GpsLocation;
  /** تگ‌های خام */
  tags_raw?: Record<string, unknown>;
}

// ==========================================
// Video Metadata
// ==========================================

/**
 * متادیتای ویدیویی (ffprobe).
 */
export interface VideoMetadata {
  /** مدت زمان (ثانیه) */
  duration?: number;
  /** عرض ویدیو */
  width?: number;
  /** ارتفاع ویدیو */
  height?: number;
  /** نرخ فریم (fps) */
  fps?: number;
  /** Codec ویدیو */
  video_codec?: string;
  /** Codec صوتی */
  audio_codec?: string;
  /** نرخ بیت (kbps) */
  bitrate?: number;
  /** اطلاعات GPS (از ffprobe) */
  gps?: GpsLocation;
  /** استریم‌های خام */
  streams?: Record<string, unknown>[];
}

// ==========================================
// Document Metadata
// ==========================================

/**
 * متادیتای اسناد (PDF, DOCX, PPTX, XLSX, EPUB).
 */
export interface DocumentMetadata {
  /** نوع سند */
  document_type?: 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'epub' | 'unknown';
  /** تعداد صفحات */
  page_count?: number;
  /** نویسنده */
  author?: string;
  /** عنوان */
  title?: string;
  /** موضوع */
  subject?: string;
  /** تاریخ ایجاد */
  created?: string;
  /** تاریخ تغییر */
  modified?: string;
  /** نرم‌افزار سازنده */
  creator?: string;
  /** آیا رمزگذاری شده */
  is_encrypted?: boolean;
  /** اطلاعات GPS (از PDF) */
  gps?: GpsLocation;
  /** متادیتای خام */
  properties?: Record<string, unknown>;
}

// ==========================================
// Archive Metadata
// ==========================================

/**
 * متادیتای آرشیو (ZIP, TAR, RAR, 7z).
 */
export interface ArchiveMetadata {
  /** نوع آرشیو */
  archive_type: 'zip' | 'tar' | 'rar' | '7z';
  /** تعداد کل فایل‌ها */
  entry_count: number;
  /** پیش‌نمایش فایل‌ها (تا 50 مورد) */
  entries_preview: ArchiveEntry[];
  /** آیا رمزگذاری شده */
  is_encrypted?: boolean;
  /** روش فشرده‌سازی */
  compression_method?: string;
}

/**
 * یک فایل داخل آرشیو.
 */
export interface ArchiveEntry {
  /** نام فایل */
  name: string;
  /** حجم (بایت) */
  size: number;
  /** آیا پوشه است */
  is_dir: boolean;
  /** تاریخ تغییر (اختیاری) */
  modified?: string;
}

// ==========================================
// SQLite Metadata
// ==========================================

/**
 * متادیتای SQLite.
 */
export interface SqliteMetadata {
  /** لیست جداول */
  tables: string[];
  /** لیست نماها */
  views: string[];
  /** تعداد جداول */
  table_count: number;
  /** نمونه تعداد سطرها */
  row_count_sample?: Record<string, number>;
}

// ==========================================
// Text Metadata
// ==========================================

/**
 * متادیتای متنی.
 */
export interface TextMetadata {
  /** encoding شناسایی شده */
  encoding?: string;
  /** تعداد خطوط */
  line_count?: number;
  /** تعداد کلمات */
  word_count?: number;
  /** تعداد کاراکتر */
  char_count?: number;
  /** آیا محتوا برش داده شده */
  truncated?: boolean;
  /** خلاصه محتوا */
  preview?: string;
}

// ==========================================
// Office Metadata
// ==========================================

/**
 * متادیتای اسناد Office (DOCX, PPTX, XLSX).
 */
export interface OfficeMetadata {
  /** نوع سند */
  doc_type?: 'word' | 'powerpoint' | 'excel' | 'unknown';
  /** عنوان */
  title?: string;
  /** موضوع */
  subject?: string;
  /** نویسنده */
  author?: string;
  /** کلمات کلیدی */
  keywords?: string;
  /** توضیحات */
  description?: string;
  /** تاریخ ایجاد */
  created?: string;
  /** تاریخ تغییر */
  modified?: string;
  /** تعداد صفحات/اسلایدها/شیت‌ها */
  page_count?: number;
  /** متادیتای خام */
  properties?: Record<string, unknown>;
}

// ==========================================
// EPUB Metadata
// ==========================================

/**
 * متادیتای کتاب الکترونیک EPUB.
 */
export interface EpubMetadata {
  /** عنوان */
  title?: string;
  /** نویسنده(ها) */
  authors?: string[];
  /** ناشر */
  publisher?: string;
  /** زبان */
  language?: string;
  /** ISBN */
  isbn?: string;
  /** تاریخ انتشار */
  published?: string;
  /** توضیحات */
  description?: string;
  /** محتویات (فصل‌ها) */
  toc?: string[];
}

// ==========================================
// Hidden Data (binwalk)
// ==========================================

/**
 * داده‌های پنهان تشخیص داده شده توسط binwalk.
 */
export interface HiddenData {
  /** تعداد کل داده‌های پنهان */
  hit_count: number;
  /** آیا مشکوک است */
  suspicious: boolean;
  /** لیست داده‌های binwalk */
  binwalk_hits?: Array<{
    offset: number;
    description: string;
  }>;
}

// ==========================================
// Main Data Structure
// ==========================================

/**
 * ساختار اصلی داده که از API برمی‌گردد.
 */
export interface FileMetaResult {
  /** نام فایل (بدون مسیر) */
  filename: string;
  /** مسیر کامل فایل */
  path: string;
  /** مسیر پوشه والد */
  parent_dir?: string;
  /** اندازه (بایت) */
  size_bytes: number;
  /** حجم فرمت شده (مثل "2.5 MB") */
  size_formatted?: string;
  /** MIME type */
  mime_type: string | null;
  /** پسوند فایل */
  extension?: string;
  /** توضیح MIME type */
  mime_description?: string;
  /** encoding (برای فایل‌های متنی) */
  encoding?: string;
  /** نوع کلی: "image" | "audio" | "video" | "document" */
  kind: string;
  /** SHA256 hash */
  sha256: string;
  /** تاریخ ایجاد */
  created_at?: string;
  /** تاریخ تغییر */
  modified_at?: string;
  /** تاریخ آخرین دسترسی */
  accessed_at?: string;
  /** آیا symlink است */
  is_symlink?: boolean;
  /** اطلاعات GPS (اگر موجود باشد) */
  location?: GpsLocation;
  /** متادیتای نوع‌محور */
  metadata: {
    image?: ImageMetadata;
    audio?: AudioMetadata;
    video?: VideoMetadata;
    document?: DocumentMetadata;
    archive?: ArchiveMetadata;
    sqlite?: SqliteMetadata;
    text?: TextMetadata;
    office?: OfficeMetadata;
    epub?: EpubMetadata;
  };
  /** ویژگی‌های سیستم‌عامل (xattrs) */
  xattrs?: Record<string, unknown>;
  /** داده‌های پنهان (binwalk) */
  hidden_data?: HiddenData;
}

// ==========================================
// API Response
// ==========================================

/**
 * پاسخ کامل از /api/plugins/file-meta/run.
 */
export interface FileMetaApiResponse {
  /** آیا موفق بود */
  ok: boolean;
  /** اطلاعات اصلی */
  data: FileMetaResult;
  /** کانال‌های خروجی */
  channels?: {
    /** UI-friendly format */
    ui?: Record<string, unknown>;
    /** متن برای LLM */
    llm?: string;
    /** metadata کامل */
    metadata?: Record<string, unknown>;
    /** داده خام */
    rawdata?: Record<string, unknown>;
    /** embedding vector */
    embed?: number[];
  };
  /** هشدارها */
  warnings?: string[];
  /** زمان‌بندی (ms) */
  timings_ms?: Record<string, number>;
  /** پیام خطا (در صورت شکست) */
  error?: string;
}
