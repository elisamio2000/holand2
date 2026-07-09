import Link from 'next/link';
import cn from '@core/utils/class-names';
import SimpleBar from '@core/ui/simplebar';
import Logo from '@core/components/logo';
import { SidebarMenu } from '../hydrogen/sidebar-menu';

export function CarbonDrawerSidebar({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        'fixed bottom-0 start-0 z-50 flex h-full w-[270px] flex-col border-e-2 border-gray-100 bg-white dark:bg-gray-100/50 2xl:w-72',
        className
      )}
    >
      <div className="shrink-0 bg-gray-0/10 pt-5 dark:bg-gray-100/5 2xl:pt-6">
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

      <SimpleBar className="min-h-0 flex-1">
        <SidebarMenu />
      </SimpleBar>
    </aside>
  );
}
