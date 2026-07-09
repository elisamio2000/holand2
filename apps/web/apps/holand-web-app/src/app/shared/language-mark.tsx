'use client';

import { PiGlobeBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { LANGUAGES, type LanguageCode } from '@/config/i18n';

/**
 * LanguageMark — Visual marker for a platform UI language in menus and switchers.
 *
 * Persian uses the regional flag emoji; English uses a globe icon to represent
 * international language rather than a specific country.
 */
export function LanguageMark({
  code,
  className,
  iconClassName,
}: {
  code: LanguageCode;
  className?: string;
  iconClassName?: string;
}) {
  const lang = LANGUAGES.find((l) => l.code === code);
  if (!lang) return null;

  if (lang.mark === 'international') {
    return (
      <span
        className={cn('inline-flex h-7 w-5 shrink-0 items-center justify-center', className)}
        aria-hidden
      >
        <PiGlobeBold className={cn('h-[18px] w-[18px]', iconClassName)} />
      </span>
    );
  }

  return (
    <span className={cn('text-lg', className)} aria-hidden>
      {lang.flag}
    </span>
  );
}
