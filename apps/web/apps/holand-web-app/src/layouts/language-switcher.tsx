// ============================================
// Holand Platform â€” Language Switcher Component
// Dropdown for switching between English and Persian
// ============================================

'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Popover, ActionIcon, Text } from 'rizzui';
import { PiCheckBold, PiGlobeBold } from 'react-icons/pi';
import { useLanguage } from '@/providers/language-provider';
import cn from '@core/utils/class-names';
import { headerActionIconClass } from '@/layouts/header-action-icon-styles';
import { HeaderPopoverWithTooltip } from '@/layouts/header-action-tooltip';
import { LanguageMark } from '@/app/shared/language-mark';

/**
 * LanguageSwitcher â€” Header dropdown for switching interface language.
 *
 * Uses PiGlobeBold to match other header action icons (bell, messages, settings).
 * Persists selection and syncs HTML dir/lang attributes.
 *
 * @example
 * ```tsx
 * <LanguageSwitcher />
 * ```
 */
export default function LanguageSwitcher() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const { currentLanguage, changeLanguage, languages } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const tooltipLabel = t('ui.changeLanguage');

  return (
    <div ref={ref} className="relative">
      <HeaderPopoverWithTooltip label={tooltipLabel}>
        <Popover
          isOpen={isOpen}
          placement="bottom-end"
          setIsOpen={setIsOpen}
        >
          <Popover.Trigger>
            <ActionIcon
              variant="text"
              aria-label={tooltipLabel}
              aria-expanded={isOpen}
              className={cn(headerActionIconClass(isOpen), 'p-1')}
            >
              <PiGlobeBold className="h-[18px] w-[18px]" aria-hidden />
            </ActionIcon>
          </Popover.Trigger>

          <Popover.Content className="z-[9999] w-48 p-2 dark:bg-gray-100 [&>svg]:dark:fill-gray-100">
          <div className="space-y-1">
            {languages.map((lang) => {
              const isActive = currentLanguage === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => {
                    changeLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-50'
                  )}
                >
                  <LanguageMark code={lang.code} />
                  <Text
                    className={cn(
                      'flex-1 text-start text-sm',
                      isActive ? 'font-medium text-primary' : 'text-gray-700 dark:text-gray-300'
                    )}
                  >
                    {lang.name}
                  </Text>
                  {isActive && (
                    <PiCheckBold className="h-4 w-4 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </Popover.Content>
        </Popover>
      </HeaderPopoverWithTooltip>
    </div>
  );
}

