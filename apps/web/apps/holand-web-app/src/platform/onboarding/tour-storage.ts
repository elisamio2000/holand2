export function createTourStorage(storageKey: string) {
  return {
    hasSeen(): boolean {
      if (typeof window === 'undefined') return true;
      return localStorage.getItem(storageKey) === '1';
    },
    markSeen(): void {
      if (typeof window === 'undefined') return;
      localStorage.setItem(storageKey, '1');
    },
    reset(): void {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(storageKey);
    },
  };
}
