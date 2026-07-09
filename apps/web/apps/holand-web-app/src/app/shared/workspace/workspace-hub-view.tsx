'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import {
  PiArrowRightBold,
  PiChatCenteredDotsBold,
  PiCompassBold,
  PiCubeBold,
  PiEnvelopeSimpleBold,
  PiFolderBold,
  PiGearBold,
  PiPlusBold,
  PiUsersBold,
} from 'react-icons/pi';
import { Badge, Button, Loader, Text, Title } from 'rizzui';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import {
  useIsWorkspaceAdmin,
  useWorkspace,
  useWorkspaceRole,
} from '@/contexts/workspace-context';
import WorkspaceDataSourceBadge from '@/app/shared/workspace/components/workspace-data-source-badge';
import WorkspaceRoleBadge from '@/app/shared/workspace/components/workspace-role-badge';
import { getWorkspaceServiceDataStatus, workspaceService } from '@/services/workspace.service';
import { menuItems } from '@/layouts/hydrogen/menu-items';
import { resolveWorkspaceMenuItems } from '@/lib/resolve-workspace-menu';
import { buildDefaultTeamPreset } from '@/lib/menu-catalog-utils';

interface WorkspaceHubViewProps {
  workspaceId: string;
}

export default function WorkspaceHubView({ workspaceId }: WorkspaceHubViewProps) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const { workspaces } = useWorkspace();
  const role = useWorkspaceRole(workspaceId);
  const isAdmin = useIsWorkspaceAdmin(workspaceId);
  const dataStatus = getWorkspaceServiceDataStatus();

  const ws = workspaces.find((w) => w.id === workspaceId);
  const [loading, setLoading] = useState(true);
  const [memberCount, setMemberCount] = useState(0);
  const [pendingInvites, setPendingInvites] = useState(0);
  const [moduleCount, setModuleCount] = useState(0);
  const [caseCount, setCaseCount] = useState(0);
  const [quickLinks, setQuickLinks] = useState<{ name: string; href: string }[]>([]);

  const userId = (session?.user as { id?: string })?.id ?? 'anonymous';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [members, invites, modules, cases, team, overlay] = await Promise.all([
          workspaceService.listMembers(workspaceId),
          workspaceService.listInvites(workspaceId),
          workspaceService.listModules(workspaceId),
          workspaceService.listCases(workspaceId),
          workspaceService.getTeamNavPreset(workspaceId),
          workspaceService.getUserNavOverlay(userId, workspaceId),
        ]);
        if (cancelled) return;
        setMemberCount(members.length);
        setPendingInvites(invites.filter((i) => i.status === 'pending').length);
        setModuleCount(modules.length);
        setCaseCount(cases.length);

        const preset = team ?? buildDefaultTeamPreset(menuItems);
        const overlayResolved = overlay ?? {
          schemaVersion: 1 as const,
          pinnedIds: [],
          hiddenIds: [],
        };
        const { pinnedLinks } = resolveWorkspaceMenuItems(
          menuItems,
          preset,
          overlayResolved,
          overlayResolved.pinnedIds
        );
        setQuickLinks(
          pinnedLinks
            .filter((l) => l.href)
            .map((l) => ({ name: l.name, href: l.href! }))
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, userId]);

  if (loading) {
    return <Loader variant="spinner" className="mx-auto my-16" />;
  }

  const name = ws?.name ?? workspaceId;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Title as="h1" className="text-2xl font-semibold">
              {name}
            </Title>
            <WorkspaceDataSourceBadge
              useMock={dataStatus === 'mock'}
              hadLiveError={dataStatus === 'degraded'}
            />
            {role && <WorkspaceRoleBadge role={role} />}
          </div>
          <Text className="text-sm text-gray-500">{t('workspace.hub.subtitle')}</Text>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <>
              <Link href={routes.workspace.settings(workspaceId, 'people')}>
                <Button size="sm">
                  <PiUsersBold className="me-1 h-4 w-4" />
                  {t('workspace.hub.manageMembers')}
                </Button>
              </Link>
              <Link href={routes.workspace.settings(workspaceId, 'people')}>
                <Button variant="outline" size="sm">
                  <PiPlusBold className="me-1 h-4 w-4" />
                  {t('workspace.invite.title')}
                </Button>
              </Link>
            </>
          )}
          <Link
            href={
              isAdmin
                ? routes.workspace.settings(workspaceId)
                : routes.workspace.settings(workspaceId, 'navigation')
            }
          >
            <Button variant="outline" size="sm">
              <PiGearBold className="me-1 h-4 w-4" />
              {t('workspace.settings')}
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <HubCard
          icon={<PiUsersBold size={20} />}
          accent="primary"
          label={t('workspace.tabs.people')}
          value={String(memberCount)}
          href={routes.workspace.settings(workspaceId, 'people')}
        />
        {isAdmin && (
          <HubCard
            icon={<PiEnvelopeSimpleBold size={20} />}
            accent="amber"
            label={t('workspace.invite.pendingTitle')}
            value={String(pendingInvites)}
            href={routes.workspace.settings(workspaceId, 'people')}
            badge={pendingInvites > 0 ? t('workspace.hub.pendingBadge') : undefined}
          />
        )}
        <HubCard
          icon={<PiCubeBold size={20} />}
          accent="violet"
          label={t('workspace.tabs.modules')}
          value={String(moduleCount)}
          href={routes.workspace.settings(workspaceId, 'modules')}
        />
        <HubCard
          icon={<PiFolderBold size={20} />}
          accent="blue"
          label={t('workspace.tabs.cases')}
          value={String(caseCount)}
          href={routes.workspace.settings(workspaceId, 'cases')}
        />
        <HubCard
          icon={<PiCompassBold size={20} />}
          accent="teal"
          label={t('workspace.tabs.navigation')}
          value={quickLinks.length ? String(quickLinks.length) : '—'}
          href={routes.workspace.settings(workspaceId, 'navigation')}
        />
      </div>

      <div className="rounded-lg border border-muted p-4">
        <Title as="h3" className="mb-3 text-sm font-semibold">
          {t('workspace.hub.quickActions')}
        </Title>
        <div className="flex flex-wrap gap-2">
          <Link href={routes.aiChat.root}>
            <Button size="sm" variant="outline">
              <PiChatCenteredDotsBold className="me-1 h-4 w-4" />
              {t('workspace.hub.newChat')}
            </Button>
          </Link>
          <Link href={routes.caseImporter.import()}>
            <Button size="sm" variant="outline">
              <PiFolderBold className="me-1 h-4 w-4" />
              {t('workspace.hub.newCase')}
            </Button>
          </Link>
        </div>
      </div>

      {quickLinks.length > 0 && (
        <div className="rounded-lg border border-muted p-4">
          <Title as="h3" className="mb-3 text-sm font-semibold">
            {t('workspace.nav.favorites')}
          </Title>
          <ul className="space-y-1">
            {quickLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-primary hover:underline"
                >
                  {t(link.name)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

type HubCardAccent = 'primary' | 'amber' | 'violet' | 'blue' | 'teal';

const HUB_CARD_ACCENT_CLASSES: Record<HubCardAccent, string> = {
  primary: 'bg-primary/10 text-primary',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
};

function HubCard({
  icon,
  label,
  value,
  href,
  badge,
  accent = 'primary',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
  badge?: string;
  accent?: HubCardAccent;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-lg border border-muted bg-gray-0 p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md dark:bg-gray-50"
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full',
            HUB_CARD_ACCENT_CLASSES[accent]
          )}
        >
          {icon}
        </span>
        {badge ? (
          <Badge color="warning" rounded="md" className="text-[10px]">
            {badge}
          </Badge>
        ) : (
          <PiArrowRightBold className="h-3.5 w-3.5 shrink-0 text-gray-300 opacity-0 transition-opacity rtl:rotate-180 group-hover:opacity-100" />
        )}
      </div>
      <div>
        <Text className="text-2xl font-semibold text-gray-900 dark:text-gray-700">{value}</Text>
        <Text className="text-xs text-gray-500">{label}</Text>
      </div>
    </Link>
  );
}
