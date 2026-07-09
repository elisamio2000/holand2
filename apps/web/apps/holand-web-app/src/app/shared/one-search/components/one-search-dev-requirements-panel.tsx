'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Text } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  capabilityGapsForDevPanel,
  oneSearchGapI18nKey,
} from '@/app/shared/one-search/config/backend-capability-gaps';
import {
  ONE_SEARCH_API_GROUP_ORDER,
  liveApisForMode,
} from '@/app/shared/one-search/config/one-search-dev-api-manifest';
import { evaluateSearchPerformanceBudget, SEARCH_GATEWAY_CALL_BUDGET } from '@/app/shared/one-search/config/search-performance-budget';
import { isOneSearchDevPanelEnabled } from '@/app/shared/one-search/config/search-config';
import type {
  OneSearchDataSourceCall,
  OneSearchExecutionMeta,
  OneSearchMode,
  OneSearchQueryImage,
} from '@/types/one-search.types';
import {
  CapabilityGapsTable,
  DevPanelFooter,
  DevPanelHeader,
  DevPanelShell,
  DevPanelTabs,
  LiveApisTable,
  StatusBadge,
  type DevPanelShellHandle,
} from '@/platform/dev-panels';

const showDevPanel = isOneSearchDevPanelEnabled();

let openPanelExternal: (() => void) | null = null;

/** Opens and scrolls to the One Search dev requirements panel (no-op if hidden). */
export function openOneSearchDevRequirementsPanel() {
  openPanelExternal?.();
}

export type OneSearchDevRequirementsPanelHandle = {
  open: () => void;
};

export interface OneSearchDevRequirementsPanelProps {
  mode: OneSearchMode;
  variant?: 'default' | 'advanced';
  meta?: OneSearchExecutionMeta | null;
  queryImage?: OneSearchQueryImage | null;
  ephemeralCleanupEnabled?: boolean;
}

type DevPanelTab = 'apis' | 'gaps' | 'live';

const LIVE_STATUS_COLOR: Record<
  OneSearchDataSourceCall['status'],
  'success' | 'danger' | 'secondary' | 'warning' | 'info'
> = {
  ok: 'success',
  error: 'danger',
  skipped: 'secondary',
  mock: 'warning',
  timeout: 'danger',
};

function LiveCallsTable({
  calls,
  labels,
}: {
  calls: OneSearchDataSourceCall[];
  labels: {
    lane: string;
    tool: string;
    endpoint: string;
    status: string;
    latency: string;
    hits: string;
    detail: string;
    empty: string;
    statusLabels: Record<string, string>;
  };
}) {
  if (!calls.length) {
    return (
      <Text className="px-1 py-4 text-center text-xs text-gray-500">{labels.empty}</Text>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead>
          <tr className="border-b border-muted bg-gray-50/80 dark:bg-gray-100/40">
            {[labels.lane, labels.tool, labels.endpoint, labels.status, labels.latency, labels.hits, labels.detail].map(
              (label) => (
                <th
                  key={label}
                  className="px-2 py-2 font-medium text-gray-600 dark:text-gray-400"
                >
                  {label}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {calls.map((call, index) => (
            <tr key={`${call.lane}-${call.toolId}-${index}`} className="border-b border-muted/60 last:border-0">
              <td className="px-2 py-2 align-top font-mono text-[11px]">{call.lane}</td>
              <td className="px-2 py-2 align-top font-mono text-[11px]">{call.toolId}</td>
              <td className="px-2 py-2 align-top font-mono text-[10px] break-all">{call.endpoint}</td>
              <td className="px-2 py-2 align-top">
                <Badge color={LIVE_STATUS_COLOR[call.status]} rounded="md" className="text-[10px]">
                  {labels.statusLabels[call.status] ?? call.status}
                </Badge>
              </td>
              <td className="px-2 py-2 align-top font-mono text-[11px]">
                {call.latencyMs != null ? `${call.latencyMs} ms` : '—'}
              </td>
              <td className="px-2 py-2 align-top font-mono text-[11px]">{call.hitCount ?? 0}</td>
              <td className="px-2 py-2 align-top text-[10px] text-gray-500 break-all">
                {call.error ?? call.notes ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Collapsible dev handoff panel for One Search — mode-aware API manifest + capability gaps.
 */
const OneSearchDevRequirementsPanel = forwardRef<
  OneSearchDevRequirementsPanelHandle,
  OneSearchDevRequirementsPanelProps
>(function OneSearchDevRequirementsPanel(
  { mode, variant = 'default', meta, queryImage, ephemeralCleanupEnabled },
  ref
) {
  const { t } = useTranslation();
  const shellRef = useRef<DevPanelShellHandle>(null);
  const [activeTab, setActiveTab] = useState<DevPanelTab>('apis');

  const openPanel = useCallback(() => {
    shellRef.current?.open();
  }, []);

  useImperativeHandle(ref, () => ({ open: openPanel }), [openPanel]);

  useEffect(() => {
    openPanelExternal = openPanel;
    return () => {
      if (openPanelExternal === openPanel) openPanelExternal = null;
    };
  }, [openPanel]);

  const liveApis = useMemo(() => liveApisForMode(mode), [mode]);
  const gaps = useMemo(() => capabilityGapsForDevPanel(mode), [mode]);
  const budget = useMemo(() => evaluateSearchPerformanceBudget(meta ?? null), [meta]);

  if (!showDevPanel) return null;

  const liveCols = t('searchHub.devRequirements.liveApis.columns', {
    returnObjects: true,
  }) as Record<string, string>;

  const liveGroups = t('searchHub.devRequirements.liveApis.groups', {
    returnObjects: true,
  }) as Record<string, string>;

  const cols = t('searchHub.devRequirements.columns', { returnObjects: true }) as Record<
    string,
    string
  >;

  const gapLabels = {
    resolved: t('searchHub.devRequirements.resolved'),
    requestSample: t('searchHub.devRequirements.gaps.requestSample'),
    responseSample: t('searchHub.devRequirements.gaps.responseSample'),
    expandContract: t('searchHub.devRequirements.gaps.expandContract'),
    collapseContract: t('searchHub.devRequirements.gaps.collapseContract'),
    priority: {
      P0: t('searchHub.devRequirements.priority.P0'),
      P1: t('searchHub.devRequirements.priority.P1'),
      P2: t('searchHub.devRequirements.priority.P2'),
    },
    surfaces: t('searchHub.devRequirements.surfaces', { returnObjects: true }) as Record<
      string,
      string
    >,
  };

  const resolveStatusLabel = (statusKey: string) =>
    t(`searchHub.devRequirements.liveApis.status.${statusKey}`, statusKey);

  const modeLabel = t(`searchHub.modes.${mode}`);

  return (
    <DevPanelShell
      ref={shellRef}
      id="one-search-dev-requirements-panel"
      toggleLabel={t('searchHub.devRequirements.toggle')}
      enabled={showDevPanel}
      className="mt-10"
    >
      <DevPanelHeader
        title={t('searchHub.devRequirements.title')}
        subtitle={t('searchHub.devRequirements.subtitle', { mode: modeLabel })}
      />

      <div className="mb-3 flex flex-wrap gap-2">
        <Badge color="secondary" rounded="md" className="text-[10px]">
          {t('searchHub.devRequirements.modeBadge', { mode: modeLabel })}
        </Badge>
        {variant === 'advanced' && (
          <Badge color="info" rounded="md" className="text-[10px]">
            {t('searchHub.devRequirements.advancedBadge')}
          </Badge>
        )}
        {meta && (
          <>
            <Badge color="info" rounded="md" className="text-[10px]">
              {t('searchHub.devRequirements.providerBadge', { id: meta.providerId })}
            </Badge>
            {budget && (
              <StatusBadge
                status={budget.ok ? 'live' : 'missing'}
                label={
                  budget.ok
                    ? t('searchHub.apiFootprint.budgetOk', {
                        count: budget.callCount,
                        budget: SEARCH_GATEWAY_CALL_BUDGET,
                      })
                    : t('searchHub.apiFootprint.budgetExceeded', {
                        count: budget.callCount,
                        budget: SEARCH_GATEWAY_CALL_BUDGET,
                      })
                }
              />
            )}
          </>
        )}
        {ephemeralCleanupEnabled && (mode === 'image' || mode === 'all') && queryImage?.artifact_id && (
          <Badge color="success" rounded="md" className="text-[10px]">
            {t('searchHub.apiFootprint.ephemeralArtifact', { id: queryImage.artifact_id })}
          </Badge>
        )}
      </div>

      <DevPanelTabs
        tabs={[
          { id: 'apis', label: t('searchHub.devRequirements.tabApis') },
          { id: 'gaps', label: t('searchHub.devRequirements.tabGaps') },
          { id: 'live', label: t('searchHub.devRequirements.tabLive') },
        ]}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as DevPanelTab)}
      />

      {activeTab === 'apis' && (
        <LiveApisTable
          rows={liveApis}
          labels={{
            columns: {
              id: liveCols.id,
              endpoint: liveCols.endpoint,
              status: liveCols.status,
            },
            status: t('searchHub.devRequirements.liveApis.status', {
              returnObjects: true,
            }) as Record<string, string>,
            groups: liveGroups,
          }}
          groupOrder={ONE_SEARCH_API_GROUP_ORDER}
          groupLabel={(key) => liveGroups[key] ?? key}
          resolveStatus={(row) => row.status}
          resolveStatusLabel={resolveStatusLabel}
        />
      )}

      {activeTab === 'gaps' && (
        <CapabilityGapsTable
          gaps={gaps}
          columns={{
            capability: cols.capability,
            workaround: cols.workaround,
            contract: cols.contract,
            api: cols.api,
            priority: cols.priority,
            surface: cols.surface,
            acceptance: cols.acceptance,
          }}
          labels={gapLabels}
          gapI18nKey={oneSearchGapI18nKey}
          translate={(key, fallback) => t(key, fallback)}
          copyLabel={t('searchHub.devRequirements.copy')}
        />
      )}

      {activeTab === 'live' && (
        <div className={cn('rounded-md border border-muted')}>
          <LiveCallsTable
            calls={meta?.calls ?? []}
            labels={{
              lane: t('searchHub.apiFootprint.colLane'),
              tool: t('searchHub.apiFootprint.colTool'),
              endpoint: t('searchHub.apiFootprint.colEndpoint'),
              status: t('searchHub.apiFootprint.colStatus'),
              latency: t('searchHub.apiFootprint.colLatency'),
              hits: t('searchHub.apiFootprint.colHits'),
              detail: t('searchHub.apiFootprint.colDetail'),
              empty: t('searchHub.apiFootprint.noLiveCalls'),
              statusLabels: t('searchHub.apiFootprint.status', {
                returnObjects: true,
              }) as Record<string, string>,
            }}
          />
        </div>
      )}

      <DevPanelFooter>{t('searchHub.devRequirements.footer')}</DevPanelFooter>
    </DevPanelShell>
  );
});

export default OneSearchDevRequirementsPanel;
