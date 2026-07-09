import { menuItems } from '@/layouts/hydrogen/menu-items';
import { flattenMenuCatalog } from '@/lib/menu-catalog-utils';

/** Flat catalog of sidebar links (stable id === i18n name key). */
export const MENU_CATALOG = flattenMenuCatalog(menuItems);

export { flattenMenuCatalog, buildDefaultTeamPreset } from '@/lib/menu-catalog-utils';
export type { MenuCatalogEntry, MenuCatalogSourceItem } from '@/lib/menu-catalog-utils';
