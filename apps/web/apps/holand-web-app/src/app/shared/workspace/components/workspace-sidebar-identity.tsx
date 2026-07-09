'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Popover } from 'rizzui';
import cn from '@core/utils/class-names';
import { PiCaretUpDownBold, PiGlobeDuotone } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import {
  useWorkspace,
  useWorkspaceRole,
} from '@/contexts/workspace-context';
import WorkspaceAvatar from '@/app/shared/workspace/components/workspace-avatar';
import WorkspaceRoleBadge from '@/app/shared/workspace/components/workspace-role-badge';
import WorkspaceIdentityShortcuts from '@/app/shared/workspace/components/workspace-identity-shortcuts';
import CreateWorkspaceModal from '@/app/shared/workspace/create-workspace-modal';
import WorkspaceSwitcherMenu from '@/layouts/workspace-switcher-menu';
import { routes } from '@/config/routes';

interface WorkspaceSidebarIdentityProps {
  className?: string;
  /** Tighter padding for carbon sidebar (px-6). */
  variant?: 'hydrogen' | 'carbon';
}

/**
 * Sidebar workspace switcher — floating popover (does not shift menu layout).
 */
export default function WorkspaceSidebarIdentity({
  className,
  variant = 'hydrogen',
}: WorkspaceSidebarIdentityProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { workspaces, activeWorkspace, setActiveWorkspace, clearWorkspace, isLoading } =
    useWorkspace();
  const role = useWorkspaceRole(activeWorkspace?.id);
  const [isOpen, setIsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const paddingClass = variant === 'carbon' ? 'px-6' : 'px-3 2xl:px-5';

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  if (isLoading) {
    return (
      <div className={cn('mb-3', paddingClass, className)} aria-busy="true">
        <div
          className={cn(
            'animate-pulse rounded-lg border border-gray-200 bg-gray-100/50',
            variant === 'carbon' ? 'h-[52px]' : 'h-11'
          )}
        />
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className={cn('mb-3', paddingClass, className)}>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2.5',
            'text-sm font-medium text-gray-600 transition-colors hover:border-primary/40 hover:bg-primary/5'
          )}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            +
          </span>
          {t('workspace.create')}
        </button>
        <CreateWorkspaceModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      </div>
    );
  }

  const id = activeWorkspace?.id;
  const hubHref = id ? routes.workspace.hub(id) : null;
  const hubActive =
    hubHref != null && (pathname === hubHref || pathname.startsWith(`${hubHref}/`));

  return (
    <>
      <div className={cn('relative mb-3', paddingClass, className)}>
        <Popover
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          shadow="sm"
          placement="bottom-start"
        >
          <Popover.Trigger>
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-lg border border-gray-300 px-3 py-2',
                'text-sm font-medium text-gray-700 transition-colors',
                'hover:bg-gray-50 dark:border-gray-300 dark:hover:bg-gray-100',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                hubActive && 'border-primary/40 bg-primary/5',
                variant === 'carbon' && 'min-h-[52px] border-2 border-gray-100 py-2.5'
              )}
            >
              {activeWorkspace ? (
                <WorkspaceAvatar workspaceId={activeWorkspace.id} size="sm" />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <PiGlobeDuotone className="h-5 w-5 text-primary" />
                </span>
              )}
              <span className="min-w-0 flex-1 text-start">
                <span className="block truncate font-semibold">
                  {activeWorkspace?.name ?? t('workspace.allSpaces')}
                </span>
                {activeWorkspace ? (
                  <WorkspaceRoleBadge role={role} className="mt-0.5" />
                ) : (
                  <span className="mt-0.5 block text-xs text-gray-500">
                    {t('workspace.selectActive')}
                  </span>
                )}
              </span>
              <PiCaretUpDownBold className="h-3.5 w-3.5 shrink-0 text-gray-500" />
            </button>
          </Popover.Trigger>

          <Popover.Content
            className="z-[10050] w-[min(100vw-2rem,288px)] p-0 dark:bg-gray-100 [&>svg]:dark:fill-gray-100"
          >
            {activeWorkspace && (
              <>
                <div className="border-b border-gray-300 px-3 py-2.5 dark:border-gray-300">
                  <div className="flex items-center gap-2">
                    <WorkspaceAvatar workspaceId={activeWorkspace.id} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{activeWorkspace.name}</p>
                      <WorkspaceRoleBadge role={role} />
                    </div>
                  </div>
                </div>

                <WorkspaceIdentityShortcuts
                  workspaceId={activeWorkspace.id}
                  onNavigate={() => setIsOpen(false)}
                />
              </>
            )}

            <WorkspaceSwitcherMenu
              workspaces={workspaces}
              activeWorkspace={activeWorkspace}
              onSelectWorkspace={setActiveWorkspace}
              onClearWorkspace={clearWorkspace}
              onCreateClick={() => setCreateOpen(true)}
              onClose={() => setIsOpen(false)}
              showFooterSettings={false}
              hideHeader={Boolean(activeWorkspace)}
              showQuickActions={false}
            />
          </Popover.Content>
        </Popover>
      </div>

      <CreateWorkspaceModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
