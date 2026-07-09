'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Modal } from 'rizzui';
import SearchTrigger from './search-trigger';
import SearchList from './search-list';

export default function SearchWidget({
  className,
  placeholderClassName,
  icon,
}: {
  className?: string;
  icon?: React.ReactNode;
  placeholderClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useTranslation();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        if (pathname?.startsWith('/event-calendar')) return;
        event.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pathname]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <SearchTrigger
        icon={icon}
        className={className}
        onClick={() => setOpen(true)}
        placeholderClassName={placeholderClassName}
        t={t}
      />

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        overlayClassName="dark:bg-opacity-20 dark:bg-gray-50 dark:backdrop-blur-sm"
        containerClassName="dark:bg-gray-100/90 overflow-hidden dark:backdrop-blur-xl"
        className="z-[9999]"
      >
        <SearchList onClose={() => setOpen(false)} />
      </Modal>
    </>
  );
}
