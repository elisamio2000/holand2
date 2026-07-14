// ============================================
// Holand Platform — Sidebar Menu Items
// Defines the navigation structure for the hydrogen layout
// Uses i18n translation keys for bilingual support
// ============================================

import { routes } from '@/config/routes';
import {
  PiBrainDuotone,
  PiClipboardTextDuotone,
  PiGearDuotone,
  PiNewspaperClippingDuotone,
  PiShieldCheckDuotone,
  PiSquaresFourDuotone,
  PiUserCircleDuotone,
  PiUserGearDuotone,
  PiUsersThreeDuotone,
} from 'react-icons/pi';

/**
 * Shape of a single menu item in the sidebar navigation.
 * `name` is a translation key resolved at render time.
 *
 * `section` — optional backend RBAC section name.
 * When set, the item is hidden from users who do not have access to that
 * section according to their effective permissions from the backend.
 * Items WITHOUT a section are visible to all authenticated users.
 */
export interface MenuItem {
  name: string;
  href?: string;
  icon?: React.ReactNode;
  badge?: string;
  /** Backend RBAC section required to see this item. Omit to allow all authenticated users. */
  section?: string;
  dropdownItems?: { name: string; href: string; badge?: string; section?: string }[];
}

/**
 * menuItems — Sidebar navigation items for the Holand career-guidance platform.
 *
 * `name` values are i18n translation keys (e.g. 'nav.platform').
 * Resolved to translated strings in sidebar-menu.tsx via useTranslation().
 *
 * Structure:
 * - Items WITHOUT `href` → rendered as section labels
 * - Items WITH `href` → rendered as links
 */
export const menuItems: MenuItem[] = [
  // ==========================================
  // Core Platform
  // ==========================================
  { name: 'nav.platform' },
  {
    name: 'nav.home',
    href: routes.home,
    icon: <PiSquaresFourDuotone />,
  },
  {
    name: 'nav.assessments',
    href: routes.careerGuidance.assessments,
    icon: <PiClipboardTextDuotone />,
  },
  {
    name: 'nav.reports',
    href: routes.careerGuidance.reports,
    icon: <PiNewspaperClippingDuotone />,
  },
  {
    name: 'nav.expertLab',
    href: routes.careerGuidance.expertLab,
    icon: <PiShieldCheckDuotone />,
    badge: 'NEW',
  },

  // ==========================================
  // User Account
  // ==========================================
  { name: 'nav.userAccount' },
  {
    name: 'nav.myProfile',
    href: routes.account.profile,
    icon: <PiUserCircleDuotone />,
  },
  {
    name: 'nav.accountSettings',
    href: routes.forms.profileSettings,
    icon: <PiUserGearDuotone />,
  },

  // ==========================================
  // Admin Panel — only visible to admin/super-admin
  // ==========================================
  { name: 'nav.adminSection', section: 'admin' },
  {
    name: 'nav.adminUsers',
    href: '/admin/users',
    icon: <PiUsersThreeDuotone />,
    section: 'admin',
  },
  {
    name: 'nav.adminAiSettings',
    href: '/admin/ai-settings',
    icon: <PiBrainDuotone />,
    section: 'admin',
  },
  {
    name: 'nav.adminSettings',
    href: '/admin/dashboard',
    icon: <PiGearDuotone />,
    section: 'admin',
  },
];
