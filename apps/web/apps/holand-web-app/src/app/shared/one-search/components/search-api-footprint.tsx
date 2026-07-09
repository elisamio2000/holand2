// ============================================
// SearchApiFootprint — backend handoff table (static + live calls)
// ============================================

'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Text, Title } from 'rizzui';
import cn from '@core/utils/class-names';
import { requirementsForMode } from '@/app/shared/one-search/config/search-api-requirements';
import {
  capabilityGapsForMode,
  type BackendCapabilityGap,
  type BackendGapPriority,
} from '@/app/shared/one-search/config/backend-capability-gaps';
import {
  evaluateSearchPerformanceBudget,
  SEARCH_GATEWAY_CALL_BUDGET,
} from '@/app/shared/one-search/config/search-performance-budget';
import type {
  OneSearchDataSourceCall,
  OneSearchExecutionMeta,
  OneSearchMode,
  OneSearchQueryImage,
  OneSearchRequirementStatus,
  OneSearchSourceStatus,
} from '@/types/one-search.types';
import { isEphemeralCleanupEnabled } from '@/app/shared/one-search/utils/ephemeral-visual-artifact';

export interface SearchApiFootprintProps {
  mode: OneSearchMode;
  meta: OneSearchExecutionMeta | null;
  queryImage?: OneSearchQueryImage | null;
  ephemeralCleanupEnabled?: boolean;
  className?: string;
}

const STATUS_COLOR: Record<
  OneSearchSourceStatus,
  'success' | 'danger' | 'secondary' | 'warning' | 'info'
> = {
  ok: 'success',
  error: 'danger',
  skipped: 'secondary',
  mock: 'warning',
  timeout: 'danger',
};

function statusLabel(t: (k: string) => string, status: OneSearchSourceStatus): string {
  return t(`searchHub.apiFootprint.status.${status}`);
}

function LiveCallRow({ call }: { call: OneSearchDataSourceCall }) {
  const { t } = useTranslation();
  return (
    <tr className="border-b border-muted/60 last:border-0">
      <td className="px-2 py-2 align-top font-mono text-[11px]">{call.lane}</td>
      <td className="px-2 py-2 align-top font-mono text-[11px]">{call.toolId}</td>
      <td className="px-2 py-2 align-top font-mono text-[10px] break-all">{call.endpoint}</td>
      <td className="px-2 py-2 align-top">
        <Badge color={STATUS_COLOR[call.status]} rounded="md" className="text-[10px]">
          {statusLabel(t, call.status)}
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
  );
}

function priorityColor(p: BackendGapPriority): 'danger' | 'warning' | 'secondary' {
  if (p === 'P0') return 'danger';
  if (p === 'P1') return 'warning';
  return 'secondary';
}

const REQUIREMENT_STATUS_COLOR: Record<
  OneSearchRequirementStatus,
  'success' | 'danger' | 'secondary' | 'warning' | 'info'
> = {
  live: 'success',
  resolved: 'success',
  workaround: 'warning',
  binding: 'danger',
  missing: 'secondary',
  optional: 'info',
};

function BackendGapRow({ gap }: { gap: BackendCapabilityGap }) {
  const { t } = useTranslation();
  return (
    <tr className="border-b border-muted/60 last:border-0">
      <td className="px-2 py-2 align-top text-[11px] font-medium">{gap.capability}</td>
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
            {t('searchHub.apiFootprint.backendRequirements.resolved')}
          </Badge>
        ) : (
          <Badge color={priorityColor(gap.priority)} rounded="md" className="text-[10px]">
            {t(`searchHub.apiFootprint.backendRequirements.priority.${gap.priority}`)}
          </Badge>
        )}
      </td>
      <td className="px-2 py-2 align-top text-[10px] text-gray-500">
        {gap.resolved ? gap.resolvedNote ?? gap.acceptance : gap.acceptance}
      </td>
    </tr>
  );
}

function RequirementRow({
  req,
  live,
}: {
  req: ReturnType<typeof requirementsForMode>[number];
  live?: OneSearchDataSourceCall;
}) {
  const { t } = useTranslation();
  return (
    <tr className="border-b border-muted/60 last:border-0">
      <td className="px-2 py-2 align-top font-mono text-[11px]">{req.lane}</td>
      <td className="px-2 py-2 align-top font-mono text-[11px]">{req.toolId}</td>
      <td className="px-2 py-2 align-top font-mono text-[10px] break-all">{req.endpoint}</td>
      <td className="px-2 py-2 align-top font-mono text-[10px] break-all text-primary">
        {req.targetApi}
      </td>
      <td className="px-2 py-2 align-top">
        {req.requirementStatus ? (
          <Badge
            color={REQUIREMENT_STATUS_COLOR[req.requirementStatus]}
            rounded="md"
            className="text-[10px]"
          >
            {t(`searchHub.apiFootprint.requirementStatus.${req.requirementStatus}`)}
          </Badge>
        ) : live ? (
          <Badge color={STATUS_COLOR[live.status]} rounded="md" className="text-[10px]">
            {statusLabel(t, live.status)}
          </Badge>
        ) : (
          <Badge color="secondary" rounded="md" className="text-[10px]">
            {t('searchHub.apiFootprint.notCalled')}
          </Badge>
        )}
      </td>
      <td className="px-2 py-2 align-top text-[10px] text-gray-500">{req.notes ?? '—'}</td>
    </tr>
  );
}

export default function SearchApiFootprint({
  mode,
  meta,
  queryImage,
  ephemeralCleanupEnabled = isEphemeralCleanupEnabled(),
  className,
}: SearchApiFootprintProps) {
  const { t } = useTranslation();
  const requirements = useMemo(() => requirementsForMode(mode), [mode]);
  const backendGaps = useMemo(() => capabilityGapsForMode(mode), [mode]);
  const budget = useMemo(() => evaluateSearchPerformanceBudget(meta), [meta]);

  const liveByLane = useMemo(() => {
    const map = new Map<string, OneSearchDataSourceCall>();
    for (const call of meta?.calls ?? []) {
      map.set(call.lane, call);
    }
    return map;
  }, [meta?.calls]);

  const showUploadLifecycle =
    ephemeralCleanupEnabled &&
    (mode === 'image' || mode === 'all') &&
    (meta?.searchKind === 'visual' || Boolean(queryImage?.artifact_id));

  const showPlaybackLifecycle = mode === 'audio' || mode === 'video';
  const showTranscriptApiNote = mode === 'audio' || mode === 'video';

  return (
    <section
      className={cn(
        'mt-10 rounded-lg border border-muted bg-gray-0/80 p-4 dark:bg-gray-100/40 @md:p-5',
        className
      )}
    >
      <Title as="h3" className="text-sm font-semibold text-gray-900 dark:text-gray-700">
        {t('searchHub.apiFootprint.title')}
      </Title>
      <Text className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
        {t('searchHub.apiFootprint.subtitle', { mode: t(`searchHub.modes.${mode}`) })}
      </Text>

      {meta && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge color="info" rounded="md" className="text-[10px]">
            {t('searchHub.apiFootprint.provider', { id: meta.providerId })}
          </Badge>
          <Badge color="secondary" rounded="md" className="text-[10px]">
            {t('searchHub.apiFootprint.tookMs', { ms: meta.tookMs })}
          </Badge>
          {meta.hasRealLanes && (
            <Badge color="success" rounded="md" className="text-[10px]">
              {t('searchHub.apiFootprint.hasReal')}
            </Badge>
          )}
          {meta.hasMockLanes && meta.providerId === 'mock' && (
            <Badge color="warning" rounded="md" className="text-[10px]">
              {t('searchHub.apiFootprint.hasMock')}
            </Badge>
          )}
          {meta.providerId === 'smart-search' &&
            meta.calls?.some((c) => c.status === 'error' && c.toolId === 'plugin.smart_search') && (
              <Badge color="danger" rounded="md" className="text-[10px]">
                {t('searchHub.apiFootprint.smartSearchDegraded')}
              </Badge>
            )}
          {meta.searchKind && (
            <Badge color="primary" rounded="md" className="text-[10px]">
              {t('searchHub.apiFootprint.searchKind', { kind: meta.searchKind })}
            </Badge>
          )}
          {meta.usedTempFederatedFallback && (
            <Badge color="warning" rounded="md" className="text-[10px]">
              {t('searchHub.apiFootprint.fallbackUsed')}
            </Badge>
          )}
          {meta.rateLimited && (
            <Badge color="danger" rounded="md" className="text-[10px]">
              {t('searchHub.apiFootprint.rateLimited')}
            </Badge>
          )}
          <Badge color="secondary" rounded="md" className="text-[10px]">
            {t('searchHub.apiFootprint.callCount', { count: meta.calls?.length ?? 0 })}
          </Badge>
          {budget && (
            <Badge
              color={budget.ok ? 'success' : 'danger'}
              rounded="md"
              className="text-[10px]"
              title={budget.reasons.join(', ')}
            >
              {budget.ok
                ? t('searchHub.apiFootprint.budgetOk', {
                    count: budget.callCount,
                    budget: SEARCH_GATEWAY_CALL_BUDGET,
                  })
                : t('searchHub.apiFootprint.budgetExceeded', {
                    count: budget.callCount,
                    budget: SEARCH_GATEWAY_CALL_BUDGET,
                  })}
            </Badge>
          )}
          {showUploadLifecycle && (
            <Badge color="success" rounded="md" className="text-[10px]">
              {t('searchHub.apiFootprint.ephemeralCleanupActive')}
            </Badge>
          )}
          {showPlaybackLifecycle && (
            <Badge color="success" rounded="md" className="text-[10px]">
              {t('searchHub.apiFootprint.playbackJwtActive')}
            </Badge>
          )}
        </div>
      )}

      {showUploadLifecycle && (
        <div className="mt-4 rounded-md border border-muted bg-gray-50/50 p-3 dark:bg-gray-200/20">
          <Text className="text-xs font-semibold text-gray-800 dark:text-gray-700">
            {t('searchHub.apiFootprint.uploadLifecycleTitle')}
          </Text>
          <Text className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
            {t('searchHub.apiFootprint.uploadLifecycleBody')}
          </Text>
          <ul className="mt-2 space-y-1 font-mono text-[10px] text-gray-600 dark:text-gray-400">
            <li>1. POST /upload → artifact_id</li>
            <li>2. smart_search args.query_image</li>
            <li>3. DELETE /storage/artifacts/&#123;id&#125; on clear / unmount (ephemeral only)</li>
          </ul>
          {queryImage?.ephemeral && queryImage.artifact_id && (
            <Text className="mt-2 font-mono text-[10px] text-gray-500">
              {t('searchHub.apiFootprint.ephemeralArtifact', { id: queryImage.artifact_id })}
            </Text>
          )}
        </div>
      )}

      {showPlaybackLifecycle && (
        <div className="mt-4 rounded-md border border-muted bg-gray-50/50 p-3 dark:bg-gray-200/20">
          <Text className="text-xs font-semibold text-gray-800 dark:text-gray-700">
            {t('searchHub.apiFootprint.playbackLifecycleTitle')}
          </Text>
          <Text className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
            {t('searchHub.apiFootprint.playbackLifecycleBody')}
          </Text>
          <ul className="mt-2 space-y-1 font-mono text-[10px] text-gray-600 dark:text-gray-400">
            {mode === 'audio' ? (
              <>
                <li>1. smart_search hit → meta.artifact_id</li>
                <li>2. GET /storage/artifacts/&#123;id&#125;/download (JWT) → blob: URL</li>
                <li>3. WaveSurfer / &lt;audio&gt; play blob (presigned fallback if blob fails)</li>
              </>
            ) : (
              <>
                <li>1. GET /storage/files/&#123;id&#125;/presigned-url (primary)</li>
                <li>2. Fallback: JWT blob fetch → object URL</li>
                <li>3. &lt;video&gt; stream with Range requests</li>
              </>
            )}
          </ul>
        </div>
      )}

      {showTranscriptApiNote && (
        <div className="mt-4 rounded-md border border-amber-200/80 bg-amber-50/60 p-3 dark:border-amber-900/30 dark:bg-amber-950/15">
          <Badge color="warning" rounded="md" className="mb-2 text-[10px]">
            {t('searchHub.apiFootprint.transcriptApiMissing')}
          </Badge>
          <Text className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-400">
            {t('searchHub.apiFootprint.transcriptApiBody')}
          </Text>
          <p className="mt-2 font-mono text-[10px] text-gray-500">
            GET /storage/files/&#123;artifact_id&#125;/transcript
          </p>
        </div>
      )}

      {meta?.degradedSources && Object.keys(meta.degradedSources).length > 0 && (
        <div className="mt-4 rounded-md border border-warning/30 bg-warning/5 p-3 dark:border-warning/20">
          <Text className="text-xs font-semibold text-gray-800 dark:text-gray-700">
            {t('searchHub.degradedSourcesTitle')}
          </Text>
          <Text className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
            {t('searchHub.degradedSourcesHint')}
          </Text>
          <ul className="mt-2 space-y-1">
            {Object.entries(meta.degradedSources).map(([source, note]) => (
              <li key={source} className="font-mono text-[10px] text-gray-600 dark:text-gray-400">
                <span className="font-semibold">{source}:</span> {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5">
        <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
          {t('searchHub.apiFootprint.liveTitle')}
        </Text>
        <div className="overflow-x-auto rounded-md border border-muted">
          <table className="min-w-full text-start">
            <thead className="bg-gray-50/80 text-[10px] uppercase text-gray-500 dark:bg-gray-200/30">
              <tr>
                <th className="px-2 py-2">{t('searchHub.apiFootprint.colLane')}</th>
                <th className="px-2 py-2">{t('searchHub.apiFootprint.colTool')}</th>
                <th className="px-2 py-2">{t('searchHub.apiFootprint.colEndpoint')}</th>
                <th className="px-2 py-2">{t('searchHub.apiFootprint.colStatus')}</th>
                <th className="px-2 py-2">{t('searchHub.apiFootprint.colLatency')}</th>
                <th className="px-2 py-2">{t('searchHub.apiFootprint.colHits')}</th>
                <th className="px-2 py-2">{t('searchHub.apiFootprint.colDetail')}</th>
              </tr>
            </thead>
            <tbody>
              {(meta?.calls ?? []).length > 0 ? (
                meta!.calls.map((call, i) => <LiveCallRow key={`${call.lane}-${i}`} call={call} />)
              ) : (
                <tr>
                  <td colSpan={7} className="px-2 py-4 text-center text-xs text-gray-500">
                    {t('searchHub.apiFootprint.noLiveCalls')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6">
        <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
          {t('searchHub.apiFootprint.requirementsTitle')}
        </Text>
        <div className="overflow-x-auto rounded-md border border-muted">
          <table className="min-w-full text-start">
            <thead className="bg-gray-50/80 text-[10px] uppercase text-gray-500 dark:bg-gray-200/30">
              <tr>
                <th className="px-2 py-2">{t('searchHub.apiFootprint.colLane')}</th>
                <th className="px-2 py-2">{t('searchHub.apiFootprint.colTempTool')}</th>
                <th className="px-2 py-2">{t('searchHub.apiFootprint.colEndpoint')}</th>
                <th className="px-2 py-2">{t('searchHub.apiFootprint.colTargetApi')}</th>
                <th className="px-2 py-2">{t('searchHub.apiFootprint.colStatus')}</th>
                <th className="px-2 py-2">{t('searchHub.apiFootprint.colNotes')}</th>
              </tr>
            </thead>
            <tbody>
              {requirements.map((req) => (
                <RequirementRow key={`${req.mode}-${req.lane}-${req.toolId}`} req={req} live={liveByLane.get(req.lane)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6">
        <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
          {t('searchHub.apiFootprint.backendRequirements.title')}
        </Text>
        <Text className="mb-3 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
          {t('searchHub.apiFootprint.backendRequirements.subtitle')}
        </Text>
        <div className="overflow-x-auto rounded-md border border-muted">
          <table className="min-w-full text-start">
            <thead className="bg-gray-50/80 text-[10px] uppercase text-gray-500 dark:bg-gray-200/30">
              <tr>
                <th className="px-2 py-2">
                  {t('searchHub.apiFootprint.backendRequirements.colCapability')}
                </th>
                <th className="px-2 py-2">
                  {t('searchHub.apiFootprint.backendRequirements.colFeWorkaround')}
                </th>
                <th className="px-2 py-2">
                  {t('searchHub.apiFootprint.backendRequirements.colFeRequest')}
                </th>
                <th className="px-2 py-2">
                  {t('searchHub.apiFootprint.backendRequirements.colExpectedResponse')}
                </th>
                <th className="px-2 py-2">
                  {t('searchHub.apiFootprint.backendRequirements.colRequiredApi')}
                </th>
                <th className="px-2 py-2">
                  {t('searchHub.apiFootprint.backendRequirements.colPriority')}
                </th>
                <th className="px-2 py-2">
                  {t('searchHub.apiFootprint.backendRequirements.colAcceptance')}
                </th>
              </tr>
            </thead>
            <tbody>
              {backendGaps.map((gap) => (
                <BackendGapRow key={gap.id} gap={gap} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Text className="mt-4 font-mono text-[10px] text-gray-400">
        {t('searchHub.apiFootprint.docHint')}
      </Text>
    </section>
  );
}
