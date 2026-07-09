'use client';

import { Tooltip } from '@/components/tooltip';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Text, Title } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  PiChatCenteredDotsBold,
  PiCheckBold,
  PiCompassBold,
  PiFolderBold,
  PiGearBold,
  PiGlobeDuotone,
  PiPlusBold,
  PiSquaresFourBold,
  PiStarBold,
  PiStarFill,
  PiUsersBold,
} from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import { routes } from '@/config/routes';
import type { WorkspaceInfo } from '@/contexts/workspace-context';
import { useIsWorkspaceAdmin } from '@/contexts/workspace-context';
import WorkspaceAvatar from '@/app/shared/workspace/components/workspace-avatar';
import WorkspaceRoleBadge from '@/app/shared/workspace/components/workspace-role-badge';
import { isWorkspaceHome, setWorkspaceHomeId } from '@/lib/workspace-branding';

export interface WorkspaceSwitcherMenuProps {
  workspaces: WorkspaceInfo[];
  activeWorkspace: WorkspaceInfo | null;
  onSelectWorkspace: (id: string) => void;
  onClearWorkspace: () => void;
  onCreateClick?: () => void;
  onClose?: () => void;
  showCreate?: boolean;
  showSettingsLink?: boolean;
  showFooterSettings?: boolean;
  hideHeader?: boolean;
  /** When false, hides Quick Actions block (sidebar embed). */
  showQuickActions?: boolean;
}

export default function WorkspaceSwitcherMenu({
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
  onClearWorkspace,
  onCreateClick,
  onClose,
  showCreate = true,
  showSettingsLink = true,
  showFooterSettings = false,
  hideHeader = false,
  showQuickActions = true,
}: WorkspaceSwitcherMenuProps) {
  const { t } = useTranslation();
  const isAdmin = useIsWorkspaceAdmin(activeWorkspace?.id);
  const close = () => onClose?.();

  const settingsHref = activeWorkspace
    ? isAdmin
      ? routes.workspace.settings(activeWorkspace.id)
      : routes.workspace.settings(activeWorkspace.id, 'navigation')
    : '#';

  const handleSetHome = (workspaceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const already = isWorkspaceHome(workspaceId);
    setWorkspaceHomeId(already ? null : workspaceId);
    toast.success(already ? t('workspace.home.cleared') : t('workspace.home.set'), {
      icon: already ? '✓' : '⭐',
    });
  };

  return (
    <>
      {!hideHeader && (
        <div className="border-b border-gray-300 px-4 py-3 dark:border-gray-300">
          <Title as="h6" className="text-sm font-semibold">
            {t('workspace.workspaceLabel')}
          </Title>
          <Text className="text-xs text-gray-500">{t('workspace.selectActive')}</Text>
        </div>
      )}

      <div className="max-h-[min(50vh,320px)] overflow-y-auto overscroll-contain p-2">
        <div
          className={cn(
            'group flex w-full items-center gap-0.5 rounded-md text-sm transition-colors',
            !activeWorkspace
              ? 'bg-primary/10'
              : 'hover:bg-gray-100 dark:hover:bg-gray-50/50'
          )}
        >
          <button
            type="button"
            onClick={() => {
              onClearWorkspace();
              close();
            }}
            className={cn(
              'flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-start',
              !activeWorkspace && 'text-primary'
            )}
          >
            <PiGlobeDuotone className="h-5 w-5 shrink-0" />
            <span className="flex-1 font-medium">{t('workspace.allSpaces')}</span>
            {!activeWorkspace && <PiCheckBold className="h-4 w-4 shrink-0 text-primary" />}
          </button>
          <Tooltip content={t('workspace.preferences.open')} placement="top">
            <Link
              href={routes.workspace.preferences}
              onClick={close}
              className="shrink-0 rounded-md p-2 text-gray-500 transition-colors hover:text-primary"
            >
              <PiGearBold className="h-4 w-4" />
            </Link>
          </Tooltip>
        </div>

        {workspaces.length === 0 ? (
          <Text className="px-3 py-2 text-xs text-gray-500">{t('workspace.noWorkspacesYet')}</Text>
        ) : null}

        {workspaces.map((ws) => {
          const isHome = isWorkspaceHome(ws.id);
          const isActive = activeWorkspace?.id === ws.id;
          return (
            <div
              key={ws.id}
              className={cn(
                'group flex w-full items-center gap-0.5 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-primary/10'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-50/50'
              )}
            >
              <button
                type="button"
                onClick={() => {
                  onSelectWorkspace(ws.id);
                  close();
                }}
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-start',
                  isActive && 'text-primary'
                )}
              >
                <WorkspaceAvatar workspaceId={ws.id} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{ws.name}</span>
                    {isHome && (
                      <PiStarFill className="h-3 w-3 shrink-0 text-amber-500" aria-hidden />
                    )}
                  </div>
                  <WorkspaceRoleBadge role={ws.role} />
                  {ws.description && (
                    <Text className="line-clamp-1 text-xs text-gray-500">{ws.description}</Text>
                  )}
                </div>
                {isActive && <PiCheckBold className="h-4 w-4 shrink-0 text-primary" />}
              </button>
              <Tooltip
                content={
                  isHome ? t('workspace.home.clearAction') : t('workspace.home.setAction')
                }
                placement="top"
              >
                <button
                  type="button"
                  onClick={(e) => handleSetHome(ws.id, e)}
                  className={cn(
                    'shrink-0 rounded-md p-2 transition-colors',
                    isHome ? 'text-amber-500' : 'text-gray-500 hover:text-amber-500'
                  )}
                >
                  {isHome ? (
                    <PiStarFill className="h-4 w-4" />
                  ) : (
                    <PiStarBold className="h-4 w-4" />
                  )}
                </button>
              </Tooltip>
              <Tooltip content={t('workspace.hub.open')} placement="top">
                <Link
                  href={routes.workspace.hub(ws.id)}
                  onClick={close}
                  className="shrink-0 rounded-md p-2 text-gray-500 transition-colors hover:text-primary"
                >
                  <PiSquaresFourBold className="h-4 w-4" />
                </Link>
              </Tooltip>
            </div>
          );
        })}
      </div>

      {showQuickActions && activeWorkspace && (
        <div className="border-t border-gray-300 px-2 py-2 dark:border-gray-300">
          <Text className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {t('workspace.hub.quickActions')}
          </Text>
          <div className="grid grid-cols-2 gap-1">
            <Link
              href={routes.workspace.hub(activeWorkspace.id)}
              onClick={close}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs hover:bg-gray-100"
            >
              <PiSquaresFourBold className="h-3.5 w-3.5" />
              {t('workspace.hub.open')}
            </Link>
            {isAdmin && (
              <Link
                href={routes.workspace.settings(activeWorkspace.id, 'people')}
                onClick={close}
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs hover:bg-gray-100"
              >
                <PiUsersBold className="h-3.5 w-3.5" />
                {t('workspace.nav.workspaceMembers')}
              </Link>
            )}
            <Link
              href={routes.aiChat.root}
              onClick={close}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs hover:bg-gray-100"
            >
              <PiChatCenteredDotsBold className="h-3.5 w-3.5" />
              {t('workspace.hub.newChat')}
            </Link>
            <Link
              href={routes.caseImporter.import()}
              onClick={close}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs hover:bg-gray-100"
            >
              <PiFolderBold className="h-3.5 w-3.5" />
              {t('workspace.hub.newCase')}
            </Link>
            {showSettingsLink && (
              <Link
                href={settingsHref}
                onClick={close}
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs hover:bg-gray-100"
              >
                {isAdmin ? (
                  <PiGearBold className="h-3.5 w-3.5" />
                ) : (
                  <PiCompassBold className="h-3.5 w-3.5" />
                )}
                {isAdmin ? t('workspace.settings') : t('workspace.tabs.navigation')}
              </Link>
            )}
          </div>
        </div>
      )}

      {(showCreate || (showFooterSettings && showSettingsLink && activeWorkspace)) && (
        <div className="border-t border-gray-300 p-2 dark:border-gray-300">
          {showCreate && onCreateClick && (
            <button
              type="button"
              onClick={() => {
                onCreateClick();
                close();
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5"
            >
              <PiPlusBold className="h-4 w-4" />
              {t('workspace.create')}
            </button>
          )}
        </div>
      )}
    </>
  );
}
