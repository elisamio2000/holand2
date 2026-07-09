'use client';

import cn from '@core/utils/class-names';

export type StatusDotColor = 'green' | 'red' | 'amber' | 'gray' | 'blue' | 'purple';

interface StatusDotProps {
  color: StatusDotColor;
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  ariaLabel?: string;
}

const sizeMap = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
};

const colorMap: Record<StatusDotColor, string> = {
  green: 'bg-green-500',
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  gray: 'bg-gray-400',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
};

export default function StatusDot({
  color,
  pulse = false,
  size = 'md',
  className,
  ariaLabel,
}: StatusDotProps) {
  return (
    <span
      className={cn('relative inline-flex', className)}
      role="img"
      aria-label={ariaLabel ?? color}
    >
      {pulse && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-40',
            colorMap[color]
          )}
          aria-hidden
        />
      )}
      <span
        className={cn(
          'relative inline-flex rounded-full',
          sizeMap[size],
          colorMap[color]
        )}
        aria-hidden={!!ariaLabel}
      />
    </span>
  );
}
