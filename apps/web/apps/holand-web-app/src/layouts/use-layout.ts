'use client';

import { LAYOUT_OPTIONS } from '@/config/enums';
import { atom, useAtom } from 'jotai';

// 1. set initial atom for holand layout
const holandLayoutAtom = atom(
  typeof window !== 'undefined'
    ? localStorage.getItem('holand-layout')
    : LAYOUT_OPTIONS.HYDROGEN
);

const holandLayoutAtomWithPersistence = atom(
  (get) => get(holandLayoutAtom),
  (get, set, newStorage: any) => {
    set(holandLayoutAtom, newStorage);
    localStorage.setItem('holand-layout', newStorage);
  }
);

// 2. useLayout hook to check which layout is available
export function useLayout() {
  const [layout, setLayout] = useAtom(holandLayoutAtomWithPersistence);
  return {
    layout: layout === null ? LAYOUT_OPTIONS.HYDROGEN : layout,
    setLayout,
  };
}
