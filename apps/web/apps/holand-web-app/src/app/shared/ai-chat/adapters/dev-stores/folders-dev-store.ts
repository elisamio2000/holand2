import type { ChatSessionFolder } from '@/types/chat.types';

const STORAGE_KEY = 'chat-dev:folders';

function readAll(): ChatSessionFolder[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatSessionFolder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(folders: ChatSessionFolder[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
}

export const foldersDevStore = {
  list(): ChatSessionFolder[] {
    return readAll();
  },

  create(body: { name: string; color?: string }): ChatSessionFolder {
    const folder: ChatSessionFolder = {
      id: `dev-folder-${crypto.randomUUID()}`,
      name: body.name.trim(),
      color: body.color,
      created_at: new Date().toISOString(),
    };
    const next = [...readAll(), folder];
    writeAll(next);
    return folder;
  },

  update(id: string, patch: { name?: string; color?: string }): ChatSessionFolder {
    const folders = readAll();
    const idx = folders.findIndex((f) => f.id === id);
    if (idx < 0) throw new Error('Folder not found');
    const updated = {
      ...folders[idx],
      ...(patch.name != null ? { name: patch.name.trim() } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
    };
    folders[idx] = updated;
    writeAll(folders);
    return updated;
  },

  delete(id: string): void {
    writeAll(readAll().filter((f) => f.id !== id));
  },
};
