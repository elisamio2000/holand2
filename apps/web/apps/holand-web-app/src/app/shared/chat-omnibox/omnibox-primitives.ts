// ============================================
// Shared omnibox primitives (AI Chat + One Search)
// ============================================

import cn from '@core/utils/class-names';

export const OMNIBOX_PILL_BASE =
  'relative flex w-full items-center gap-1 rounded-3xl border border-transparent bg-gray-100 transition-colors dark:bg-gray-200/30';

export const OMNIBOX_PILL_DRAGGING =
  'border-primary/40 bg-primary/[0.04] ring-2 ring-primary/20';

/** Single-line row height ~36px; grows vertically on wrap via JS height adjust. */
export const OMNIBOX_TEXTAREA_BASE =
  'max-h-40 min-h-0 w-full resize-none border-0 bg-transparent px-1 py-0 text-sm leading-5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 dark:text-gray-800 dark:placeholder:text-gray-500';

export function omniboxPillClassName(
  isDragging: boolean,
  isCompact: boolean,
  className?: string
): string {
  return cn(
    OMNIBOX_PILL_BASE,
    isDragging && OMNIBOX_PILL_DRAGGING,
    isCompact ? 'px-2 py-1' : 'px-2.5 py-1.5',
    className
  );
}

export function omniboxTextareaClassName(isCompact: boolean): string {
  return cn(
    OMNIBOX_TEXTAREA_BASE,
    isCompact ? 'text-[13px] leading-[18px]' : 'leading-5'
  );
}

/** Extract first image file from drag-and-drop data transfer. */
export function imageFileFromDataTransfer(dt: DataTransfer): File | undefined {
  return Array.from(dt.files).find((f) => f.type.startsWith('image/'));
}
