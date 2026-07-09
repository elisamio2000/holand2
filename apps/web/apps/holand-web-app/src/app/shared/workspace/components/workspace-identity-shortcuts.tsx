'use client';

import Link from 'next/link';
import { Text } from 'rizzui';
import { useTranslation } from 'react-i18next';
import {
  PiGearBold,
  PiSquaresFourBold,
  PiUsersBold,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { useIsWorkspaceAdmin } from '@/contexts/workspace-context';

interface WorkspaceIdentityShortcutsProps {
  workspaceId: string;
  onNavigate?: () => void;
}

export default function WorkspaceIdentityShortcuts({
  workspaceId,
  onNavigate,
}: WorkspaceIdentityShortcutsProps) {
  const { t } = useTranslation();
  const isAdmin = useIsWorkspaceAdmin(workspaceId);
  const close = () => onNavigate?.();

  const settingsHref = isAdmin
    ? routes.workspace.settings(workspaceId)
    : routes.workspace.settings(workspaceId, 'navigation');

  return (
    <div className="grid grid-cols-3 gap-1 border-b border-gray-300 px-2 py-2 dark:border-gray-300">
      <Link
        href={routes.workspace.hub(workspaceId)}
        onClick={close}
        className="flex flex-col items-center gap-1 rounded-md px-1 py-2 text-center text-xs text-gray-600 transition-colors hover:bg-gray-100 hover:text-primary dark:hover:bg-gray-50/50"
      >
        <PiSquaresFourBold className="h-4 w-4" />
        <Text className="text-[10px] leading-tight">{t('workspace.hub.open')}</Text>
      </Link>
      <Link
        href={settingsHref}
        onClick={close}
        className="flex flex-col items-center gap-1 rounded-md px-1 py-2 text-center text-xs text-gray-600 transition-colors hover:bg-gray-100 hover:text-primary dark:hover:bg-gray-50/50"
      >
        <PiGearBold className="h-4 w-4" />
        <Text className="text-[10px] leading-tight">{t('workspace.settings')}</Text>
      </Link>
      {isAdmin ? (
        <Link
          href={routes.workspace.settings(workspaceId, 'people')}
          onClick={close}
          className="flex flex-col items-center gap-1 rounded-md px-1 py-2 text-center text-xs text-gray-600 transition-colors hover:bg-gray-100 hover:text-primary dark:hover:bg-gray-50/50"
        >
          <PiUsersBold className="h-4 w-4" />
          <Text className="text-[10px] leading-tight">{t('workspace.nav.workspaceMembers')}</Text>
        </Link>
      ) : (
        <span className="flex flex-col items-center gap-1 rounded-md px-1 py-2 text-center text-xs text-gray-300">
          <PiUsersBold className="h-4 w-4" />
          <Text className="text-[10px] leading-tight">{t('workspace.nav.workspaceMembers')}</Text>
        </span>
      )}
    </div>
  );
}
