// ============================================
// Holand Platform â€” Carbon Layout Menu Items
// Mirrors Hydrogen sidebar menu for layout sync
// Uses i18n translation keys for bilingual support
// ============================================

import { routes } from '@/config/routes';
import { IconType } from 'react-icons/lib';
import {
  PiCalendarPlusDuotone,
  PiChatCenteredDotsDuotone,
  PiClipboardTextDuotone,
  PiCpuDuotone,
  PiEnvelopeDuotone,
  PiFolderDuotone,
  PiFolderLockDuotone,
  PiFolderOpenDuotone,
  PiFolderPlusDuotone,
  PiGearDuotone,
  PiGlobeHemisphereWestDuotone,
  PiHardDrivesDuotone,
  PiListChecksDuotone,
  PiLockKeyDuotone,
  PiMagnifyingGlassDuotone,
  PiNewspaperClippingDuotone,
  PiPlugDuotone,
  PiProjectorScreenChartDuotone,
  PiFlowArrowDuotone,
  PiTreeStructureDuotone,
  PiShieldCheckDuotone,
  PiSquaresFourDuotone,
  PiTagDuotone,
  PiTimerDuotone,
  PiUserCircleDuotone,
  PiUserGearDuotone,
} from 'react-icons/pi';
import { atom } from 'jotai';

export interface SubMenuItemType {
  name: string;
  description?: string;
  href: string;
  badge?: string;
}

export interface ItemType {
  name: string;
  icon: IconType;
  href?: string;
  description?: string;
  badge?: string;
  subMenuItems?: SubMenuItemType[];
}

export interface MenuItemsType {
  id: string;
  name: string;
  title: string;
  icon: IconType;
  menuItems: ItemType[];
}

/**
 * carbonMenuItems â€” Carbon layout navigation items for Holand Platform.
 *
 * `name` values are i18n translation keys (e.g. 'nav.platform').
 * Resolved via useTranslation() in carbon-sidebar-menu.tsx.
 *
 * Synced with hydrogen/menu-items.tsx â€” same routes, same keys.
 */
export const carbonMenuItems: MenuItemsType[] = [
  // ==========================================
  // Platform
  // ==========================================
  {
    id: '1',
    name: 'nav.platform',
    title: 'nav.platform',
    icon: PiChatCenteredDotsDuotone,
    menuItems: [
      {
        name: 'nav.aiChat',
        icon: PiChatCenteredDotsDuotone,
        href: routes.aiChat.root,
      },
      {
        name: 'nav.oneSearch',
        icon: PiMagnifyingGlassDuotone,
        href: routes.oneSearch.root,
        badge: 'NEW',
      },
      {
        name: 'nav.caseImporter',
        icon: PiFolderPlusDuotone,
        href: routes.caseImporter.dashboard,
      },
    ],
  },

  // ==========================================
  // Cases & Files
  // ==========================================
  {
    id: '2',
    name: 'nav.casesAndFiles',
    title: 'nav.casesAndFiles',
    icon: PiFolderOpenDuotone,
    menuItems: [
      {
        name: 'nav.cases',
        icon: PiFolderOpenDuotone,
        href: routes.cases.list,
        badge: 'NEW',
      },
      {
        name: 'nav.createCase',
        icon: PiFolderPlusDuotone,
        href: routes.cases.create,
      },
      {
        name: 'nav.categories',
        icon: PiTagDuotone,
        href: routes.cases.categories,
      },
      {
        name: 'nav.caseTemplates',
        icon: PiClipboardTextDuotone,
        href: routes.cases.templates,
      },
      {
        name: 'nav.fileManager',
        icon: PiFolderDuotone,
        href: routes.fileManager,
      },
      {
        name: 'nav.fileExplorer',
        icon: PiFolderLockDuotone,
        href: routes.fileExplorer,
      },
      {
        name: 'nav.storage',
        icon: PiHardDrivesDuotone,
        href: routes.storage,
      },
    ],
  },

  // ==========================================
  // Projects & Tasks
  // ==========================================
  {
    id: '4',
    name: 'nav.projectsAndTasks',
    title: 'nav.projectsAndTasks',
    icon: PiProjectorScreenChartDuotone,
    menuItems: [
      {
        name: 'nav.projects',
        icon: PiProjectorScreenChartDuotone,
        href: routes.projects.feed,
        badge: 'NEW',
      },
      {
        name: 'nav.myTasks',
        icon: PiListChecksDuotone,
        href: routes.projects.myTasks,
        badge: 'NEW',
      },
    ],
  },

  // ==========================================
  // Communication
  // ==========================================
  {
    id: '5',
    name: 'nav.communication',
    title: 'nav.communication',
    icon: PiEnvelopeDuotone,
    menuItems: [
      {
        name: 'nav.messages',
        icon: PiEnvelopeDuotone,
        href: routes.messages,
        badge: 'NEW',
      },
      {
        name: 'nav.calendar',
        icon: PiCalendarPlusDuotone,
        href: routes.eventCalendar,
        badge: 'NEW',
      },
    ],
  },

  // ==========================================
  // Reports
  // ==========================================
  {
    id: '6',
    name: 'nav.reports',
    title: 'nav.reports',
    icon: PiNewspaperClippingDuotone,
    menuItems: [
      {
        name: 'nav.reportBuilder',
        icon: PiNewspaperClippingDuotone,
        href: routes.reports.builder,
        badge: 'NEW',
      },
    ],
  },

  // ==========================================
  // Plugins
  // ==========================================
  {
    id: '7',
    name: 'nav.plugins',
    title: 'nav.plugins',
    icon: PiPlugDuotone,
    menuItems: [
      {
        name: 'nav.pluginsAndApps',
        icon: PiPlugDuotone,
        href: routes.plugins.dashboard,
        badge: 'NEW',
      },
    ],
  },

  // ==========================================
  // Administration
  // ==========================================
  {
    id: '8',
    name: 'nav.administration',
    title: 'nav.administration',
    icon: PiShieldCheckDuotone,
    menuItems: [
      {
        name: 'nav.adminCommandCenter',
        icon: PiShieldCheckDuotone,
        href: routes.admin.dashboard,
        badge: 'NEW',
      },
      {
        name: 'nav.adminWidgets',
        icon: PiSquaresFourDuotone,
        href: routes.admin.widgets,
        badge: 'NEW',
      },
      {
        name: 'nav.adminPanel',
        icon: PiShieldCheckDuotone,
        href: routes.adminPanel.statistics,
      },
      {
        name: 'nav.rolesAndPermissions',
        icon: PiFolderLockDuotone,
        href: routes.rolesPermissions,
      },
      {
        name: 'nav.inferenceCompute',
        icon: PiCpuDuotone,
        subMenuItems: [
          {
            name: 'nav.pipelineAdmin',
            href: routes.admin.pipeline,
            badge: 'NEW',
          },
          {
            name: 'nav.gpuNodes',
            href: routes.admin.nodes,
            badge: 'NEW',
          },
          {
            name: 'nav.gpuToolRuntime',
            href: routes.admin.gpu,
          },
        ],
      },
      {
        name: 'nav.activityLog',
        icon: PiTimerDuotone,
        href: routes.admin.activityLog,
        badge: 'NEW',
      },
      {
        name: 'nav.sessionManagement',
        icon: PiGlobeHemisphereWestDuotone,
        href: routes.admin.sessions,
        badge: 'NEW',
      },
      {
        name: 'nav.security',
        icon: PiLockKeyDuotone,
        href: routes.admin.security,
        badge: 'NEW',
      },
      {
        name: 'nav.workflowBuilder',
        icon: PiTreeStructureDuotone,
        href: routes.admin.workflows,
        badge: 'NEW',
      },
    ],
  },

  // ==========================================
  // User Account
  // ==========================================
  {
    id: '9',
    name: 'nav.userAccount',
    title: 'nav.userAccount',
    icon: PiUserCircleDuotone,
    menuItems: [
      {
        name: 'nav.myProfile',
        icon: PiUserCircleDuotone,
        href: routes.profile,
      },
      {
        name: 'nav.accountSettings',
        icon: PiUserGearDuotone,
        href: routes.forms.profileSettings,
      },
    ],
  },
];

export const carbonMenuItemAtom = atom(carbonMenuItems[0]);

/** Same stable nav ids as Hydrogen (`name` i18n keys). */
export { MENU_CATALOG } from '@/lib/menu-catalog';
