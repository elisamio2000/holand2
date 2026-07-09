'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PiCaretDownBold, PiCaretUpBold } from 'react-icons/pi';
import { Badge, Text, Title } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  WORKSPACE_BACKEND_CAPABILITY_GAPS,
  workspaceGapI18nKey,
  type WorkspaceBackendCapabilityGap,
  type WorkspaceBackendGapPriority,
} from '@/app/shared/workspace/config/workspace-backend-capability-gaps';
import {
  WORKSPACE_API_REQUIREMENTS,
  resolveWorkspaceLiveApiStatus,
} from '@/app/shared/workspace/config/workspace-api-requirements';
import { isWorkspaceDevPanelEnabled } from '@/app/shared/workspace/config/workspace-data-source';
import type { WorkspaceApiHealth } from '@/hooks/use-workspace-api-health';
import { useWorkspaceApiHealth } from '@/hooks/use-workspace-api-health';

function priorityColor(p: WorkspaceBackendGapPriority): 'danger' | 'warning' | 'secondary' {
  if (p === 'P0') return 'danger';
  if (p === 'P1') return 'warning';
  return 'secondary';
}

function liveStatusBadgeColor(
  status: string
): 'success' | 'warning' | 'danger' | 'secondary' {
  if (status === 'live' || status === 'available') return 'success';
  if (status === 'partial' || status === 'unknown') return 'warning';
  return 'danger';
}

function GapRow({ gap }: { gap: WorkspaceBackendCapabilityGap }) {
  const { t } = useTranslation();
  const baseKey = workspaceGapI18nKey(gap.id);
  const capability = t(`${baseKey}.capability`, gap.capability);
  const acceptance = gap.resolved
    ? gap.resolvedNote ?? t(`${baseKey}.acceptance`, gap.acceptance)
    : t(`${baseKey}.acceptance`, gap.acceptance);

  return (
    <tr className="border-b border-muted/60 last:border-0">
      <td className="px-2 py-2 align-top text-[11px] font-medium">{capability}</td>
      <td className="px-2 py-2 align-top text-[10px] text-gray-500">{gap.feWorkaround}</td>
      <td className="px-2 py-2 align-top font-mono text-[10px] break-all whitespace-pre-wrap text-gray-600 dark:text-gray-400">
        {gap.feRequest}
      </td>
      <td className="px-2 py-2 align-top font-mono text-[10px] break-all whitespace-pre-wrap text-gray-600 dark:text-gray-400">
        {gap.expectedResponse}
      </td>
      <td className="px-2 py-2 align-top font-mono text-[10px] break-all text-primary">
        {gap.requiredApi}
      </td>
      <td className="px-2 py-2 align-top">
        {gap.resolved ? (
          <Badge color="success" rounded="md" className="text-[10px]">
            {t('workspace.devRequirements.resolved')}
          </Badge>
        ) : (
          <Badge color={priorityColor(gap.priority)} rounded="md" className="text-[10px]">
            {t(`workspace.devRequirements.priority.${gap.priority}`)}
          </Badge>
        )}
      </td>
      <td className="px-2 py-2 align-top text-[10px] text-gray-500">
        {t(`workspace.devRequirements.surfaces.${gap.uiSurface}`)}
      </td>
      <td className="px-2 py-2 align-top text-[10px] text-gray-500">{acceptance}</td>
    </tr>
  );
}

interface WorkspaceDevRequirementsPanelProps {
  liveHealth?: WorkspaceApiHealth;
}

export default function WorkspaceDevRequirementsPanel({
  liveHealth: liveHealthProp,
}: WorkspaceDevRequirementsPanelProps) {
  const { t } = useTranslation();
  const { health: probedHealth, probe } = useWorkspaceApiHealth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isWorkspaceDevPanelEnabled()) probe();
  }, [probe]);

  if (!isWorkspaceDevPanelEnabled()) return null;

  const health = liveHealthProp ?? probedHealth;

  const cols = t('workspace.devRequirements.columns', { returnObjects: true }) as Record<
    string,
    string
  >;
  const liveCols = t('workspace.devRequirements.liveApis.columns', {
    returnObjects: true,
  }) as Record<string, string>;

  return (
    <div
      id="workspace-dev-requirements-panel"
      className="rounded-lg border border-dashed border-muted bg-gray-0/80 p-3 dark:bg-gray-50/80"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-md py-1.5 text-left text-xs font-medium text-gray-500 transition hover:text-gray-700"
      >
        <span>{t('workspace.devRequirements.toggle')}</span>
        {open ? (
          <PiCaretUpBold className="size-3.5 shrink-0" />
        ) : (
          <PiCaretDownBold className="size-3.5 shrink-0" />
        )}
      </button>
      {open && (
        <div className="mt-2 max-h-[40vh] overflow-y-auto">
          <Title as="h3" className="text-sm font-semibold">
            {t('workspace.devRequirements.title')}
          </Title>
          <Text className="mb-3 text-xs text-gray-500">{t('workspace.devRequirements.subtitle')}</Text>

          <Title as="h4" className="mb-2 text-xs font-semibold text-gray-700">
            {t('workspace.devRequirements.liveApisTitle')}
          </Title>
          <div className="mb-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead>
                <tr className="border-b border-muted bg-gray-50/80">
                  {[liveCols.id, liveCols.endpoint, liveCols.status].map((label) => (
                    <th key={label} className="px-2 py-2 font-medium text-gray-600">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WORKSPACE_API_REQUIREMENTS.map((req) => {
                  const status = resolveWorkspaceLiveApiStatus(req, health);
                  const statusKey =
                    status === 'live' ||
                    status === 'partial' ||
                    status === 'missing' ||
                    status === 'available' ||
                    status === 'unavailable' ||
                    status === 'unknown'
                      ? status
                      : 'unknown';
                  return (
                    <tr key={req.id} className="border-b border-muted/60 last:border-0">
                      <td className="px-2 py-2 align-top text-[11px] font-medium">{req.id}</td>
                      <td className="px-2 py-2 align-top font-mono text-[10px] break-all text-gray-600">
                        {req.endpoint}
                      </td>
                      <td className="px-2 py-2 align-top">
                        <Badge
                          color={liveStatusBadgeColor(statusKey)}
                          rounded="md"
                          className="text-[10px]"
                        >
                          {t(`workspace.devRequirements.liveApis.status.${statusKey}`)}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-xs">
              <thead>
                <tr className="border-b border-muted bg-gray-50/80">
                  {[
                    cols.capability,
                    cols.workaround,
                    cols.feRequest,
                    cols.expectedResponse,
                    cols.api,
                    cols.priority,
                    cols.surface,
                    cols.acceptance,
                  ].map((label) => (
                    <th key={label} className="px-2 py-2 font-medium text-gray-600">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WORKSPACE_BACKEND_CAPABILITY_GAPS.map((gap) => (
                  <GapRow key={gap.id} gap={gap} />
                ))}
              </tbody>
            </table>
          </div>
          <Text className={cn('mt-2 text-[10px] text-gray-400')}>
            {t('workspace.devRequirements.footer')}
          </Text>
        </div>
      )}
    </div>
  );
}
