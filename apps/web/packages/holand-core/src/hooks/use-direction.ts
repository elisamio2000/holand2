'use client';
import { atom, useAtom } from 'jotai';

// 1. set initial atom for holand direction
const holandDirectionAtom = atom(
  typeof window !== 'undefined' ? localStorage.getItem('holand-direction') : 'ltr'
);

const holandDirectionAtomWithPersistence = atom(
  (get) => get(holandDirectionAtom),
  (get, set, newStorage: any) => {
    set(holandDirectionAtom, newStorage);
    localStorage.setItem('holand-direction', newStorage);
  }
);

// 2. useDirection hook to check which direction is available
export function useDirection() {
  const [direction, setDirection] = useAtom(
    holandDirectionAtomWithPersistence
  );

  return {
    direction: direction === null ? 'ltr' : direction,
    setDirection,
  };
}
