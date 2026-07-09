// ============================================
// ProfileHeader — Real user profile header
// Displays current user info from NextAuth session
// ============================================
'use client';

import { useSession } from 'next-auth/react';
import { Avatar, Title, Text, Badge, Loader } from 'rizzui';
import cn from '@core/utils/class-names';
import { PiShieldCheckBold, PiEnvelopeSimpleBold, PiUserBold } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import { useLayout } from '@/layouts/use-layout';
import { LAYOUT_OPTIONS } from '@/config/enums';
import { useBerylliumSidebars } from '@/layouts/beryllium/beryllium-utils';

/**
 * ProfileHeader — Shows the current logged-in user's profile info.
 *
 * Uses ONLY session data from NextAuth JWT — no additional API calls needed.
 * Session already contains: id, username, email, displayName, roles,
 * permissions, allowedSections, isAdmin, isSuperAdmin, groups.
 *
 * WHY no adminService.getUserById(): That endpoint (GET /admin/users/{user_id})
 * requires admin:users permission and returns a different schema (UserInfo)
 * than what the profile needs. Session data is sufficient and works for all users.
 *
 * @requires next-auth/react — useSession for all user data
 */
export default function ProfileHeader() {
  const { t } = useTranslation();
  const { layout } = useLayout();
  const { expandedLeft } = useBerylliumSidebars();
  const { data: session, status } = useSession();

  const displayName = session?.user?.displayName || session?.user?.username || session?.user?.name || t('header.profile.user');
  const username = session?.user?.username || '';
  const email = session?.user?.email || '';
  const roles = session?.user?.roles || [];
  const isAdmin = session?.user?.isAdmin || false;
  const isSuperAdmin = session?.user?.isSuperAdmin || false;

  return (
    <div
      className={cn(
        layout === LAYOUT_OPTIONS.LITHIUM ? '3xl:-mt-4' : 'mt-0',
        layout === LAYOUT_OPTIONS.BORON && '-mt-[15px] 2xl:-mt-8'
      )}
    >
      <div
        className={cn(
          '-mx-6 h-[150px] bg-gradient-to-r from-[#F8E1AF] to-[#F6CFCF] @5xl:h-[200px] 3xl:-mx-8 3xl:h-[250px] 4xl:-mx-10 4xl:h-[300px]',
          layout === LAYOUT_OPTIONS.BERYLLIUM &&
            (expandedLeft
              ? 'xl:-me-8 3xl:-ms-5 4xl:-ms-4'
              : 'xl:-me-8 4xl:-ms-6')
        )}
      />

      <div className="mx-auto w-full max-w-[1294px] @container @5xl:mt-0 @5xl:pt-4 sm:flex sm:justify-between">
        <div className="flex h-auto gap-4 @5xl:gap-6">
          <div>
            <div className="relative -top-1/3 aspect-square w-[110px] overflow-hidden rounded-full border-4 border-white bg-white shadow-profilePic @2xl:w-[130px] @5xl:-top-2/3 @5xl:w-[150px] md:border-[6px] 3xl:w-[200px]">
              <Avatar
                name={displayName}
                className="!h-full !w-full text-3xl"
              />
            </div>
          </div>
          <div className="pt-2.5">
            {status === 'loading' ? (
              <Loader variant="spinner" size="sm" className="my-2" />
            ) : (
              <>
                <Title
                  as="h1"
                  className="text-lg font-bold capitalize leading-normal text-gray-900 @3xl:!text-xl 3xl:text-2xl"
                >
                  {displayName}
                </Title>
                {username && (
                  <Text className="text-xs text-gray-500 @3xl:text-sm 3xl:text-base">
                    @{username}
                  </Text>
                )}
              </>
            )}

            {/* Roles & status */}
            <div className="mt-3 flex flex-wrap items-center gap-2 @3xl:mt-4">
              {isSuperAdmin && (
                <Badge variant="flat" color="danger" className="text-sm">
                  <PiShieldCheckBold className="me-1 h-3.5 w-3.5" />
                  Super Admin
                </Badge>
              )}
              {isAdmin && !isSuperAdmin && (
                <Badge variant="flat" color="warning" className="text-sm">
                  <PiShieldCheckBold className="me-1 h-3.5 w-3.5" />
                  Admin
                </Badge>
              )}
              {roles
                .filter((r) => r !== 'super-admin' && r !== 'admin')
                .map((role) => (
                  <Badge key={role} variant="flat" color="info" className="capitalize text-sm">
                    {role}
                  </Badge>
                ))}
            </div>

            {/* Email */}
            {email && (
              <div className="mt-2 flex items-center gap-1.5 text-sm text-gray-500">
                <PiEnvelopeSimpleBold className="h-4 w-4" />
                <span>{email}</span>
              </div>
            )}

            {/* User ID */}
            {session?.user?.id && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                <PiUserBold className="h-3.5 w-3.5" />
                <span className="font-mono">{session.user.id.substring(0, 8)}...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
