'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  PiBuildingsDuotone,
  PiCheckBold,
  PiCompassBold,
  PiDotsThreeBold,
  PiGearBold,
  PiGlobeDuotone,
  PiHouseBold,
  PiUsersBold,
} from 'react-icons/pi';
import { ActionIcon, Popover, Text, Title } from 'rizzui';
import cn from '@core/utils/class-names';
import { useLanguage } from '@/providers/language-provider';
import {
  useIsWorkspaceAdmin,
  useWorkspace,
} from '@/contexts/workspace-context';
import { headerActionIconClass } from '@/layouts/header-action-icon-styles';
import { HeaderPopoverWithTooltip } from '@/layouts/header-action-tooltip';
import { LanguageMark } from '@/app/shared/language-mark';
import { routes } from '@/config/routes';

function MoreMenuRow({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start text-sm transition-colors',
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'hover:bg-gray-100 dark:hover:bg-gray-50'
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-50">
        {icon}
      </span>
      <span className="font-medium text-gray-900 dark:text-gray-700">{label}</span>
    </button>
  );
}

/**
 * Mobile overflow (`max-md`) — workspace, language, settings as flat menu rows.
 */
export default function HeaderMoreMenu() {
  const { t } = useTranslation();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const { languages, currentLanguage, changeLanguage } = useLanguage();
  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    clearWorkspace,
    isLoading,
  } = useWorkspace();
  const isAdmin = useIsWorkspaceAdmin(activeWorkspace?.id);

  const label = t('headerMore.openMenu');
  const close = () => setIsOpen(false);

  const go = (href: string) => {
    close();
    router.push(href);
  };

  return (
    <HeaderPopoverWithTooltip label={label}>
      <Popover
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        shadow="sm"
        placement="bottom-end"
      >
        <Popover.Trigger>
          <ActionIcon
            variant="text"
            aria-label={label}
            aria-expanded={isOpen}
            className={cn(headerActionIconClass(isOpen), 'p-1')}
          >
            <PiDotsThreeBold className="h-[18px] w-[18px]" aria-hidden />
          </ActionIcon>
        </Popover.Trigger>
        <Popover.Content className="z-[9999] w-[min(100vw-2rem,280px)] px-0 py-3 dark:bg-gray-100 [&>svg]:hidden">
        <div className="border-b border-muted px-4 pb-3">
          <Title as="h6" fontWeight="semibold" className="text-sm">
            {label}
          </Title>
          <Text className="text-xs text-gray-500">{t('headerMore.subtitle')}</Text>
        </div>

        <div className="flex flex-col gap-0.5 px-2 pt-2">
          <MoreMenuRow
            icon={<PiGearBold className="h-[18px] w-[18px]" />}
            label={t('workspace.preferences.open')}
            onClick={() => go(routes.workspace.preferences)}
          />

          {activeWorkspace && (
            <>
              <Text className="px-3 pt-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                {t('workspace.nav.teamWorkspace')}
              </Text>
              <MoreMenuRow
                icon={<PiHouseBold className="h-[18px] w-[18px]" />}
                label={t('workspace.hub.open')}
                onClick={() => go(routes.workspace.hub(activeWorkspace.id))}
              />
              <MoreMenuRow
                icon={
                  isAdmin ? (
                    <PiGearBold className="h-[18px] w-[18px]" />
                  ) : (
                    <PiCompassBold className="h-[18px] w-[18px]" />
                  )
                }
                label={
                  isAdmin ? t('workspace.settings') : t('workspace.tabs.navigation')
                }
                onClick={() =>
                  go(
                    isAdmin
                      ? routes.workspace.settings(activeWorkspace.id)
                      : routes.workspace.settings(activeWorkspace.id, 'navigation')
                  )
                }
              />
              {isAdmin && (
                <MoreMenuRow
                  icon={<PiUsersBold className="h-[18px] w-[18px]" />}
                  label={t('workspace.nav.workspaceMembers')}
                  onClick={() =>
                    go(routes.workspace.settings(activeWorkspace.id, 'people'))
                  }
                />
              )}
            </>
          )}

          {!isLoading && workspaces.length > 0 ? (
            <>
              <Text className="px-3 pt-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                {t('workspace.workspaceLabel')}
              </Text>
              <MoreMenuRow
                icon={<PiGlobeDuotone className="h-[18px] w-[18px]" />}
                label={t('workspace.allSpaces')}
                onClick={() => {
                  clearWorkspace();
                  close();
                }}
              />
              {workspaces.map((ws) => (
                <MoreMenuRow
                  key={ws.id}
                  icon={<PiBuildingsDuotone className="h-[18px] w-[18px]" />}
                  label={ws.name}
                  onClick={() => {
                    setActiveWorkspace(ws.id);
                    close();
                  }}
                />
              ))}
            </>
          ) : null}

          <Text className="px-3 pt-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            {t('headerMore.language')}
          </Text>
          {languages.map((lang) => {
            const active = currentLanguage === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  changeLanguage(lang.code);
                  close();
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start text-sm transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-50'
                )}
              >
                <LanguageMark code={lang.code} />
                <span className="flex-1 font-medium">{lang.name}</span>
                {active ? <PiCheckBold className="h-4 w-4 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      </Popover.Content>
      </Popover>
    </HeaderPopoverWithTooltip>
  );
}
