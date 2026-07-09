'use client';

import { useTranslation } from 'react-i18next';
import { Text } from 'rizzui';
import cn from '@core/utils/class-names';
import { useWorkspaceScope } from '@/hooks/use-workspace-scope';

interface WorkspaceScopeBannerProps {
  className?: string;
  /** When true, show banner only if no workspace selected */
  requireWorkspace?: boolean;
}

export default function WorkspaceScopeBanner({
  className,
  requireWorkspace = true,
}: WorkspaceScopeBannerProps) {
  const { t } = useTranslation();
  const { isAllWorkspaces, workspaceLabel } = useWorkspaceScope();

  if (requireWorkspace && !isAllWorkspaces) return null;

  if (!requireWorkspace && workspaceLabel) {
    return (
      <div
        className={cn(
          'mb-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2',
          className
        )}
      >
        <Text className="text-xs text-primary">
          {t('workspace.scopeBanner.active', { name: workspaceLabel })}
        </Text>
      </div>
    );
  }

  if (!isAllWorkspaces) return null;

  return (
    <div
      className={cn(
        'mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/30',
        className
      )}
    >
      <Text className="text-xs text-amber-800 dark:text-amber-200">
        {t('workspace.scopeBanner.allWorkspaces')}
      </Text>
    </div>
  );
}
