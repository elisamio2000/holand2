/**
 * Precision interaction logger — captures keyboard, focus, scroll, and form changes
 * at higher fidelity than click-logger alone, similar to how macro recorders work.
 */

export interface KeyboardLogEntry {
  timestamp: number;
  type: 'keydown' | 'keyup';
  key: string;
  code: string;
  modifiers: { ctrl: boolean; shift: boolean; alt: boolean; meta: boolean };
  target?: string;
}

export interface FocusLogEntry {
  timestamp: number;
  type: 'focus' | 'blur';
  target: {
    tagName: string;
    id?: string;
    name?: string;
    type?: string;
    ariaLabel?: string;
    placeholder?: string;
    selector?: string;
  };
}

export interface InputChangeLogEntry {
  timestamp: number;
  target: {
    tagName: string;
    id?: string;
    name?: string;
    type?: string;
    ariaLabel?: string;
    placeholder?: string;
    label?: string;
    selector?: string;
  };
  valueLength?: number;
  valuePreview?: string;
  isPassword?: boolean;
}

export interface ScrollLogEntry {
  timestamp: number;
  scrollX: number;
  scrollY: number;
  deltaX?: number;
  deltaY?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  target?: string;
}

export interface InteractionLog {
  keyboard: KeyboardLogEntry[];
  focus: FocusLogEntry[];
  inputChanges: InputChangeLogEntry[];
  scroll: ScrollLogEntry[];
}

export type InteractionCallback = (entry:
  | { kind: 'keyboard'; entry: KeyboardLogEntry }
  | { kind: 'focus'; entry: FocusLogEntry }
  | { kind: 'input'; entry: InputChangeLogEntry }
  | { kind: 'scroll'; entry: ScrollLogEntry }
) => void;

const IGNORED_KEYS = new Set([
  'Control', 'Shift', 'Alt', 'Meta',
  'CapsLock', 'NumLock', 'ScrollLock',
  'Unidentified',
]);

const SCROLL_THRESHOLD_PX = 30;
const SCROLL_DEBOUNCE_MS = 200;

function getTargetSelector(element: Element): string {
  if (element.id) return `#${element.id}`;
  const testId = element.getAttribute('data-testid');
  if (testId) return `[data-testid="${testId}"]`;
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return `[aria-label="${ariaLabel.slice(0, 40)}"]`;
  return element.tagName.toLowerCase() + (element.getAttribute('class')?.split(' ')[0] ? `.${element.getAttribute('class')!.split(' ')[0]}` : '');
}

function getFocusEntry(e: FocusEvent, type: 'focus' | 'blur'): FocusLogEntry {
  const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | Element;
  return {
    timestamp: Date.now(),
    type,
    target: {
      tagName: target.tagName,
      id: (target as HTMLElement).id || undefined,
      name: (target as HTMLInputElement).name || undefined,
      type: (target as HTMLInputElement).type || undefined,
      ariaLabel: target.getAttribute('aria-label') || undefined,
      placeholder: (target as HTMLInputElement).placeholder || undefined,
      selector: getTargetSelector(target),
    },
  };
}

function findLabelText(element: HTMLElement): string | undefined {
  // Check for associated <label> element
  if ((element as HTMLInputElement).id) {
    const label = document.querySelector(`label[for="${(element as HTMLInputElement).id}"]`);
    if (label) return label.textContent?.trim().slice(0, 60);
  }
  // Check aria-label / aria-labelledby
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    return document.getElementById(labelledBy)?.textContent?.trim().slice(0, 60);
  }
  // Walk up to find label
  let parent = element.parentElement;
  let depth = 0;
  while (parent && depth < 4) {
    const label = parent.querySelector('label');
    if (label) return label.textContent?.trim().slice(0, 60);
    depth++;
    parent = parent.parentElement;
  }
  return element.getAttribute('placeholder') || undefined;
}

export function startInteractionLogging(onLog: InteractionCallback, maskPii = true): () => void {
  const handlers: Array<() => void> = [];

  // --- Keyboard ---
  const keyHandler = (e: KeyboardEvent) => {
    if (IGNORED_KEYS.has(e.key)) return;
    if ((e.target as HTMLElement)?.tagName === 'INPUT' &&
        (e.target as HTMLInputElement).type === 'password') return;

    const target = e.target as Element;
    onLog({
      kind: 'keyboard',
      entry: {
        timestamp: Date.now(),
        type: e.type as 'keydown' | 'keyup',
        key: e.key,
        code: e.code,
        modifiers: { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey },
        target: target instanceof Element ? getTargetSelector(target) : undefined,
      },
    });
  };

  document.addEventListener('keydown', keyHandler, true);
  handlers.push(() => document.removeEventListener('keydown', keyHandler, true));

  // --- Focus / Blur ---
  const focusHandler = (e: FocusEvent) => {
    const target = e.target as Element;
    if (!target || !(target instanceof HTMLElement)) return;
    const tag = target.tagName;
    if (!['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(tag) &&
        !target.getAttribute('contenteditable')) return;

    onLog({ kind: 'focus', entry: getFocusEntry(e, 'focus') });
  };
  const blurHandler = (e: FocusEvent) => {
    const target = e.target as Element;
    if (!target || !(target instanceof HTMLElement)) return;
    const tag = target.tagName;
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

    onLog({ kind: 'focus', entry: getFocusEntry(e, 'blur') });
  };

  document.addEventListener('focusin', focusHandler, true);
  document.addEventListener('focusout', blurHandler, true);
  handlers.push(
    () => document.removeEventListener('focusin', focusHandler, true),
    () => document.removeEventListener('focusout', blurHandler, true),
  );

  // --- Input / Change ---
  const inputHandler = (e: Event) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    if (!target || !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

    const isPassword = (target as HTMLInputElement).type === 'password';
    const value = target.value ?? '';
    const labelText = findLabelText(target as HTMLElement);

    onLog({
      kind: 'input',
      entry: {
        timestamp: Date.now(),
        target: {
          tagName: target.tagName,
          id: target.id || undefined,
          name: target.name || undefined,
          type: (target as HTMLInputElement).type || undefined,
          ariaLabel: target.getAttribute('aria-label') || undefined,
          placeholder: (target as HTMLInputElement).placeholder || undefined,
          label: labelText,
          selector: getTargetSelector(target),
        },
        valueLength: value.length,
        valuePreview: isPassword || maskPii ? undefined : value.slice(0, 50),
        isPassword,
      },
    });
  };

  document.addEventListener('input', inputHandler, true);
  document.addEventListener('change', inputHandler, true);
  handlers.push(
    () => document.removeEventListener('input', inputHandler, true),
    () => document.removeEventListener('change', inputHandler, true),
  );

  // --- Scroll ---
  let lastScrollY = window.scrollY;
  let lastScrollX = window.scrollX;
  let lastScrollTime = 0;
  let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

  const scrollHandler = (e: Event) => {
    const now = Date.now();
    const target = e.target as Element | Document;
    const scrollable = target instanceof Document ? document.documentElement : target as Element;

    const newScrollY = scrollable.scrollTop ?? window.scrollY;
    const newScrollX = scrollable.scrollLeft ?? window.scrollX;
    const deltaY = newScrollY - lastScrollY;
    const deltaX = newScrollX - lastScrollX;

    if (Math.abs(deltaY) < SCROLL_THRESHOLD_PX && Math.abs(deltaX) < SCROLL_THRESHOLD_PX) return;
    if (now - lastScrollTime < SCROLL_DEBOUNCE_MS) {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        onLog({
          kind: 'scroll',
          entry: {
            timestamp: Date.now(),
            scrollX: newScrollX,
            scrollY: newScrollY,
            deltaX,
            deltaY,
            direction: Math.abs(deltaY) >= Math.abs(deltaX)
              ? deltaY > 0 ? 'down' : 'up'
              : deltaX > 0 ? 'right' : 'left',
          },
        });
        lastScrollY = newScrollY;
        lastScrollX = newScrollX;
        lastScrollTime = Date.now();
      }, SCROLL_DEBOUNCE_MS);
      return;
    }

    lastScrollY = newScrollY;
    lastScrollX = newScrollX;
    lastScrollTime = now;

    onLog({
      kind: 'scroll',
      entry: {
        timestamp: now,
        scrollX: newScrollX,
        scrollY: newScrollY,
        deltaX,
        deltaY,
        direction: Math.abs(deltaY) >= Math.abs(deltaX)
          ? deltaY > 0 ? 'down' : 'up'
          : deltaX > 0 ? 'right' : 'left',
      },
    });
  };

  document.addEventListener('scroll', scrollHandler, { capture: true, passive: true });
  handlers.push(() => {
    document.removeEventListener('scroll', scrollHandler, true);
    if (scrollTimeout) clearTimeout(scrollTimeout);
  });

  return () => handlers.forEach((h) => h());
}
