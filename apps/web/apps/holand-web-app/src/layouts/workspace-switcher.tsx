'use client';

import { useState } from 'react';
import { Popover } from 'rizzui';
import cn from '@core/utils/class-names';
import { PiCaretUpDownBold, PiBuildingsDuotone } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import { useWorkspace } from '@/contexts/workspace-context';
import WorkspaceSwitcherMenu from '@/layouts/workspace-switcher-menu';
import CreateWorkspaceModal from '@/app/shared/workspace/create-workspace-modal';
import WorkspaceAvatar from '@/app/shared/workspace/components/workspace-avatar';
import WorkspaceRoleBadge from '@/app/shared/workspace/components/workspace-role-badge';
import { HeaderActionTooltip, HeaderPopoverWithTooltip } from '@/layouts/header-action-tooltip';

export default function WorkspaceSwitcher() {
  const { t } = useTranslation();
  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    clearWorkspace,
    isLoading,
  } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  if (!isLoading && workspaces.length === 0) {
    const createLabel = t('workspace.create');
    return (
      <>
        <HeaderActionTooltip content={createLabel}>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            aria-label={createLabel}
            className={cn(
              'flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2',
              'text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50'
            )}
          >
            <PiBuildingsDuotone className="h-5 w-5 text-primary" />
            <span className="hidden sm:inline">{createLabel}</span>
          </button>
        </HeaderActionTooltip>
        <CreateWorkspaceModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      </>
    );
  }

  const switchLabel = t('header.workspace.switchWorkspace');

  return (
    <>
      <HeaderPopoverWithTooltip label={switchLabel}>
        <Popover isOpen={isOpen} setIsOpen={setIsOpen} shadow="sm" placement="bottom-start">
          <Popover.Trigger>
            <button
              type="button"
              aria-label={switchLabel}
              className={cn(
                'relative flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2',
                'text-sm font-medium text-gray-700 transition-colors',
                'hover:bg-gray-50 dark:border-gray-300 dark:text-gray-700',
                'dark:hover:bg-gray-100 focus:outline-none focus-visible:ring-2',
                'focus-visible:ring-primary'
              )}
            >
              {activeWorkspace ? (
                <WorkspaceAvatar workspaceId={activeWorkspace.id} size="sm" />
              ) : (
                <PiBuildingsDuotone className="h-5 w-5 text-primary" />
              )}
              <span className="hidden max-w-[120px] truncate sm:inline">
                {activeWorkspace ? activeWorkspace.name : t('workspace.allSpaces')}
              </span>
              {activeWorkspace && (
                <span
                  className="absolute -end-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary"
                  aria-hidden
                />
              )}
              <PiCaretUpDownBold className="h-3.5 w-3.5 text-gray-500" />
            </button>
          </Popover.Trigger>

          <Popover.Content className="z-[9999] w-[min(100vw-2rem,288px)] p-0 dark:bg-gray-100 [&>svg]:dark:fill-gray-100">
          {activeWorkspace && (
            <div className="border-b border-gray-300 px-3 py-2.5 dark:border-gray-300">
              <div className="flex items-center gap-2">
                <WorkspaceAvatar workspaceId={activeWorkspace.id} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{activeWorkspace.name}</p>
                  <WorkspaceRoleBadge role={activeWorkspace.role} />
                </div>
              </div>
            </div>
          )}
          <WorkspaceSwitcherMenu
            workspaces={workspaces}
            activeWorkspace={activeWorkspace}
            onSelectWorkspace={setActiveWorkspace}
            onClearWorkspace={clearWorkspace}
            onCreateClick={() => setCreateOpen(true)}
            onClose={() => setIsOpen(false)}
            hideHeader={Boolean(activeWorkspace)}
            showQuickActions
          />
          </Popover.Content>
        </Popover>
      </HeaderPopoverWithTooltip>

      <CreateWorkspaceModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
