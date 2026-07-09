export const CART_KEY = 'holand-cart';
export const POS_CART_KEY = 'holand-pos-cart';
export const DUMMY_ID = 'FC6723757651DB74';
export const CHECKOUT = 'holand-checkout';
export const CURRENCY_CODE = 'USD';
export const LOCALE = 'en';
export const CURRENCY_OPTIONS = {
  formation: 'en-US',
  fractions: 2,
};

import { getImportWsBaseUrl } from '@/lib/service-urls';

/** File Explorer: face search requires FE-BE-4 official tool path */
export const FILE_EXPLORER_FACE_SEARCH_ENABLED = false;

/** WebSocket base for import realtime (queue, case progress, staging). */
export function resolveWsBaseUrl(): string {
  return getImportWsBaseUrl();
}

export const ROW_PER_PAGE_OPTIONS = [
  {
    value: 5,
    name: '5',
  },
  {
    value: 10,
    name: '10',
  },
  {
    value: 15,
    name: '15',
  },
  {
    value: 20,
    name: '20',
  },
];

export const ROLES = {
  Administrator: 'Administrator',
  Manager: 'Manager',
  Sales: 'Sales',
  Support: 'Support',
  Developer: 'Developer',
  HRD: 'HR Department',
  RestrictedUser: 'Restricted User',
  Customer: 'Customer',
} as const;
