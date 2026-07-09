'use client';

import { ReactNode } from 'react';
import { Text } from 'rizzui';
import cn from '@core/utils/class-names';
import { PiGlobeDuotone } from 'react-icons/pi';

export interface BaseResultCardProps {
  title: string;
  url?: string;
  snippet?: string;
  metadata?: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function BaseResultCard({
  title,
  url,
  snippet,
  metadata,
  icon,
  onClick,
  className,
}: BaseResultCardProps) {
  return (
    <a
      href={url}
      onClick={(e) => {
        if (onClick) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'group block rounded-lg p-3 transition-colors',
        'hover:bg-gray-100/60 dark:hover:bg-gray-200/10',
        className
      )}
    >
      {url && (
        <div className="mb-1 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
          <PiGlobeDuotone className="h-3.5 w-3.5 shrink-0 opacity-80" />
          <span className="truncate">{url}</span>
        </div>
      )}

      <h3 className="line-clamp-1 text-[15px] font-medium text-blue-700 group-hover:underline dark:text-blue-400">
        {title}
      </h3>

      {snippet && (
        <Text className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          {snippet}
        </Text>
      )}

      {metadata && (
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          {metadata}
        </div>
      )}
    </a>
  );
}

export default BaseResultCard;
