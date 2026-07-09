export interface NavigationLogEntry {
  timestamp: number;
  from: string;
  to: string;
  type: 'push' | 'replace' | 'back' | 'forward';
}

export type NavigationCallback = (entry: NavigationLogEntry) => void;

export function createNavigationEntry(
  from: string,
  to: string,
  type: NavigationLogEntry['type'] = 'push'
): NavigationLogEntry {
  return { timestamp: Date.now(), from, to, type };
}

export function startPopstateTracking(onNavigate: NavigationCallback): () => void {
  const handler = () => {
    onNavigate({
      timestamp: Date.now(),
      from: document.referrer || window.location.pathname,
      to: window.location.pathname,
      type: 'back',
    });
  };

  window.addEventListener('popstate', handler);
  return () => window.removeEventListener('popstate', handler);
}
