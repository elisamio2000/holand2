// Small client-side cache mapping resource id -> display name for workspace
// module/case/file assignments. The pickers already know the human name at
// selection time (case/file search results, module catalog) but the
// assignment API only stores the id â€” this cache lets the "already assigned"
// list show names instead of raw UUIDs without requiring a new backend
// batch-lookup endpoint. Falls back to the raw id when no name is cached
// (e.g. items assigned before this cache existed, or from another browser).

export type WorkspaceResourceKind = 'modules' | 'cases' | 'files';

const STORAGE_KEY = 'Holand_ws_resource_names';

type NameCache = Record<WorkspaceResourceKind, Record<string, string>>;

function emptyCache(): NameCache {
  return { modules: {}, cases: {}, files: {} };
}

function readCache(): NameCache {
  if (typeof window === 'undefined') return emptyCache();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyCache();
    const parsed = JSON.parse(raw) as Partial<NameCache>;
    return { ...emptyCache(), ...parsed };
  } catch {
    return emptyCache();
  }
}

function writeCache(cache: NameCache): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore quota/serialization errors â€” names are a display nicety */
  }
}

export function getCachedResourceName(
  kind: WorkspaceResourceKind,
  id: string
): string | undefined {
  return readCache()[kind]?.[id];
}

export function setCachedResourceName(
  kind: WorkspaceResourceKind,
  id: string,
  name: string
): void {
  if (!id || !name || name === id) return;
  const cache = readCache();
  cache[kind] = { ...cache[kind], [id]: name };
  writeCache(cache);
}

export function setCachedResourceNames(
  kind: WorkspaceResourceKind,
  entries: Record<string, string>
): void {
  if (typeof window === 'undefined') return;
  const cache = readCache();
  cache[kind] = { ...cache[kind], ...entries };
  writeCache(cache);
}

