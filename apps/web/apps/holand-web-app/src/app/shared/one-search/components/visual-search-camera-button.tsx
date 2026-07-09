'use client';

import { useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PiCameraBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';

export interface VisualSearchCameraButtonProps {
  onImageSelect: (file: File) => void;
  disabled?: boolean;
  size?: 'default' | 'large';
  className?: string;
}

export function VisualSearchCameraButton({
  onImageSelect,
  disabled = false,
  size = 'default',
  className,
}: VisualSearchCameraButtonProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const isLarge = size === 'large';

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onImageSelect(file);
      e.target.value = '';
    },
    [onImageSelect]
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
        aria-hidden
      />
      <button
        type="button"
        disabled={disabled}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full text-primary transition-colors',
          'hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50',
          isLarge ? 'h-10 w-10 me-0.5' : 'h-8 w-8 me-0.5',
          className
        )}
        title={t('searchHub.searchByImage')}
        aria-label={t('searchHub.searchByImage')}
        onClick={() => inputRef.current?.click()}
      >
        <PiCameraBold className={isLarge ? 'h-5 w-5' : 'h-4 w-4'} />
      </button>
    </>
  );
}
