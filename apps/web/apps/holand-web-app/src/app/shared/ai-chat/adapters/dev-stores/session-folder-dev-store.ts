const STORAGE_KEY = 'chat-dev:session-folder';

function readMap(): Record<string, string | null> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string | null>;
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, string | null>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export const sessionFolderDevStore = {
  get(sessionId: string): string | null {
    const v = readMap()[sessionId];
    return v ?? null;
  },

  assign(sessionId: string, folderId: string | null): void {
    const map = readMap();
    if (folderId) map[sessionId] = folderId;
    else delete map[sessionId];
    writeMap(map);
  },

  all(): Record<string, string | null> {
    return readMap();
  },
};
