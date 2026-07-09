export type MenuCatalogEntryType = 'section' | 'link';

export interface MenuCatalogSourceItem {
  name: string;
  href?: string;
  section?: string;
  badge?: string;
  dropdownItems?: { name: string; href: string; section?: string; badge?: string }[];
}

export interface MenuCatalogEntry {
  id: string;
  type: MenuCatalogEntryType;
  nameKey: string;
  href?: string;
  section?: string;
  parentSectionKey?: string;
}

/** Flatten sidebar menu into stable catalog entries (id === i18n name key). */
export function flattenMenuCatalog(items: MenuCatalogSourceItem[]): MenuCatalogEntry[] {
  const out: MenuCatalogEntry[] = [];
  let currentSection: string | undefined;

  for (const item of items) {
    if (!item.href && !item.dropdownItems) {
      currentSection = item.name;
      out.push({
        id: item.name,
        type: 'section',
        nameKey: item.name,
        section: item.section,
      });
      continue;
    }

    if (item.dropdownItems?.length) {
      for (const d of item.dropdownItems) {
        out.push({
          id: d.name,
          type: 'link',
          nameKey: d.name,
          href: d.href,
          section: d.section,
          parentSectionKey: item.name,
        });
      }
      continue;
    }

    if (item.href) {
      out.push({
        id: item.name,
        type: 'link',
        nameKey: item.name,
        href: item.href,
        section: item.section,
        parentSectionKey: currentSection,
      });
    }
  }

  return out;
}

export function buildDefaultTeamPreset(items: MenuCatalogSourceItem[]) {
  const catalog = flattenMenuCatalog(items);
  return {
    schemaVersion: 1 as const,
    items: catalog
      .filter((c) => c.type === 'link')
      .map((c, index) => ({
        id: c.id,
        visible: true,
        order: index,
      })),
  };
}
