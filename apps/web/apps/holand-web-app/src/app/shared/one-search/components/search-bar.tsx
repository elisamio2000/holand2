'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  PiMagnifyingGlassBold,
  PiXBold,
  PiMicrophoneBold,
  PiCameraBold,
} from 'react-icons/pi';
import { VisualSearchCameraButton } from './visual-search-camera-button';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  placeholder?: string;
  features?: {
    voice?: boolean;
    image?: boolean;
  };
  onImageUpload?: (file: File) => void;
  imageUploading?: boolean;
  size?: 'default' | 'large';
  className?: string;
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  features = { voice: true, image: true },
  onImageUpload,
  imageUploading = false,
  size = 'default',
  className,
}: SearchBarProps) {
  const { t } = useTranslation();
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = useCallback(() => {
    onChange('');
  }, [onChange]);

  const isLarge = size === 'large';

  return (
    <form onSubmit={onSubmit} className={cn('w-full', className)}>
      <div
        className={cn(
          'flex items-center rounded-full border bg-white transition-all',
          isLarge
            ? 'py-1.5 ps-1 pe-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.08)]'
            : 'py-0.5 ps-1 pe-1',
          isFocused
            ? 'border-primary/40 shadow-[0_4px_20px_rgba(0,0,0,0.1)]'
            : 'border-gray-300 dark:border-gray-600',
          'dark:bg-gray-900 dark:shadow-none'
        )}
      >
        <div
          className={cn(
            'flex shrink-0 items-center justify-center text-gray-400',
            isLarge ? 'h-11 w-11' : 'h-9 w-9'
          )}
        >
          <PiMagnifyingGlassBold className={isLarge ? 'h-5 w-5' : 'h-4 w-4'} />
        </div>

        <input
          type="search"
          name="q"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder || t('searchHub.omniboxPlaceholder')}
          className={cn(
            'min-w-0 flex-1 border-0 bg-transparent outline-none',
            'text-gray-900 placeholder:text-gray-400',
            'dark:text-gray-100 dark:placeholder:text-gray-500',
            isLarge ? 'py-2 text-base' : 'py-2 text-sm'
          )}
        />

        {value.trim() && (
          <button
            type="button"
            className={cn(
              'flex shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors',
              'hover:bg-gray-100 hover:text-gray-700',
              'dark:hover:bg-gray-800 dark:hover:text-gray-200',
              isLarge ? 'h-10 w-10' : 'h-8 w-8'
            )}
            onClick={handleClear}
            aria-label={t('searchHub.clearQuery')}
          >
            <PiXBold className={isLarge ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
          </button>
        )}

        {features.voice && (
          <button
            type="button"
            className={cn(
              'flex shrink-0 items-center justify-center rounded-full text-primary transition-colors',
              'hover:bg-primary/10',
              isLarge ? 'h-10 w-10' : 'h-8 w-8'
            )}
            title={t('searchHub.voiceStub')}
            aria-label={t('searchHub.voiceStub')}
          >
            <PiMicrophoneBold className={isLarge ? 'h-5 w-5' : 'h-4 w-4'} />
          </button>
        )}

        {features.image && onImageUpload ? (
          <VisualSearchCameraButton
            size={isLarge ? 'large' : 'default'}
            disabled={imageUploading}
            onImageSelect={onImageUpload}
          />
        ) : features.image ? (
          <button
            type="button"
            className={cn(
              'flex shrink-0 items-center justify-center rounded-full text-primary transition-colors',
              'hover:bg-primary/10',
              isLarge ? 'h-10 w-10 me-0.5' : 'h-8 w-8 me-0.5'
            )}
            title={t('searchHub.visualStub')}
            aria-label={t('searchHub.visualStub')}
          >
            <PiCameraBold className={isLarge ? 'h-5 w-5' : 'h-4 w-4'} />
          </button>
        ) : null}

        <Button
          type="submit"
          size={isLarge ? 'md' : 'sm'}
          className={cn('shrink-0 rounded-full', isLarge ? 'h-11 px-5' : 'h-9 px-4 me-0.5')}
        >
          {t('searchHub.runSearch')}
        </Button>
      </div>
    </form>
  );
}
