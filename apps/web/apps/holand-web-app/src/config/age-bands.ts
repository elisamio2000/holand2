// ============================================
// Age-adaptive UX configuration
// Centralizes tone/vocabulary/visual-density differences across age bands
// so pages (start, question flow, result, report) stay consistent.
// ============================================

import type { AgeBand } from '@/types/assessment.types';

export interface AgeBandTheme {
  band: AgeBand;
  label: string;
  /** Short encouraging copy shown on the start page. */
  intro: string;
  /** Tone used in question card micro-copy ("چند لحظه فکر کن" vs رسمی تر). */
  encouragement: string;
  /** Larger font / bigger tap targets for younger bands. */
  fontScale: 'lg' | 'base';
  /** Simpler 3-choice vs full 5-point Likert copy for very young users. */
  simplifiedLikertLabels: boolean;
  accentClassName: string;
}

export const AGE_BANDS: AgeBand[] = ['13-17', '18-24', '25-30', '30+'];

export const AGE_BAND_THEME: Record<AgeBand, AgeBandTheme> = {
  '13-17': {
    band: '13-17',
    label: '۱۳ تا ۱۷ سال (نوجوان)',
    intro: 'این یک آزمون نمره قبولی نداره! فقط با علاقه هات آشنا می‌شی 🙂',
    encouragement: 'همون چیزی که اول به ذهنت رسید رو انتخاب کن.',
    fontScale: 'lg',
    simplifiedLikertLabels: true,
    accentClassName: 'from-emerald-400 to-teal-500',
  },
  '18-24': {
    band: '18-24',
    label: '۱۸ تا ۲۴ سال (دانشجو)',
    intro: 'به سوالات زیر بر اساس علایق و سبک کاری واقعی‌ات پاسخ بده.',
    encouragement: 'پاسخ درست یا غلط وجود نداره، صادقانه پاسخ بده.',
    fontScale: 'base',
    simplifiedLikertLabels: false,
    accentClassName: 'from-blue-500 to-indigo-500',
  },
  '25-30': {
    band: '25-30',
    label: '۲۵ تا ۳۰ سال (آغاز مسیر شغلی)',
    intro: 'نتیجه این آزمون به شکل‌دهی مسیر شغلی و انتخاب‌های بعدی‌ات کمک می‌کند.',
    encouragement: 'با توجه به تجربه‌های شغلی اخیرت پاسخ بده.',
    fontScale: 'base',
    simplifiedLikertLabels: false,
    accentClassName: 'from-violet-500 to-purple-600',
  },
  '30+': {
    band: '30+',
    label: '۳۰ سال به بالا (تثبیت یا تغییر مسیر)',
    intro: 'این ارزیابی می‌تواند در تصمیم‌های تغییر مسیر شغلی یا ارتقا به شما کمک کند.',
    encouragement: 'با در نظر گرفتن تجربه کاری بلندمدتت پاسخ بده.',
    fontScale: 'base',
    simplifiedLikertLabels: false,
    accentClassName: 'from-amber-500 to-orange-600',
  },
};

export function getAgeBandTheme(band: AgeBand): AgeBandTheme {
  return AGE_BAND_THEME[band] ?? AGE_BAND_THEME['18-24'];
}

/** Simplified 3-point labels for 13-17, full 5-point Likert for everyone else. */
export const LIKERT_LABELS_FULL = [
  'کاملاً مخالفم',
  'مخالفم',
  'نظری ندارم',
  'موافقم',
  'کاملاً موافقم',
];

export const LIKERT_LABELS_SIMPLIFIED = ['اصلاً', 'یه‌کم', 'خیلی زیاد'];
