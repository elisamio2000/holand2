const QUEUE_KEY = 'board-attach-queue';

export interface BoardAttachQueueItem {
  artifactId: string;
  name: string;
  mime_type?: string;
  size?: number;
}

export interface BoardAttachQueueEntry {
  boardId: string;
  items: BoardAttachQueueItem[];
  at: string;
}

export function readAttachQueue(boardId: string): BoardAttachQueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const entries = JSON.parse(raw) as BoardAttachQueueEntry[];
    const entry = entries.find((e) => e.boardId === boardId);
    return entry?.items ?? [];
  } catch {
    return [];
  }
}

export function enqueueAttachItems(boardId: string, items: BoardAttachQueueItem[]): void {
  if (typeof window === 'undefined' || !items.length) return;
  try {
    const raw = sessionStorage.getItem(QUEUE_KEY);
    const entries: BoardAttachQueueEntry[] = raw ? JSON.parse(raw) : [];
    const filtered = entries.filter((e) => e.boardId !== boardId);
    filtered.push({ boardId, items, at: new Date().toISOString() });
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  } catch {
    // ignore quota errors
  }
}

export function clearAttachQueue(boardId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(QUEUE_KEY);
    if (!raw) return;
    const entries = (JSON.parse(raw) as BoardAttachQueueEntry[]).filter(
      (e) => e.boardId !== boardId
    );
    if (entries.length) sessionStorage.setItem(QUEUE_KEY, JSON.stringify(entries));
    else sessionStorage.removeItem(QUEUE_KEY);
  } catch {
    // ignore
  }
}

export function fileExplorerAttachUrl(boardId: string): string {
  return `/file-explorer?attachToBoard=${encodeURIComponent(boardId)}`;
}
