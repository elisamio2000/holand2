// ============================================
// ProfileMenu — User profile dropdown in header
// Shows real user data from next-auth session
// ============================================
'use client';

import { Title, Text, Button, Popover } from 'rizzui';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authService } from '@/services/auth.service';
import UserAvatar from '@/components/user-avatar';
import { HeaderPopoverWithTooltip } from '@/layouts/header-action-tooltip';

/**
 * ProfileMenu — Header profile dropdown with real user session data.
 *
 * Displays user avatar, name and email from the next-auth session.
 * Falls back to initials-based avatar when no image is available.
 *
 * @param buttonClassName - Additional classes for the trigger button
 * @param avatarClassName - Additional classes for the avatar
 * @param username - Whether to show the username text next to avatar
 *
 * @requires next-auth/react — useSession for current user data
 *
 * @example
 * ```tsx
 * <ProfileMenu username />
 * ```
 */
export default function ProfileMenu({
  buttonClassName,
  avatarClassName,
  username = false,
}: {
  buttonClassName?: string;
  avatarClassName?: string;
  username?: boolean;
}) {
  const { data: session } = useSession();
  const { t } = useTranslation();

  // Extract user info from session, with safe fallbacks
  const displayName = session?.user?.name || t('header.profile.user');
  const fallbackSeed = session?.user?.id || session?.user?.username || displayName;
  const avatarUrl = session?.user?.avatarUrl ?? session?.user?.image ?? null;
  const menuLabel = t('header.profile.openMenu');

  return (
    <HeaderPopoverWithTooltip label={menuLabel}>
      <ProfileMenuPopover>
        <Popover.Trigger>
          <button
            type="button"
            aria-label={menuLabel}
            className={cn(
              'w-9 shrink-0 rounded-full outline-none focus-visible:ring-[1.5px] focus-visible:ring-gray-400 focus-visible:ring-offset-2 active:translate-y-px sm:w-10',
              buttonClassName
            )}
          >
            <UserAvatar
              avatarUrl={avatarUrl}
              fallbackSeed={fallbackSeed}
              name={displayName}
              className={cn('!h-9 w-9 sm:!h-10 sm:!w-10', avatarClassName)}
              avatarProps={{ title: '' }}
            />
            {!!username && (
              <span className="username hidden text-gray-200 dark:text-gray-700 md:inline-flex">
                {displayName}
              </span>
            )}
          </button>
        </Popover.Trigger>

        <Popover.Content className="z-[9999] p-0 dark:bg-gray-100 [&>svg]:dark:fill-gray-100">
          <DropdownMenu session={session} />
        </Popover.Content>
      </ProfileMenuPopover>
    </HeaderPopoverWithTooltip>
  );
}

function ProfileMenuPopover({ children }: React.PropsWithChildren<{}>) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <Popover
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      shadow="sm"
      placement="bottom-end"
    >
      {children}
    </Popover>
  );
}

const menuItems = [
  {
    nameKey: 'header.profile.myProfile',
    href: routes.account.profile,
  },
  {
    nameKey: 'header.profile.accountSettings',
    href: routes.account.security,
  },
  {
    nameKey: 'header.profile.activityLog',
    href: routes.account.activity,
  },
];

function DropdownMenu({ session }: { session: any }) {
  const { t } = useTranslation();

  const displayName = session?.user?.name || t('header.profile.user');
  const displayEmail = session?.user?.email || '';
  const fallbackSeed = session?.user?.id || session?.user?.username || displayName;
  const avatarUrl = session?.user?.avatarUrl ?? session?.user?.image ?? null;

  return (
    <div className="w-64 text-left rtl:text-right">
      <div className="flex items-center border-b border-gray-300 px-6 pb-5 pt-6">
        <UserAvatar
          avatarUrl={avatarUrl}
          fallbackSeed={fallbackSeed}
          name={displayName}
        />
        <div className="ms-3">
          <Title as="h6" className="font-semibold">
            {displayName}
          </Title>
          <Text className="text-gray-600">{displayEmail}</Text>
        </div>
      </div>
      <div className="grid px-3.5 py-3.5 font-medium text-gray-700">
        {menuItems.map((item) => (
          <Link
            key={item.nameKey}
            href={item.href}
            className="group my-0.5 flex items-center rounded-md px-2.5 py-2 hover:bg-gray-100 focus:outline-none hover:dark:bg-gray-50/50"
          >
            {t(item.nameKey)}
          </Link>
        ))}
      </div>
      <div className="border-t border-gray-300 px-6 pb-6 pt-5">
        <Button
          className="h-auto w-full justify-start p-0 font-medium text-gray-700 outline-none focus-within:text-gray-600 hover:text-gray-900 focus-visible:ring-0"
          variant="text"
          onClick={async () => {
            console.info('[ProfileMenu] User initiated sign out');
            // Invalidate the Keycloak session on the backend before clearing
            // the local NextAuth session. Without this, the refresh token remains
            // active on the server and the user's session is not truly terminated.
            const refreshToken = (session?.user as any)?.refreshToken as string | undefined;
            if (refreshToken) {
              try {
                await authService.logout(refreshToken);
              } catch (err) {
                // Don't block sign-out if backend logout fails —
                // clear the local session regardless.
                console.warn('[ProfileMenu] Backend logout failed (proceeding anyway):', err);
              }
            }
            // Use redirect:false to bypass next-auth's NEXTAUTH_URL domain validation.
            // Without this, next-auth validates the callbackUrl against NEXTAUTH_URL
            // (which is hardcoded to localhost:3001) and rejects any other host,
            // causing the user to land on localhost:3001 instead of the current domain.
            // We manually navigate to /signin after clearing the session.
            await signOut({ redirect: false });
            window.location.href = routes.signIn;
          }}
        >
          {t('header.profile.signOut')}
        </Button>
      </div>
    </div>
  );
}
