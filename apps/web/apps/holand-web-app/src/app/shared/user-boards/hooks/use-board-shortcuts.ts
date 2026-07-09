import { useEffect, useRef } from 'react';
import { COMMAND_DEFS } from '../lib/shortcuts/registry';
import { eventMatches } from '../lib/shortcuts/format';

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

export type ShortcutHandlers = Partial<Record<string, () => void>>;

export function useBoardShortcuts(handlers: ShortcutHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      for (const def of COMMAND_DEFS) {
        const matched = def.defaults.some((b) => eventMatches(e, b));
        if (!matched) continue;
        const handler = handlersRef.current[def.id];
        if (!handler) continue;
        if (def.preventDefault) e.preventDefault();
        handler();
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
