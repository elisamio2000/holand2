// ============================================
// File Encoding Reader — Multi-encoding file reading with Excel support
// Handles UTF-8, UTF-16, Windows-1256 (Arabic/Persian), and Excel files
// ============================================

import * as XLSX from 'xlsx';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Supported text encodings for CSV/TSV/TXT files */
export type FileEncoding = 'auto' | 'utf-8' | 'utf-16' | 'windows-1256' | 'iso-8859-6';

/** Result of reading a file */
export interface FileReadResult {
  success: boolean;
  content: string;
  detectedEncoding: FileEncoding;
  error?: string;
  /** For Excel files, which sheet was read */
  sheetName?: string;
  /** For Excel files, total sheet count */
  sheetCount?: number;
}

/** Encoding option for UI dropdown */
export interface EncodingOption {
  id: FileEncoding;
  labelKey: string;
  descriptionKey: string;
}

/** Registry of encoding options for UI */
export const ENCODING_OPTIONS: EncodingOption[] = [
  {
    id: 'auto',
    labelKey: 'graphExplorer.dataSource.encodingAuto',
    descriptionKey: 'graphExplorer.dataSource.encodingAutoDesc',
  },
  {
    id: 'utf-8',
    labelKey: 'graphExplorer.dataSource.encodingUtf8',
    descriptionKey: 'graphExplorer.dataSource.encodingUtf8Desc',
  },
  {
    id: 'windows-1256',
    labelKey: 'graphExplorer.dataSource.encodingWindows1256',
    descriptionKey: 'graphExplorer.dataSource.encodingWindows1256Desc',
  },
  {
    id: 'utf-16',
    labelKey: 'graphExplorer.dataSource.encodingUtf16',
    descriptionKey: 'graphExplorer.dataSource.encodingUtf16Desc',
  },
  {
    id: 'iso-8859-6',
    labelKey: 'graphExplorer.dataSource.encodingIso88596',
    descriptionKey: 'graphExplorer.dataSource.encodingIso88596Desc',
  },
];

// ─── Windows-1256 Decoder (Arabic/Persian) ────────────────────────────────────

/**
 * Windows-1256 to Unicode mapping table.
 * Covers Arabic, Persian, and common characters.
 */
const WINDOWS_1256_MAP: Record<number, number> = {
  0x80: 0x20AC, // €
  0x81: 0x067E, // پ (Persian Pe)
  0x82: 0x201A, // ‚
  0x83: 0x0192, // ƒ
  0x84: 0x201E, // „
  0x85: 0x2026, // …
  0x86: 0x2020, // †
  0x87: 0x2021, // ‡
  0x88: 0x02C6, // ˆ
  0x89: 0x2030, // ‰
  0x8A: 0x0679, // ٹ
  0x8B: 0x2039, // ‹
  0x8C: 0x0152, // Œ
  0x8D: 0x0686, // چ (Persian Che)
  0x8E: 0x0698, // ژ (Persian Zhe)
  0x8F: 0x0688, // ڈ
  0x90: 0x06AF, // گ (Persian Gaf)
  0x91: 0x2018, // '
  0x92: 0x2019, // '
  0x93: 0x201C, // "
  0x94: 0x201D, // "
  0x95: 0x2022, // •
  0x96: 0x2013, // –
  0x97: 0x2014, // —
  0x98: 0x06A9, // ک (Persian Kaf)
  0x99: 0x2122, // ™
  0x9A: 0x0691, // ڑ
  0x9B: 0x203A, // ›
  0x9C: 0x0153, // œ
  0x9D: 0x200C, // ZWNJ
  0x9E: 0x200D, // ZWJ
  0x9F: 0x06BA, // ں
  0xA0: 0x00A0, // NBSP
  0xA1: 0x060C, // ،
  0xA2: 0x00A2, // ¢
  0xA3: 0x00A3, // £
  0xA4: 0x00A4, // ¤
  0xA5: 0x00A5, // ¥
  0xA6: 0x00A6, // ¦
  0xA7: 0x00A7, // §
  0xA8: 0x00A8, // ¨
  0xA9: 0x00A9, // ©
  0xAA: 0x06BE, // ھ
  0xAB: 0x00AB, // «
  0xAC: 0x00AC, // ¬
  0xAD: 0x00AD, // SHY
  0xAE: 0x00AE, // ®
  0xAF: 0x00AF, // ¯
  0xB0: 0x00B0, // °
  0xB1: 0x00B1, // ±
  0xB2: 0x00B2, // ²
  0xB3: 0x00B3, // ³
  0xB4: 0x00B4, // ´
  0xB5: 0x00B5, // µ
  0xB6: 0x00B6, // ¶
  0xB7: 0x00B7, // ·
  0xB8: 0x00B8, // ¸
  0xB9: 0x00B9, // ¹
  0xBA: 0x061B, // ؛
  0xBB: 0x00BB, // »
  0xBC: 0x00BC, // ¼
  0xBD: 0x00BD, // ½
  0xBE: 0x00BE, // ¾
  0xBF: 0x061F, // ؟
  0xC0: 0x06C1, // ہ
  0xC1: 0x0621, // ء
  0xC2: 0x0622, // آ
  0xC3: 0x0623, // أ
  0xC4: 0x0624, // ؤ
  0xC5: 0x0625, // إ
  0xC6: 0x0626, // ئ
  0xC7: 0x0627, // ا
  0xC8: 0x0628, // ب
  0xC9: 0x0629, // ة
  0xCA: 0x062A, // ت
  0xCB: 0x062B, // ث
  0xCC: 0x062C, // ج
  0xCD: 0x062D, // ح
  0xCE: 0x062E, // خ
  0xCF: 0x062F, // د
  0xD0: 0x0630, // ذ
  0xD1: 0x0631, // ر
  0xD2: 0x0632, // ز
  0xD3: 0x0633, // س
  0xD4: 0x0634, // ش
  0xD5: 0x0635, // ص
  0xD6: 0x0636, // ض
  0xD7: 0x00D7, // ×
  0xD8: 0x0637, // ط
  0xD9: 0x0638, // ظ
  0xDA: 0x0639, // ع
  0xDB: 0x063A, // غ
  0xDC: 0x0640, // ـ
  0xDD: 0x0641, // ف
  0xDE: 0x0642, // ق
  0xDF: 0x0643, // ك
  0xE0: 0x00E0, // à
  0xE1: 0x0644, // ل
  0xE2: 0x00E2, // â
  0xE3: 0x0645, // م
  0xE4: 0x0646, // ن
  0xE5: 0x0647, // ه
  0xE6: 0x0648, // و
  0xE7: 0x00E7, // ç
  0xE8: 0x00E8, // è
  0xE9: 0x00E9, // é
  0xEA: 0x00EA, // ê
  0xEB: 0x00EB, // ë
  0xEC: 0x0649, // ى
  0xED: 0x064A, // ي
  0xEE: 0x00EE, // î
  0xEF: 0x00EF, // ï
  0xF0: 0x064B, // ً
  0xF1: 0x064C, // ٌ
  0xF2: 0x064D, // ٍ
  0xF3: 0x064E, // َ
  0xF4: 0x00F4, // ô
  0xF5: 0x064F, // ُ
  0xF6: 0x0650, // ِ
  0xF7: 0x00F7, // ÷
  0xF8: 0x0651, // ّ
  0xF9: 0x00F9, // ù
  0xFA: 0x0652, // ْ
  0xFB: 0x00FB, // û
  0xFC: 0x00FC, // ü
  0xFD: 0x200E, // LRM
  0xFE: 0x200F, // RLM
  0xFF: 0x06D2, // ے
};

/**
 * Decode Windows-1256 encoded bytes to Unicode string.
 */
function decodeWindows1256(bytes: Uint8Array): string {
  const chars: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte < 0x80) {
      chars.push(String.fromCharCode(byte));
    } else {
      const unicode = WINDOWS_1256_MAP[byte];
      chars.push(unicode ? String.fromCharCode(unicode) : '?');
    }
  }
  return chars.join('');
}

// ─── Encoding Detection ───────────────────────────────────────────────────────

/**
 * Detect BOM (Byte Order Mark) in file bytes.
 */
function detectBOM(bytes: Uint8Array): { encoding: FileEncoding; offset: number } | null {
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return { encoding: 'utf-8', offset: 3 };
  }
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return { encoding: 'utf-16', offset: 2 };
  }
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return { encoding: 'utf-16', offset: 2 };
  }
  return null;
}

/**
 * Heuristic: check if bytes look like valid UTF-8.
 * Returns false if there are invalid UTF-8 sequences.
 */
function isLikelyUtf8(bytes: Uint8Array): boolean {
  let i = 0;
  let hasHighBytes = false;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) {
      i++;
    } else if (b >= 0xC2 && b <= 0xDF) {
      if (i + 1 >= bytes.length || (bytes[i + 1] & 0xC0) !== 0x80) return false;
      hasHighBytes = true;
      i += 2;
    } else if (b >= 0xE0 && b <= 0xEF) {
      if (i + 2 >= bytes.length || (bytes[i + 1] & 0xC0) !== 0x80 || (bytes[i + 2] & 0xC0) !== 0x80) return false;
      hasHighBytes = true;
      i += 3;
    } else if (b >= 0xF0 && b <= 0xF4) {
      if (i + 3 >= bytes.length || (bytes[i + 1] & 0xC0) !== 0x80 || (bytes[i + 2] & 0xC0) !== 0x80 || (bytes[i + 3] & 0xC0) !== 0x80) return false;
      hasHighBytes = true;
      i += 4;
    } else {
      return false;
    }
  }
  return hasHighBytes || true;
}

/**
 * Heuristic: check if decoded text contains Persian/Arabic characters.
 */
function containsPersianArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/**
 * Auto-detect encoding from file bytes.
 */
function detectEncoding(bytes: Uint8Array): FileEncoding {
  const bom = detectBOM(bytes);
  if (bom) return bom.encoding;

  if (isLikelyUtf8(bytes)) {
    return 'utf-8';
  }

  return 'windows-1256';
}

// ─── File Reading ─────────────────────────────────────────────────────────────

/**
 * Read a text file with specified or auto-detected encoding.
 */
export async function readTextFile(
  file: File,
  encoding: FileEncoding = 'auto'
): Promise<FileReadResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    let detectedEncoding = encoding;
    if (encoding === 'auto') {
      detectedEncoding = detectEncoding(bytes);
    }

    let content: string;
    const bom = detectBOM(bytes);
    const startOffset = bom?.offset ?? 0;
    const dataBytes = startOffset > 0 ? bytes.slice(startOffset) : bytes;

    switch (detectedEncoding) {
      case 'utf-16': {
        const decoder = new TextDecoder('utf-16le');
        content = decoder.decode(dataBytes);
        break;
      }
      case 'windows-1256': {
        content = decodeWindows1256(dataBytes);
        break;
      }
      case 'iso-8859-6': {
        const decoder = new TextDecoder('iso-8859-6');
        content = decoder.decode(dataBytes);
        break;
      }
      case 'utf-8':
      default: {
        const decoder = new TextDecoder('utf-8');
        content = decoder.decode(dataBytes);
        break;
      }
    }

    if (encoding === 'auto' && !containsPersianArabic(content) && detectedEncoding === 'utf-8') {
      const altContent = decodeWindows1256(dataBytes);
      if (containsPersianArabic(altContent)) {
        content = altContent;
        detectedEncoding = 'windows-1256';
      }
    }

    console.info('[FileEncodingReader] Read text file:', {
      name: file.name,
      size: file.size,
      requestedEncoding: encoding,
      detectedEncoding,
      contentLength: content.length,
      hasPersian: containsPersianArabic(content),
    });

    return {
      success: true,
      content,
      detectedEncoding,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to read file';
    console.error('[FileEncodingReader] Error reading file:', { name: file.name, error: msg });
    return {
      success: false,
      content: '',
      detectedEncoding: 'auto',
      error: msg,
    };
  }
}

// ─── Excel File Reading ───────────────────────────────────────────────────────

/**
 * Check if a file is an Excel file by extension.
 */
export function isExcelFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext === 'xls' || ext === 'xlsx' || ext === 'xlsb' || ext === 'xlsm';
}

/**
 * Read an Excel file and convert the first sheet to CSV string.
 * @param file - The Excel file to read
 * @param sheetIndex - Which sheet to read (0-based), defaults to 0
 */
export async function readExcelFile(
  file: File,
  sheetIndex: number = 0
): Promise<FileReadResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, {
      type: 'array',
      codepage: 65001, // UTF-8
      cellDates: true,
      cellNF: false,
      cellText: true,
    });

    const sheetNames = workbook.SheetNames;
    if (sheetNames.length === 0) {
      return {
        success: false,
        content: '',
        detectedEncoding: 'utf-8',
        error: 'Excel file has no sheets',
        sheetCount: 0,
      };
    }

    const targetIndex = Math.min(sheetIndex, sheetNames.length - 1);
    const sheetName = sheetNames[targetIndex];
    const sheet = workbook.Sheets[sheetName];

    const csvContent = XLSX.utils.sheet_to_csv(sheet, {
      blankrows: false,
      forceQuotes: true,
    });

    console.info('[FileEncodingReader] Read Excel file:', {
      name: file.name,
      sheetName,
      sheetCount: sheetNames.length,
      csvLength: csvContent.length,
    });

    return {
      success: true,
      content: csvContent,
      detectedEncoding: 'utf-8',
      sheetName,
      sheetCount: sheetNames.length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to read Excel file';
    console.error('[FileEncodingReader] Error reading Excel:', { name: file.name, error: msg });
    return {
      success: false,
      content: '',
      detectedEncoding: 'utf-8',
      error: msg,
    };
  }
}

// ─── Unified File Reader ──────────────────────────────────────────────────────

/**
 * Read any supported file (CSV, TSV, TXT, XLS, XLSX) with proper encoding.
 */
export async function readGraphDataFile(
  file: File,
  encoding: FileEncoding = 'auto'
): Promise<FileReadResult> {
  if (isExcelFile(file.name)) {
    return readExcelFile(file);
  }
  return readTextFile(file, encoding);
}
