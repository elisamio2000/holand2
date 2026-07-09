import { Binding, formatBindings } from './format';


export type ShortcutScope = 'global' | 'canvas' | 'editor';
export type ShortcutCategory = 'tools' | 'view' | 'edit' | 'history' | 'system';

export interface CommandDef {
  id: string;
  label: string;
  description?: string;
  category: ShortcutCategory;
  scope: ShortcutScope;
  defaults: Binding[];
  preventDefault?: boolean;
}

export const COMMAND_DEFS: CommandDef[] = [
  { id: 'tool.select', label: 'Select', category: 'tools', scope: 'canvas', defaults: [{ code: 'KeyV' }] },
  { id: 'tool.pan', label: 'Pan', category: 'tools', scope: 'canvas', defaults: [{ code: 'KeyH' }, { code: 'Space' }] },
  { id: 'tool.draw', label: 'Draw', category: 'tools', scope: 'canvas', defaults: [{ code: 'KeyD' }] },
  { id: 'tool.sticky', label: 'Sticky note', category: 'tools', scope: 'canvas', defaults: [{ code: 'KeyT' }] },
  { id: 'tool.node', label: 'Add node', category: 'tools', scope: 'canvas', defaults: [{ code: 'KeyN' }] },
  { id: 'tool.edge', label: 'Connect', category: 'tools', scope: 'canvas', defaults: [{ code: 'KeyE' }] },
  { id: 'tool.frame', label: 'Frame', category: 'tools', scope: 'canvas', defaults: [{ code: 'KeyF' }] },
  { id: 'tool.comment', label: 'Comment pin', category: 'tools', scope: 'canvas', defaults: [{ code: 'KeyM' }] },
  { id: 'tool.addVector', label: 'Draw shape', category: 'tools', scope: 'canvas', defaults: [{ code: 'KeyP' }] },
  { id: 'edit.copy', label: 'Copy', category: 'edit', scope: 'canvas', defaults: [{ code: 'KeyC', ctrl: true }], preventDefault: true },
  { id: 'edit.paste', label: 'Paste', category: 'edit', scope: 'canvas', defaults: [{ code: 'KeyV', ctrl: true }], preventDefault: true },
  { id: 'edit.delete', label: 'Delete selection', category: 'edit', scope: 'canvas', defaults: [{ code: 'Delete' }, { code: 'Backspace' }] },
  { id: 'edit.duplicate', label: 'Duplicate', category: 'edit', scope: 'canvas', defaults: [{ code: 'KeyD', ctrl: true }], preventDefault: true },
  { id: 'edit.deselect', label: 'Deselect', category: 'edit', scope: 'canvas', defaults: [{ code: 'Escape' }] },
  { id: 'arrange.front', label: 'Bring to front', category: 'edit', scope: 'canvas', defaults: [{ code: 'BracketRight', ctrl: true, shift: true }], preventDefault: true },
  { id: 'arrange.forward', label: 'Bring forward', category: 'edit', scope: 'canvas', defaults: [{ code: 'BracketRight', ctrl: true }], preventDefault: true },
  { id: 'arrange.backward', label: 'Send backward', category: 'edit', scope: 'canvas', defaults: [{ code: 'BracketLeft', ctrl: true }], preventDefault: true },
  { id: 'arrange.back', label: 'Send to back', category: 'edit', scope: 'canvas', defaults: [{ code: 'BracketLeft', ctrl: true, shift: true }], preventDefault: true },
  { id: 'history.undo', label: 'Undo', category: 'history', scope: 'global', defaults: [{ code: 'KeyZ', ctrl: true }, { code: 'KeyZ', meta: true }], preventDefault: true },
  { id: 'history.redo', label: 'Redo', category: 'history', scope: 'global', defaults: [{ code: 'KeyY', ctrl: true }, { code: 'KeyZ', ctrl: true, shift: true }, { code: 'KeyY', meta: true }, { code: 'KeyZ', meta: true, shift: true }], preventDefault: true },
  { id: 'view.zoomIn', label: 'Zoom in', category: 'view', scope: 'canvas', defaults: [{ code: 'Equal', ctrl: true }], preventDefault: true },
  { id: 'view.zoomOut', label: 'Zoom out', category: 'view', scope: 'canvas', defaults: [{ code: 'Minus', ctrl: true }], preventDefault: true },
  { id: 'view.fit', label: 'Fit all', category: 'view', scope: 'canvas', defaults: [{ code: 'Digit0', ctrl: true }], preventDefault: true },
  { id: 'view.toggleSnap', label: 'Toggle snap to grid', category: 'view', scope: 'canvas', defaults: [{ code: 'KeyG' }] },
  { id: 'system.shortcuts', label: 'Keyboard shortcuts', category: 'system', scope: 'global', defaults: [{ code: 'Slash', shift: true }] },
];

const byId = new Map(COMMAND_DEFS.map((c) => [c.id, c]));

export function getCommandDef(id: string): CommandDef | undefined {
  return byId.get(id);
}

export function getBindingsLabel(id: string): string {
  const def = byId.get(id);
  if (!def) return '';
  return formatBindings(def.defaults);
}
