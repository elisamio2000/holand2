export interface Binding {
  code: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|od|ad)/.test(navigator.platform);

const NAMED_KEY_LABEL: Record<string, string> = {
  Space: 'Space',
  Escape: 'Esc',
  Enter: 'Enter',
  Backspace: '⌫',
  Delete: 'Del',
  Equal: '=',
  Minus: '−',
  NumpadAdd: '+',
  NumpadSubtract: '−',
  BracketLeft: '[',
  BracketRight: ']',
};

export function formatKeyCode(code: string): string {
  if (NAMED_KEY_LABEL[code]) return NAMED_KEY_LABEL[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

export function formatBinding(b: Binding): string {
  if (!b?.code) return '';
  const parts: string[] = [];
  if (isMac) {
    if (b.ctrl) parts.push('⌃');
    if (b.alt) parts.push('⌥');
    if (b.shift) parts.push('⇧');
    if (b.meta) parts.push('⌘');
    parts.push(formatKeyCode(b.code));
    return parts.join('');
  }
  if (b.ctrl) parts.push('Ctrl');
  if (b.alt) parts.push('Alt');
  if (b.shift) parts.push('Shift');
  if (b.meta) parts.push('Win');
  parts.push(formatKeyCode(b.code));
  return parts.join('+');
}

export function formatBindings(bindings: Binding[] | undefined): string {
  if (!bindings?.length) return '';
  return bindings.map(formatBinding).join(' / ');
}

export function eventMatches(e: KeyboardEvent, b: Binding): boolean {
  if (e.code !== b.code) return false;
  if (!!e.ctrlKey !== !!b.ctrl) return false;
  if (!!e.shiftKey !== !!b.shift) return false;
  if (!!e.altKey !== !!b.alt) return false;
  if (!!e.metaKey !== !!b.meta) return false;
  return true;
}
