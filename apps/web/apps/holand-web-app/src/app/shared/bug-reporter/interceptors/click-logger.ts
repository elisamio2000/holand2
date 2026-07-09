export interface ClickLogEntry {
  timestamp: number;
  target: {
    tagName: string;
    id?: string;
    className?: string;
    testId?: string;
    ariaLabel?: string;
    textContent?: string;
    selector?: string;
    role?: string;
    type?: string;
    name?: string;
    href?: string;
  };
  coordinates: {
    x: number;
    y: number;
    clientX: number;
    clientY: number;
  };
  button?: number;
  modifiers?: {
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    meta: boolean;
  };
}

export type ClickCallback = (log: ClickLogEntry) => void;

function getElementClassName(element: Element): string {
  const className = element.className;
  if (typeof className === 'string') return className;
  if (className && typeof className === 'object' && 'baseVal' in className) {
    return String((className as SVGAnimatedString).baseVal || '');
  }
  return element.getAttribute('class') ?? '';
}

function generateSelector(element: Element): string {
  if (element.id) return `#${element.id}`;

  const testId = element.getAttribute('data-testid');
  if (testId) return `[data-testid="${testId}"]`;

  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return `[aria-label="${ariaLabel.slice(0, 40)}"]`;

  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body && path.length < 4) {
    let selector = current.tagName.toLowerCase();
    const className = getElementClassName(current);
    if (className) {
      const classes = className.split(' ').filter(Boolean).slice(0, 2);
      if (classes.length) selector += `.${classes.join('.')}`;
    }
    if (current.id) {
      selector = `#${current.id}`;
      path.unshift(selector);
      break;
    }
    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(' > ');
}

function getReadableLabel(target: Element): string {
  const ariaLabel = target.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  const title = target.getAttribute('title');
  if (title) return title;

  const text = target.textContent?.trim().slice(0, 80);
  if (text) return text;

  const placeholder = target.getAttribute('placeholder');
  if (placeholder) return placeholder;

  return target.tagName.toLowerCase();
}

let clickHandler: ((e: MouseEvent) => void) | null = null;

/** 50ms — only filters true accidental double-fires, not intentional rapid clicks on different elements */
const DOUBLE_FIRE_MS = 50;

let lastClickTimestamp = 0;
let lastClickSelector = '';

export function startClickLogging(onLog: ClickCallback): () => void {
  clickHandler = (e: MouseEvent) => {
    const target = e.target as Element;
    if (!target || !(target instanceof Element)) return;

    const now = Date.now();
    const selector = generateSelector(target);

    // Only suppress identical element fire within 50ms (browser double-fire bug)
    if (selector === lastClickSelector && now - lastClickTimestamp < DOUBLE_FIRE_MS) {
      return;
    }
    lastClickTimestamp = now;
    lastClickSelector = selector;

    const entry: ClickLogEntry = {
      timestamp: now,
      target: {
        tagName: target.tagName,
        id: target.id || undefined,
        className: getElementClassName(target) || undefined,
        testId: target.getAttribute('data-testid') || undefined,
        ariaLabel: target.getAttribute('aria-label') || undefined,
        textContent: getReadableLabel(target),
        selector,
        role: target.getAttribute('role') || (target as HTMLElement).getAttribute?.('role') || undefined,
        type: (target as HTMLInputElement).type || undefined,
        name: (target as HTMLInputElement).name || undefined,
        href: (target as HTMLAnchorElement).href || undefined,
      },
      coordinates: {
        x: e.pageX,
        y: e.pageY,
        clientX: e.clientX,
        clientY: e.clientY,
      },
      button: e.button,
      modifiers: {
        ctrl: e.ctrlKey,
        shift: e.shiftKey,
        alt: e.altKey,
        meta: e.metaKey,
      },
    };

    onLog(entry);
  };

  document.addEventListener('click', clickHandler, true);

  return () => {
    if (clickHandler) {
      document.removeEventListener('click', clickHandler, true);
      clickHandler = null;
    }
    lastClickTimestamp = 0;
    lastClickSelector = '';
  };
}
