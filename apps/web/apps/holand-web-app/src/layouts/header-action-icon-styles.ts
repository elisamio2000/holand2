import cn from '@core/utils/class-names';

/** Shared chrome for header ActionIcon controls (lang, notify, messages, settings, AI). */
export const headerActionIconBaseClass =
  'relative inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-muted/60 bg-gray-0/70 text-gray-600 shadow-sm backdrop-blur-md transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:enabled:translate-y-px dark:border-muted/40 dark:bg-gray-100/80 dark:text-gray-500 dark:hover:text-primary md:h-9 md:w-9';

export const headerActionIconActiveClass =
  'border-primary/50 bg-primary/10 text-primary ring-2 ring-primary/25 dark:bg-primary/15';

/** AI launcher — primary accent even when idle. */
export const headerAiChatIconBaseClass = cn(
  headerActionIconBaseClass,
  'text-primary hover:text-primary dark:text-primary'
);

export const headerAiChatIconActiveClass =
  'border-primary bg-primary text-white shadow-none ring-0 hover:border-primary-dark hover:bg-primary-dark hover:text-white dark:border-primary dark:bg-primary dark:hover:border-primary-dark dark:hover:bg-primary-dark';

export function headerActionIconClass(active?: boolean, extra?: string) {
  return cn(headerActionIconBaseClass, active && headerActionIconActiveClass, extra);
}

export function headerAiChatIconClass(active?: boolean, extra?: string) {
  return cn(
    headerAiChatIconBaseClass,
    active && headerAiChatIconActiveClass,
    extra
  );
}

/** Help launcher — recording state (bug capture). */
export const headerHelpRecordingClass =
  'relative inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-full border-0 bg-red-600 px-3 text-white shadow-sm ring-2 ring-red-300/80 transition-all hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 md:h-9';
