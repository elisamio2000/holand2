const STORAGE_KEY = 'boards.snapGrid';

export function readSnapPreference(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return true;
  return raw === 'true';
}

export function writeSnapPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, String(enabled));
}
