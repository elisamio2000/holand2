'use client';

import { useCallback } from 'react';
import { atom, useAtomValue, useSetAtom } from 'jotai';
import { ModalSize } from 'rizzui';

type ModalTypes = {
  view: React.ReactNode;
  isOpen: boolean;
  customSize?: string;
  size?: ModalSize;
};

const modalAtom = atom<ModalTypes>({
  isOpen: false,
  view: null,
  customSize: '320px',
  size: 'sm',
});

export function useModal() {
  const state = useAtomValue(modalAtom);
  const setState = useSetAtom(modalAtom);

  const openModal = useCallback(
    ({
      view,
      customSize,
      size,
    }: {
      view: React.ReactNode;
      customSize?: string;
      size?: ModalSize;
    }) => {
      setState((prev) => ({
        ...prev,
        isOpen: true,
        view,
        customSize,
        size,
      }));
    },
    [setState]
  );

  const closeModal = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, [setState]);

  return {
    ...state,
    openModal,
    closeModal,
  };
}
