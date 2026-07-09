// ============================================
// CaseImporterDevRequirementsPanel
// Shared developer API requirements and backend gaps panel
// ============================================

'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'rizzui';
import { PiArrowsClockwiseBold } from 'react-icons/pi';
import {
  CapabilityGapsTable,
  DevPanelFooter,
  DevPanelHeader,
  DevPanelShell,
  DevPanelTabs,
  LiveApisTable,
  isDevPanelEnabled,
} from '@/platform/dev-panels';
import {
  CASE_IMPORTER_API_GROUP_ORDER,
  CASE_IMPORTER_API_REQUIREMENTS,
  type CaseImporterApiRequirement,
  resolveLiveApiStatus,
} from '@/app/shared/case-importer/config/case-importer-api-requirements';
import {
  CASE_IMPORTER_BACKEND_CAPABILITY_GAPS,
  caseImporterGapI18nKey,
} from '@/app/shared/case-importer/config/backend-capability-gaps';
import { useCaseImporterApiHealth } from '@/hooks/use-case-importer-api-health';

/**
 * CaseImporterDevRequirementsPanel — shared API/capability visibility panel for all case-importer pages.
 *
 * @example
 * ```tsx
 * <CaseImporterDevRequirementsPanel />
 * ```
 */
export function CaseImporterDevRequirementsPanel({ className }: { className?: string }) {
  const { t } = useTranslation();
  const enabled = isDevPanelEnabled('CASE_IMPORTER_DEV_PANEL');
  const { health, isProbing, reProbe } = useCaseImporterApiHealth();
  const [activeTab, setActiveTab] = useState<'apis' | 'gaps'>('apis');

  const rows = useMemo(
    () =>
      CASE_IMPORTER_API_REQUIREMENTS.map((req) => ({
        ...req,
        liveStatus: resolveLiveApiStatus(req, health),
      })),
    [health]
  );

  const tabs = useMemo(
    () => [
      {
        id: 'apis',
        label: t('caseImporter.devRequirements.tabs.apis', 'APIs in Use'),
      },
      {
        id: 'gaps',
        label: t('caseImporter.devRequirements.tabs.gaps', 'Backend Capability Gaps'),
      },
    ],
    [t]
  );

  if (!enabled) {
    return null;
  }

  const headerActions = (
    <Button
      size="sm"
      variant="outline"
      className="h-7 shrink-0 px-2 text-[10px]"
      onClick={() => {
        void reProbe();
      }}
      disabled={isProbing}
    >
      <PiArrowsClockwiseBold className={`me-1 size-3.5 ${isProbing ? 'animate-spin' : ''}`} />
      {t('caseImporter.devRequirements.reprobe', 'Re-probe')}
    </Button>
  );

  return (
    <DevPanelShell
      id="case-importer-dev-requirements-panel"
      toggleLabel={t('caseImporter.devRequirements.title', 'Case Importer API Requirements')}
      enabled={enabled}
      headerActions={headerActions}
      className={className}
    >
      <DevPanelHeader
        title={t('caseImporter.devRequirements.title', 'Case Importer API Requirements')}
        subtitle={t(
          'caseImporter.devRequirements.description',
          'Live status of case-importer APIs consumed by this module and backend gaps to close.'
        )}
      />

      <DevPanelTabs tabs={tabs} activeId={activeTab} onChange={(id) => setActiveTab(id as 'apis' | 'gaps')} />

      {activeTab === 'apis' && (
          <LiveApisTable<CaseImporterApiRequirement & { liveStatus: string }>
            rows={rows}
            labels={{
              columns: {
                id: t('caseImporter.devRequirements.tables.apis.columns.id', 'ID'),
                endpoint: t('caseImporter.devRequirements.tables.apis.columns.endpoint', 'Endpoint'),
                status: t('caseImporter.devRequirements.tables.apis.columns.status', 'Status'),
              },
              status: {
                live: t('caseImporter.devRequirements.status.live', 'Live'),
                partial: t('caseImporter.devRequirements.status.partial', 'Partial'),
                missing: t('caseImporter.devRequirements.status.missing', 'Missing'),
                available: t('caseImporter.devRequirements.status.available', 'Available'),
                unavailable: t('caseImporter.devRequirements.status.unavailable', 'Unavailable'),
                unknown: t('caseImporter.devRequirements.status.unknown', 'Unknown'),
              },
              groups: {
                queue: t('caseImporter.devRequirements.groups.queue', 'Queue'),
                cases: t('caseImporter.devRequirements.groups.cases', 'Cases'),
                import: t('caseImporter.devRequirements.groups.import', 'Import'),
                staging: t('caseImporter.devRequirements.groups.staging', 'Staging Upload'),
                preferences: t('caseImporter.devRequirements.groups.preferences', 'Preferences'),
                realtime: t('caseImporter.devRequirements.groups.realtime', 'Realtime'),
                meta: t('caseImporter.devRequirements.groups.meta', 'Meta / Contracts'),
              },
            }}
            resolveStatus={(row) => row.liveStatus}
            resolveStatusLabel={(statusKey) =>
              t(`caseImporter.devRequirements.status.${statusKey}`, statusKey)
            }
            groupOrder={CASE_IMPORTER_API_GROUP_ORDER}
            groupLabel={(groupKey) =>
              t(`caseImporter.devRequirements.groups.${groupKey}`, groupKey)
            }
          />
      )}

      {activeTab === 'gaps' && (
          <CapabilityGapsTable
            gaps={CASE_IMPORTER_BACKEND_CAPABILITY_GAPS}
            columns={{
              capability: t('caseImporter.devRequirements.tables.gaps.columns.capability', 'Capability'),
              workaround: t('caseImporter.devRequirements.tables.gaps.columns.workaround', 'Current FE Workaround'),
              contract: t('caseImporter.devRequirements.tables.gaps.columns.contract', 'Contract'),
              api: t('caseImporter.devRequirements.tables.gaps.columns.api', 'Required API'),
              priority: t('caseImporter.devRequirements.tables.gaps.columns.priority', 'Priority'),
              surface: t('caseImporter.devRequirements.tables.gaps.columns.surface', 'UI Surface'),
              acceptance: t('caseImporter.devRequirements.tables.gaps.columns.acceptance', 'Acceptance'),
            }}
            labels={{
              resolved: t('caseImporter.devRequirements.gaps.resolved', 'Resolved'),
              requestSample: t('caseImporter.devRequirements.gaps.requestSample', 'FE Request Sample'),
              responseSample: t('caseImporter.devRequirements.gaps.responseSample', 'Expected Response'),
              expandContract: t('caseImporter.devRequirements.gaps.expandContract', 'Expand'),
              collapseContract: t('caseImporter.devRequirements.gaps.collapseContract', 'Collapse'),
              priority: {
                P0: t('caseImporter.devRequirements.gaps.priority.P0', 'P0'),
                P1: t('caseImporter.devRequirements.gaps.priority.P1', 'P1'),
                P2: t('caseImporter.devRequirements.gaps.priority.P2', 'P2'),
              },
              surfaces: {
                dashboard: t('caseImporter.devRequirements.gaps.surfaces.dashboard', 'Dashboard'),
                import: t('caseImporter.devRequirements.gaps.surfaces.import', 'Import'),
                upload: t('caseImporter.devRequirements.gaps.surfaces.upload', 'Upload'),
                'server-path': t('caseImporter.devRequirements.gaps.surfaces.server-path', 'Server Path'),
                batch: t('caseImporter.devRequirements.gaps.surfaces.batch', 'Batch'),
                detail: t('caseImporter.devRequirements.gaps.surfaces.detail', 'Detail'),
                settings: t('caseImporter.devRequirements.gaps.surfaces.settings', 'Settings'),
                realtime: t('caseImporter.devRequirements.gaps.surfaces.realtime', 'Realtime'),
              },
            }}
            gapI18nKey={caseImporterGapI18nKey}
            translate={(key, fallback) => t(key, fallback)}
            copyLabel={t('caseImporter.devRequirements.copy', 'Copy')}
          />
      )}

      <DevPanelFooter>
        {t(
          'caseImporter.devRequirements.footer',
          'Source: case-importer service contracts and runtime probes.'
        )}
      </DevPanelFooter>
    </DevPanelShell>
  );
}
