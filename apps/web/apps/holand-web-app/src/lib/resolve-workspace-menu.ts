import type { MenuItem } from '@/layouts/hydrogen/menu-items';
import type {
  WorkspaceTeamNavPreset,
  WorkspaceUserNavOverlay,
} from '@/types/workspace-nav.types';
import { flattenMenuCatalog } from '@/lib/menu-catalog-utils';

function getItemId(item: MenuItem): string {
  return item.name;
}

function isLinkVisible(
  linkId: string,
  preset: WorkspaceTeamNavPreset | null,
  overlay: WorkspaceUserNavOverlay | null
): boolean {
  if (overlay?.hiddenIds.includes(linkId)) return false;
  if (!preset?.items.length) return true;
  const ref = preset.items.find((i) => i.id === linkId);
  return ref ? ref.visible : true;
}

function linkOrder(
  linkId: string,
  preset: WorkspaceTeamNavPreset | null,
  overlay: WorkspaceUserNavOverlay | null,
  fallback: number
): number {
  if (overlay?.orderOverrides?.[linkId] != null) return overlay.orderOverrides[linkId];
  const ref = preset?.items.find((i) => i.id === linkId);
  return ref?.order ?? fallback;
}

/**
 * Apply team nav preset + user overlay to platform menu items.
 * When preset is null, returns items unchanged (All Workspaces mode).
 */
export function resolveWorkspaceMenuItems(
  baseItems: MenuItem[],
  preset: WorkspaceTeamNavPreset | null,
  overlay: WorkspaceUserNavOverlay | null,
  pinnedIds: string[]
): { menuItems: MenuItem[]; pinnedLinks: MenuItem[] } {
  if (!preset?.items.length) {
    return { menuItems: baseItems, pinnedLinks: [] };
  }

  const catalog = flattenMenuCatalog(baseItems);
  const linkById = new Map(
    catalog.filter((c) => c.type === 'link').map((c) => [c.id, c])
  );

  const pinnedLinks: MenuItem[] = [];
  for (const pid of pinnedIds) {
    const cat = linkById.get(pid);
    const base = baseItems.find((i) => i.href && getItemId(i) === pid);
    if (cat && base && isLinkVisible(pid, preset, overlay)) {
      pinnedLinks.push(base);
    }
  }

  const hiddenSections = new Set(preset.hiddenSections ?? []);
  let orderCounter = 0;
  const sectionOrder = new Map<string, number>();

  const result: MenuItem[] = [];

  for (const item of baseItems) {
    if (!item.href && !item.dropdownItems) {
      if (hiddenSections.has(item.name)) continue;
      if (!sectionOrder.has(item.name)) sectionOrder.set(item.name, orderCounter++);
      result.push(item);
      continue;
    }

    if (item.dropdownItems?.length) {
      const children = item.dropdownItems
        .filter((d) => isLinkVisible(d.name, preset, overlay))
        .sort(
          (a, b) =>
            linkOrder(a.name, preset, overlay, 0) - linkOrder(b.name, preset, overlay, 0)
        );
      if (children.length === 0) continue;
      result.push({ ...item, dropdownItems: children });
      continue;
    }

    if (item.href) {
      const id = getItemId(item);
      if (!isLinkVisible(id, preset, overlay)) continue;
      if (pinnedIds.includes(id)) continue;
      result.push(item);
    }
  }

  return { menuItems: result, pinnedLinks };
}

/** Hide links whose RBAC section is not in workspace assigned modules (when modules known). */
export function filterMenuByWorkspaceModules(
  items: MenuItem[],
  modules: string[] | null
): MenuItem[] {
  if (!modules?.length) return items;
  const set = new Set(modules);
  const allows = (section?: string) => !section || set.has(section) || section === 'admin';

  return items
    .map((item) => {
      if (item.dropdownItems) {
        const dropdownItems = item.dropdownItems.filter((d) => allows(d.section));
        if (!dropdownItems.length) return null;
        return { ...item, dropdownItems };
      }
      if (item.section && !allows(item.section)) return null;
      return item;
    })
    .filter(Boolean) as MenuItem[];
}
