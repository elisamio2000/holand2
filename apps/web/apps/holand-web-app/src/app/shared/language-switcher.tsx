'use client';

import { Tooltip } from '@/components/tooltip';
import { useLanguage } from '@/providers/language-provider';
import { useTranslation } from 'react-i18next';
import { Button } from 'rizzui';
import cn from '@core/utils/class-names';
import { PiGlobeBold } from 'react-icons/pi';
import { LanguageMark } from '@/app/shared/language-mark';

/**
 * LanguageSwitcher — Toggle between English and Persian.
 *
 * @param variant - RizzUI button variant when `appearance="button"`
 * @param appearance - `button` (default) or `authNav` to match auth header pills
 * @param size - Button size for `appearance="button"`
 * @param showLabel - Show language name next to icon
 */
export default function LanguageSwitcher({
  variant = 'outline',
  size = 'sm',
  showLabel = false,
  appearance = 'button',
  className = '',
}: {
  variant?: 'outline' | 'text' | 'solid';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
  appearance?: 'button' | 'authNav';
  className?: string;
}) {
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage, languages } = useLanguage();

  const handleToggle = () => {
    const nextLang = currentLanguage === 'en' ? 'fa' : 'en';
    console.info('[LanguageSwitcher] Language changed to:', nextLang);
    changeLanguage(nextLang);
  };

  const currentLangConfig = languages.find((l) => l.code === currentLanguage);
  const nextLang = currentLanguage === 'en' ? 'fa' : 'en';
  const nextLangConfig = languages.find((l) => l.code === nextLang);
  const tooltipLabel = t('authPages.languageSwitcher.tooltip', {
    language: nextLangConfig?.name ?? nextLang,
  });

  if (appearance === 'authNav') {
    return (
      <Tooltip content={tooltipLabel} placement="bottom" color="invert">
        <button
          type="button"
          onClick={handleToggle}
          aria-label={tooltipLabel}
          className={cn(
            'inline-flex items-center gap-x-1 rounded-3xl p-2 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 md:px-4 md:py-2.5 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-gray-500',
            className
          )}
        >
          <PiGlobeBold />
          {showLabel && (
            <span className="ms-0.5">{currentLangConfig?.name}</span>
          )}
        </button>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={tooltipLabel} placement="bottom" color="invert">
      <Button
        variant={variant}
        size={size}
        onClick={handleToggle}
        className={className}
        aria-label={tooltipLabel}
      >
        <PiGlobeBold className="h-4 w-4" />
        {showLabel && (
          <span className="ms-2 inline-flex items-center gap-1.5">
            <LanguageMark code={currentLanguage} />
            {currentLangConfig?.name}
          </span>
        )}
      </Button>
    </Tooltip>
  );
}
