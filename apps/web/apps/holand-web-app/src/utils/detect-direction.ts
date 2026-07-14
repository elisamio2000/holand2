// ============================================
// Detect Direction â€” Text directionality utility
// Determines RTL vs LTR from first strong Unicode character
// Used for per-block direction detection in markdown rendering
// ============================================

import type { ReactNode, ReactElement } from 'react';

/**
 * Unicode ranges for strong RTL characters.
 *
 * Covers: Arabic, Hebrew, Syriac, Thaana, NKo, Samaritan,
 * Mandaic, Arabic Extended, Arabic Supplement, Arabic
 * Presentation Forms, and directional formatting characters.
 *
 * Based on Unicode Bidirectional Algorithm (UAX #9) character types R, AL, AN.
 */
const RTL_CHAR_REGEX =
  /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u07C0-\u07FF\u0800-\u083F\u0840-\u085F\u0860-\u086F\u08A0-\u08FF\u200F\u202B\u202E\uFB1D-\uFB4F\uFB50-\uFDCF\uFDF0-\uFDFF\uFE70-\uFEFF]/;

/**
 * Unicode ranges for strong LTR characters.
 *
 * Covers: Latin, Greek, Cyrillic, CJK, and most other LTR scripts.
 * Based on Unicode Bidirectional Algorithm (UAX #9) character type L.
 */
const LTR_CHAR_REGEX =
  /[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02B8\u0370-\u0373\u0376-\u0377\u037B-\u037D\u037F-\u03FF\u0400-\u04FF\u0500-\u052F\u1100-\u11FF\u1E00-\u1EFF\u2C00-\u2C5F\u2C60-\u2C7F\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uFF21-\uFF3A\uFF41-\uFF5A]/;

/**
 * detectDirection â€” Determine text directionality from first strong character.
 *
 * Implements the same "first strong character" heuristic used by
 * HTML `dir="auto"` (Unicode Bidi Algorithm rules P2/P3).
 *
 * Scans the text character by character, skipping neutral characters
 * (whitespace, punctuation, emojis, digits) until a strong directional
 * character is found.
 *
 * @param text - Text to analyze
 * @returns 'rtl' if first strong character is RTL, 'ltr' otherwise
 *
 * @example
 * ```ts
 * detectDirection('Hello world')          // 'ltr'
 * detectDirection('Ø³Ù„Ø§Ù… Ø¯Ù†ÛŒØ§')            // 'rtl'
 * detectDirection('ðŸ¤– Ù‡ÙˆØ´ Ù…ØµÙ†ÙˆØ¹ÛŒ')       // 'rtl' (emoji is neutral, Ù‡Ù€ is RTL)
 * detectDirection('123 ABC')              // 'ltr'
 * detectDirection('ðŸ“Š')                   // 'ltr' (no strong char â†’ default LTR)
 * ```
 */
export function detectDirection(text: string): 'rtl' | 'ltr' {
  for (const char of text) {
    if (RTL_CHAR_REGEX.test(char)) return 'rtl';
    if (LTR_CHAR_REGEX.test(char)) return 'ltr';
  }
  // No strong directional character found â†’ default to LTR
  return 'ltr';
}

/**
 * isRtlText â€” Quick check if text is RTL.
 *
 * @param text - Text to analyze
 * @returns true if the text's base direction is RTL
 *
 * @example
 * ```ts
 * isRtlText('Ù…Ø±Ø­Ø¨Ø§')   // true
 * isRtlText('Hello')   // false
 * ```
 */
export function isRtlText(text: string): boolean {
  return detectDirection(text) === 'rtl';
}

/**
 * getLastParagraphDirection â€” Detect direction of the last non-empty paragraph.
 *
 * Useful for positioning the streaming cursor at the correct side
 * of the last paragraph in a multi-language markdown response.
 *
 * @param text - Full markdown text
 * @returns 'rtl' if last paragraph is RTL, 'ltr' otherwise
 *
 * @example
 * ```ts
 * getLastParagraphDirection('Hello\n\nØ³Ù„Ø§Ù…')   // 'rtl'
 * getLastParagraphDirection('Ø³Ù„Ø§Ù…\n\nHello')   // 'ltr'
 * ```
 */
export function getLastParagraphDirection(text: string): 'rtl' | 'ltr' {
  // Split by double newline (paragraph break) or single newline
  const lines = text.split(/\n+/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return 'ltr';
  return detectDirection(lines[lines.length - 1]);
}

/**
 * extractTextFromNode â€” Recursively extract plain text from a React node tree.
 *
 * Traverses through React elements, fragments, and arrays to collect
 * all string/number text content. Used to programmatically detect
 * direction for container elements (ol, ul, blockquote) that cannot
 * use `dir="auto"` due to the HTML spec's nesting gotcha.
 *
 * WHY THIS EXISTS:
 * The HTML spec Â§14.3.2 says `dir="auto"` skips descendants that have
 * a `dir` attribute. So `<ol dir="auto"><li dir="auto"><p dir="auto">Arabic</p></li></ol>`
 * results in the `<ol>` defaulting to LTR because it skips `<li>` and `<p>`.
 * We need to extract text programmatically and use `detectDirection()` instead.
 *
 * @param node - React node (children from a component)
 * @returns Plain text content concatenated from all text nodes
 *
 * @example
 * ```tsx
 * const text = extractTextFromNode(props.children);
 * const dir = detectDirection(text); // 'rtl' or 'ltr'
 * ```
 */
export function extractTextFromNode(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return (node as ReactNode[]).map(extractTextFromNode).join('');
  // ReactElement â€” recurse into props.children
  if (typeof node === 'object' && 'props' in node) {
    return extractTextFromNode((node as ReactElement).props?.children);
  }
  return '';
}

// ==========================================
// Majority-Based Direction Detection
// ==========================================

/**
 * detectMajorityDirection â€” Determine text directionality by character majority.
 *
 * Unlike `detectDirection()` which uses the First Strong Character algorithm
 * (per Unicode UAX #9), this function counts ALL strong directional characters
 * and returns the direction of the majority.
 *
 * USE CASE: When text starts with LTR characters but is predominantly RTL.
 * Example: "Hello Ø³Ù„Ø§Ù… Ø¨Ù‡ Ù‡Ù…Ù‡ Ø¯ÙˆØ³ØªØ§Ù† Ø¹Ø²ÛŒØ²" should be RTL (80% Persian).
 *
 * @param text - Text to analyze
 * @param threshold - Minimum ratio (0-1) of RTL chars to classify as RTL. Default: 0.5
 * @returns 'rtl' if majority is RTL, 'ltr' otherwise
 *
 * @example
 * ```ts
 * detectMajorityDirection('Hello Ø³Ù„Ø§Ù…')           // 'rtl' (majority is Persian)
 * detectMajorityDirection('Hello world Ø³Ù„Ø§Ù…')     // 'ltr' (majority is English)
 * detectMajorityDirection('Ø³Ù„Ø§Ù… Hello', 0.3)      // 'rtl' (30%+ RTL threshold)
 * ```
 */
export function detectMajorityDirection(
  text: string,
  threshold: number = 0.5
): 'rtl' | 'ltr' {
  let rtlCount = 0;
  let ltrCount = 0;

  for (const char of text) {
    if (RTL_CHAR_REGEX.test(char)) rtlCount++;
    else if (LTR_CHAR_REGEX.test(char)) ltrCount++;
    // Neutral characters (digits, spaces, punctuation) are skipped
  }

  const total = rtlCount + ltrCount;
  if (total === 0) return 'ltr'; // No strong chars â†’ default LTR

  const rtlRatio = rtlCount / total;
  return rtlRatio >= threshold ? 'rtl' : 'ltr';
}

// ==========================================
// Numeral Localization
// ==========================================

/** Digit character maps for different numeral systems */
const DIGIT_MAPS = {
  /** Western/European digits (ASCII) */
  en: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
  /** Persian/Farsi digits (Extended Arabic-Indic: U+06F0-U+06F9) */
  fa: ['Û°', 'Û±', 'Û²', 'Û³', 'Û´', 'Ûµ', 'Û¶', 'Û·', 'Û¸', 'Û¹'],
  /** Arabic-Indic digits (U+0660-U+0669) */
  ar: ['Ù ', 'Ù¡', 'Ù¢', 'Ù£', 'Ù¤', 'Ù¥', 'Ù¦', 'Ù§', 'Ù¨', 'Ù©'],
} as const;

/** Supported numeral locales */
export type NumeralLocale = keyof typeof DIGIT_MAPS;

/**
 * toLocalizedDigits â€” Convert digits to a specific numeral system.
 *
 * Transforms Western digits (0-9) to Persian (Û°-Û¹) or Arabic (Ù -Ù©) digits,
 * or vice versa. Also handles conversion between Persian and Arabic.
 *
 * @param text - Text containing digits to convert
 * @param targetLocale - Target numeral system: 'fa' (Persian), 'ar' (Arabic), or 'en' (Western)
 * @returns Text with digits converted to the target numeral system
 *
 * @example
 * ```ts
 * toLocalizedDigits('Price: 1234', 'fa')     // 'Price: Û±Û²Û³Û´'
 * toLocalizedDigits('Ù‚ÛŒÙ…Øª: Û±Û²Û³Û´', 'en')      // 'Ù‚ÛŒÙ…Øª: 1234'
 * toLocalizedDigits('Ø§Ù„Ø¹Ø¯Ø¯: Ù¡Ù¢Ù£Ù¤', 'fa')     // 'Ø§Ù„Ø¹Ø¯Ø¯: Û±Û²Û³Û´'
 * ```
 */
export function toLocalizedDigits(text: string, targetLocale: NumeralLocale): string {
  // Regex to match any digit from any of the three systems
  const allDigitsRegex = /[0-9Û°-Û¹Ù -Ù©]/g;

  return text.replace(allDigitsRegex, (digit) => {
    // Find which system this digit belongs to and its numeric value
    let numericValue: number;

    if (/[0-9]/.test(digit)) {
      numericValue = digit.charCodeAt(0) - 0x30; // ASCII 0-9
    } else if (/[Û°-Û¹]/.test(digit)) {
      numericValue = digit.charCodeAt(0) - 0x06f0; // Persian
    } else {
      numericValue = digit.charCodeAt(0) - 0x0660; // Arabic-Indic
    }

    return DIGIT_MAPS[targetLocale][numericValue];
  });
}

/**
 * formatNumberLocalized â€” Format a number with locale-specific digits and grouping.
 *
 * Uses `Intl.NumberFormat` for proper thousand separators and decimal points,
 * then converts digits to the target numeral system if needed.
 *
 * @param num - Number to format
 * @param locale - BCP 47 locale tag (e.g., 'fa-IR', 'ar-EG', 'en-US')
 * @returns Formatted number string with localized digits
 *
 * @example
 * ```ts
 * formatNumberLocalized(1234567.89, 'fa-IR')  // 'Û±Ù¬Û²Û³Û´Ù¬ÛµÛ¶Û·Ù«Û¸Û¹'
 * formatNumberLocalized(1234567.89, 'ar-EG')  // 'Ù¡Ù¬Ù¢Ù£Ù¤Ù¬Ù¥Ù¦Ù§Ù«Ù¨Ù©'
 * formatNumberLocalized(1234567.89, 'en-US')  // '1,234,567.89'
 * ```
 */
export function formatNumberLocalized(num: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(num);
}

// ==========================================
// Technical Content Wrapping
// ==========================================

/**
 * Regex patterns for technical content that should remain LTR
 * even within RTL context.
 */
const TECHNICAL_PATTERNS = {
  /** URLs: http://, /brand/brand-mark-4x.svg ftp://, or www. followed by domain */
  url: /(?:https?:\/\/|ftp:\/\/|www\.)[^\s<>"\u0600-\u06FF\u0750-\u077F]+/gi,
  /** Email addresses */
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
  /** Phone numbers: various formats with +, (), -, spaces */
  phone: /(?:\+?[\d]{1,4}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}/g,
  /** MAC addresses: XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX */
  mac: /(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}/g,
  /** IP addresses: IPv4 */
  ip: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  /** File paths: Windows or Unix style */
  path: /(?:[A-Za-z]:\\|\/)[^\s<>"'\u0600-\u06FF]+/g,
};

/**
 * TechnicalMatch â€” Represents a technical content match for wrapping.
 */
export interface TechnicalMatch {
  /** Type of technical content */
  type: keyof typeof TECHNICAL_PATTERNS;
  /** The matched text */
  text: string;
  /** Start index in original string */
  start: number;
  /** End index in original string */
  end: number;
}

/**
 * findTechnicalContent â€” Find all technical content (URLs, emails, etc.) in text.
 *
 * Identifies portions of text that should be displayed LTR even in RTL context.
 * Returns matches sorted by position for sequential processing.
 *
 * @param text - Text to scan for technical content
 * @returns Array of matches with type, text, and position
 *
 * @example
 * ```ts
 * const matches = findTechnicalContent('Ø§ÛŒÙ…ÛŒÙ„: test@example.com Ùˆ Ø³Ø§ÛŒØª: /brand/brand-mark-4x.svg');
 * // [
 * //   { type: 'email', text: 'test@example.com', start: 7, end: 23 },
 * //   { type: 'url', text: '/brand/brand-mark-4x.svg', start: 33, end: 51 }
 * // ]
 * ```
 */
export function findTechnicalContent(text: string): TechnicalMatch[] {
  const matches: TechnicalMatch[] = [];

  for (const [type, pattern] of Object.entries(TECHNICAL_PATTERNS)) {
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      matches.push({
        type: type as keyof typeof TECHNICAL_PATTERNS,
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  // Sort by start position and remove overlapping matches
  matches.sort((a, b) => a.start - b.start);

  // Remove overlaps â€” keep the first (or longest) match
  const filtered: TechnicalMatch[] = [];
  for (const match of matches) {
    const lastMatch = filtered[filtered.length - 1];
    if (!lastMatch || match.start >= lastMatch.end) {
      filtered.push(match);
    } else if (match.end - match.start > lastMatch.end - lastMatch.start) {
      // Replace with longer match if they overlap
      filtered[filtered.length - 1] = match;
    }
  }

  return filtered;
}

/**
 * wrapTechnicalContent â€” Wrap technical content with LTR isolation markers.
 *
 * Wraps URLs, emails, phone numbers, etc. with Unicode isolation characters
 * (LRI...PDI) to ensure they display correctly in RTL context.
 *
 * For HTML output, use `wrapTechnicalContentHtml()` instead for proper
 * `<bdi>` or `<span dir="ltr">` markup.
 *
 * @param text - Text containing technical content
 * @returns Text with technical content wrapped in LRI (U+2066) and PDI (U+2069)
 *
 * @example
 * ```ts
 * wrapTechnicalContent('Ø§ÛŒÙ…ÛŒÙ„: test@example.com')
 * // 'Ø§ÛŒÙ…ÛŒÙ„: â¦test@example.comâ©'
 * ```
 */
export function wrapTechnicalContent(text: string): string {
  const LRI = '\u2066'; // LEFT-TO-RIGHT ISOLATE
  const PDI = '\u2069'; // POP DIRECTIONAL ISOLATE

  const matches = findTechnicalContent(text);
  if (matches.length === 0) return text;

  let result = '';
  let lastEnd = 0;

  for (const match of matches) {
    // Add text before this match
    result += text.slice(lastEnd, match.start);
    // Add wrapped match
    result += LRI + match.text + PDI;
    lastEnd = match.end;
  }

  // Add remaining text
  result += text.slice(lastEnd);

  return result;
}

/**
 * wrapTechnicalContentHtml â€” Wrap technical content with HTML bdi elements.
 *
 * Like `wrapTechnicalContent()`, but returns HTML with `<bdi>` elements
 * for proper isolation in HTML rendering.
 *
 * âš ï¸ WARNING: The returned HTML should be sanitized before using with
 * dangerouslySetInnerHTML. This function does NOT escape HTML entities
 * in the input text.
 *
 * @param text - Text containing technical content (should be pre-escaped)
 * @returns HTML string with technical content wrapped in <bdi> elements
 *
 * @example
 * ```ts
 * wrapTechnicalContentHtml('Ø§ÛŒÙ…ÛŒÙ„: test@example.com')
 * // 'Ø§ÛŒÙ…ÛŒÙ„: <bdi dir="ltr">test@example.com</bdi>'
 * ```
 */
export function wrapTechnicalContentHtml(text: string): string {
  const matches = findTechnicalContent(text);
  if (matches.length === 0) return text;

  let result = '';
  let lastEnd = 0;

  for (const match of matches) {
    // Add text before this match
    result += text.slice(lastEnd, match.start);
    // Add wrapped match with bdi
    result += `<bdi dir="ltr">${match.text}</bdi>`;
    lastEnd = match.end;
  }

  // Add remaining text
  result += text.slice(lastEnd);

  return result;
}

