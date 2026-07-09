'use client';

import Link from 'next/link';
import MessagesDropdown from '@/layouts/messages-dropdown';
import ProfileMenu from '@/layouts/profile-menu';
import HeaderAiChatLauncher from '@/layouts/header-ai-chat-launcher';
import HeaderHelpLauncher from '@/layouts/header-help-launcher';
import HeaderMoreMenu from '@/layouts/header-more-menu';
import LanguageSwitcher from '@/layouts/language-switcher';
import NotificationDropdown from './notification-dropdown';
import { ActionIcon } from 'rizzui';
import { PiBellBold, PiChatCircleDotsBold, PiPaletteBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';
import { headerActionIconClass } from '@/layouts/header-action-icon-styles';
import { usePermissions } from '@/hooks/use-permissions';
import { routes } from '@/config/routes';

/**
 * HeaderMenuRight — Right-side header controls.
 *
 * Desktop: AI → Help → Account Appearance → Lang → Notify → Messages → Profile
 * Mobile:  AI → Help → Notify → Messages → More → Profile
 */
export default function HeaderMenuRight() {
  const { t } = useTranslation();
  const { canAccessSection, hasRole, isLoading } = usePermissions();
  const iconClass = headerActionIconClass();
  const notificationsLabel = t('header.notifications');
  const messagesLabel = t('headerMessages.title');
  const showMessages = isLoading || canAccessSection('messages');
  const showAppearance = isLoading || !hasRole('pending');

  return (
    <div className="ms-auto flex shrink-0 items-center gap-1.5 text-gray-700 xs:gap-2 xl:gap-2.5">
      <HeaderAiChatLauncher />
      <HeaderHelpLauncher />

      <div className="hidden md:contents">
        {showAppearance ? (
          <Link
            href={routes.account.appearance}
            aria-label={t('adminSettings.tabAppearance')}
            className={cn(
              iconClass,
              'inline-flex items-center justify-center rounded-md p-1'
            )}
          >
            <PiPaletteBold className="h-[18px] w-[18px]" aria-hidden />
          </Link>
        ) : null}
        <LanguageSwitcher />
      </div>

      <NotificationDropdown tooltipLabel={notificationsLabel}>
        <ActionIcon
          aria-label={notificationsLabel}
          variant="text"
          className={cn(iconClass, 'p-1')}
        >
          <PiBellBold className="h-[18px] w-[18px]" aria-hidden />
        </ActionIcon>
      </NotificationDropdown>

      {showMessages ? (
        <MessagesDropdown tooltipLabel={messagesLabel}>
          <ActionIcon
            aria-label={messagesLabel}
            variant="text"
            className={cn(iconClass, 'p-1')}
          >
            <PiChatCircleDotsBold className="h-[18px] w-[18px]" aria-hidden />
          </ActionIcon>
        </MessagesDropdown>
      ) : null}

      <div className="md:hidden">
        <HeaderMoreMenu />
      </div>

      <ProfileMenu />
    </div>
  );
}
