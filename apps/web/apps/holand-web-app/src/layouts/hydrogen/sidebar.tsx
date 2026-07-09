'use client';

import Link from 'next/link';
import cn from '@core/utils/class-names';
import SimpleBar from '@core/ui/simplebar';
import Logo from '@core/components/logo';
import { SidebarMenu } from './sidebar-menu';

export default function Sidebar({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        'fixed bottom-0 start-0 z-50 grid h-full w-[270px] grid-rows-[auto_1fr] overflow-hidden border-e-2 border-gray-100 bg-white dark:bg-gray-100/50 2xl:w-72',
        className
      )}
    >
      <div className="bg-gray-0/10 pt-5 dark:bg-gray-100/5 2xl:pt-6">
        <div className="px-6 2xl:px-8">
          <Link
            href={'/'}
            aria-label="Site Logo"
            className="inline-block pb-3 text-gray-800 hover:text-gray-900"
          >
            <Logo className="max-w-[155px]" />
          </Link>
        </div>
      </div>

      <div className="h-full min-h-0 overflow-hidden">
        <SimpleBar className="h-full">
          <SidebarMenu />
        </SimpleBar>
      </div>
    </aside>
  );
}
