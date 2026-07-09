// ============================================
// LayerVisibilityPill — small pill switch reused across layer panels
// (matches the Base Map toggle style from CustomLayersPanel)
// ============================================
'use client';

import cn from '@/lib/cn';

interface LayerVisibilityPillProps {
  visible: boolean;
  onToggle: () => void;
  disabled?: boolean;
  title?: string;
}

export default function LayerVisibilityPill({
  visible,
  onToggle,
  disabled,
  title,
}: LayerVisibilityPillProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title ?? (visible ? 'نمایش' : 'مخفی')}
      onClick={onToggle}
      className={cn(
        'relative h-4 w-7 shrink-0 rounded-full transition-colors',
        disabled && 'cursor-not-allowed opacity-40',
        visible ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-500'
      )}
    >
      <span
        className={cn(
          'absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow transition-all',
          visible ? 'left-[14px]' : 'left-0.5'
        )}
      />
    </button>
  );
}
