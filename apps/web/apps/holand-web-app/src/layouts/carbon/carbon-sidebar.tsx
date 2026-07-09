'use client';

import cn from '@core/utils/class-names';
import Link from 'next/link';
import Logo from '@core/components/logo';
import ProfileCardMenu from '@/layouts/carbon/profile-card-menu';
import { PiDotsThreeVerticalBold, PiHeadsetBold } from 'react-icons/pi';
import dynamic from 'next/dynamic';
import SimpleBar from 'simplebar-react';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import { resolveAvatarSrc } from '@/utils/dicebear/dicebear-avatar-url';
import WorkspaceSidebarIdentity from '@/app/shared/workspace/components/workspace-sidebar-identity';
import { CarbonSidebarMenu } from './carbon-sidebar-menu';

const NeedSupport = dynamic(() => import('@/layouts/carbon/need-support'), {
  ssr: false,
});

export function CarbonSidebar({ className }: { className?: string }) {
  const { data: session } = useSession();
  const { t } = useTranslation();
  const displayName = session?.user?.name || t('header.profile.user');
  const displayEmail = session?.user?.email || '';
  const fallbackSeed = session?.user?.id || session?.user?.username || displayName;
  const avatarUrl = session?.user?.avatarUrl ?? session?.user?.image ?? null;
  const avatarSrc = resolveAvatarSrc(avatarUrl, fallbackSeed);

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
        <WorkspaceSidebarIdentity variant="carbon" className="pb-2" />
      </div>

      <SimpleBar
        className={cn(
          'min-h-0 flex-1 [&_.simplebar-content]:flex [&_.simplebar-content]:h-full [&_.simplebar-content]:flex-col [&_.simplebar-content]:justify-between'
        )}
      >
        <CarbonSidebarMenu />

        <div className="sticky bottom-0 bg-gray-0 dark:bg-gray-50">
          <NeedSupport
            title="Need Support?"
            text="Contact with one of our experts to get support."
            prefixIcon={<PiHeadsetBold className="h-5 w-5 text-gray-400" />}
            className="relative mx-6 before:absolute before:-start-6 before:bottom-full before:end-0 before:h-10 before:w-[calc(100%+48px)] before:bg-gradient-to-t before:from-gray-0 before:to-gray-0/30 before:dark:from-gray-50 before:dark:to-gray-50/30"
          />
        </div>
      </SimpleBar>

      <div className="shrink-0 bg-gray-0 px-6 pb-3 dark:bg-gray-50">
        <ProfileCardMenu
          title={displayName}
          designation={displayEmail}
          placement="top"
          image={avatarSrc}
          avatarClassName="!w-10 !h-10"
          icon={
            <PiDotsThreeVerticalBold
              className={cn(
                'h-7 w-7 text-gray-400 transition-all group-hover:text-primary'
              )}
            />
          }
          className={cn('mt-5 px-0 py-0')}
          buttonClassName="border-0 !border-t !border-gray-200 pt-5 px-0 rounded-none"
        />
      </div>
    </aside>
  );
}
