'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Loader,
  Text,
} from 'rizzui';
import { PiArrowLeftBold, PiArrowRightBold, PiCheckCircleBold, PiPlugsConnectedBold } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import type {
  DiscoveredModel,
  LlmEndpoint,
  LlmEndpointDiscoverResult,
} from '@/types/pipeline-admin.types';
import { formatLlmApiError } from '../helpers/llm-api-errors';
import { useLogicalIdSuggestions } from '../hooks/use-logical-id-suggestions';
import { useEndpointWizard } from '../hooks/use-endpoint-wizard';
import { isBlockedHost } from './external-endpoint-wizard.types';
import StatusDot from '../components/status-dot';
import PipelineAdminModal from '../components/pipeline-admin-modal';

interface ExternalEndpointWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  initialEndpoint?: LlmEndpoint | null;
}

export default function ExternalEndpointWizard({
  open,
  onClose,
  onComplete,
  initialEndpoint,
}: ExternalEndpointWizardProps) {
  const { t } = useTranslation();
  const {
    state,
    busy,
    error,
    setStep,
    setConnect,
    setImportRow,
    setAllImportSelected,
    runDiscover,
    runRegisterAndImport,
    reset,
  } = useEndpointWizard(initialEndpoint);
  const { filterSuggestionsForModalities } = useLogicalIdSuggestions();

  const discoveredById = useMemo(() => {
    const map = new Map<string, DiscoveredModel>();
    for (const model of state.discoverResult?.models ?? []) {
      map.set(model.id, model);
    }
    return map;
  }, [state.discoverResult?.models]);

  if (!open) return null;

  const handleClose = () => {
    reset();
    onClose();
  };

  const errorMessage = error
    ? error === 'discovery_blocked_host'
      ? t('pipeline.errors.discovery_blocked_host')
      : error === 'no_models_to_import'
        ? t('pipeline.errors.no_models_to_import')
        : error === 'missing_logical_id'
          ? t('pipeline.wizard.missingLogicalId')
          : error === 'missing_fields'
            ? t('pipeline.wizard.missingFields')
            : formatLlmApiError(new Error(error), t)
    : null;

  const footer = (() => {
    if (state.step === 'connect') {
      return (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button
            size="sm"
            disabled={busy || isBlockedHost(state.connect.host)}
            onClick={() => void runDiscover()}
            className="gap-1"
          >
            {busy ? <Loader size="sm" /> : <PiArrowRightBold className="h-4 w-4" />}
            {t('pipeline.wizard.discover')}
          </Button>
        </div>
      );
    }
    if (state.step === 'import') {
      return (
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => setStep('connect')} className="gap-1">
            <PiArrowLeftBold className="h-4 w-4" />
            {t('common.back')}
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              const importResult = await runRegisterAndImport();
              if (importResult) onComplete();
            }}
            className="gap-1"
          >
            {busy ? <Loader size="sm" /> : <PiCheckCircleBold className="h-4 w-4" />}
            {t('pipeline.wizard.import')}
          </Button>
        </div>
      );
    }
    if (state.step === 'success') {
      return (
        <div className="flex flex-wrap justify-end gap-2">
          <Link href="/admin/pipeline?tab=models">
            <Button variant="outline" size="sm">
              {t('pipeline.wizard.viewCatalog')}
            </Button>
          </Link>
          <Link href="/admin/pipeline?tab=topology&view=list&section=tools">
            <Button variant="outline" size="sm">
              {t('pipeline.wizard.bindTools')}
            </Button>
          </Link>
          <Button size="sm" onClick={handleClose}>
            {t('common.close')}
          </Button>
        </div>
      );
    }
    return null;
  })();

  return (
    <PipelineAdminModal
      open={open}
      onClose={handleClose}
      size="xl"
      className="max-h-[min(85vh,720px)]"
      titleId="external-endpoint-wizard-title"
      icon={<PiPlugsConnectedBold className="h-5 w-5" />}
      title={t('pipeline.wizard.title')}
      subtitle={
        <Text className="text-sm text-gray-500">{t('pipeline.wizard.subtitle')}</Text>
      }
      headerExtra={<WizardSteps current={state.step} t={t} />}
      footer={footer}
    >
      {errorMessage ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {errorMessage}
        </div>
      ) : null}

      {state.step === 'connect' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              size="sm"
              label={t('pipeline.endpoints.name')}
              value={state.connect.name}
              onChange={(e) => setConnect({ name: e.target.value })}
            />
            <Input
              size="sm"
              label={t('pipeline.wizard.scheme')}
              value={state.connect.scheme}
              onChange={(e) => setConnect({ scheme: e.target.value })}
            />
            <Input
              size="sm"
              label={t('pipeline.endpoints.host')}
              placeholder={t('pipeline.endpoints.hostPlaceholder')}
              value={state.connect.host}
              onChange={(e) => setConnect({ host: e.target.value })}
            />
            <Input
              size="sm"
              type="number"
              label={t('pipeline.endpoints.port')}
              value={state.connect.port}
              onChange={(e) => setConnect({ port: Number(e.target.value) })}
            />
            <Input
              size="sm"
              label={t('pipeline.wizard.basePath')}
              value={state.connect.base_path}
              onChange={(e) => setConnect({ base_path: e.target.value })}
            />
            <Input
              size="sm"
              type="text"
              label={t('pipeline.wizard.bearerToken')}
              value={state.connect.bearer_token}
              onChange={(e) => setConnect({ bearer_token: e.target.value })}
              inputClassName="font-mono"
            />
            <Input
              size="sm"
              type="number"
              min={1}
              max={120}
              label={t('pipeline.wizard.timeoutSeconds')}
              value={state.connect.timeout_s}
              onChange={(e) => setConnect({ timeout_s: Number(e.target.value) })}
              className="sm:col-span-2 sm:max-w-xs"
            />
          </div>
          {isBlockedHost(state.connect.host) ? (
            <Text className="text-xs text-amber-600">{t('pipeline.wizard.localhostWarning')}</Text>
          ) : null}
        </div>
      )}

      {state.step === 'import' && state.discoverResult && (
        <div className="space-y-4">
          <DiscoverSummary result={state.discoverResult} t={t} />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setAllImportSelected(true)}>
              {t('pipeline.wizard.selectAll')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAllImportSelected(false)}>
              {t('pipeline.wizard.selectNone')}
            </Button>
          </div>
          <Text className="text-xs text-gray-500">{t('pipeline.wizard.loraHint')}</Text>
          <div className="space-y-3">
            {state.importRows.map((row, idx) => {
              const discovered = discoveredById.get(row.upstream_model_id);
              return (
                <div key={row.upstream_model_id} className="rounded-lg border border-muted p-4">
                  <div className="mb-2 flex items-start gap-2">
                    <Checkbox
                      checked={row.selected}
                      onChange={(e) => setImportRow(idx, { selected: e.target.checked })}
                    />
                    <div className="min-w-0 flex-1">
                      <Text className="truncate text-sm font-medium">{row.display_name}</Text>
                      <Text className="truncate font-mono text-xs text-gray-500">
                        {row.upstream_model_id}
                      </Text>
                      {discovered ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {discovered.max_model_len != null ? (
                            <Badge variant="outline" size="sm">
                              {t('pipeline.wizard.maxContext')}: {discovered.max_model_len}
                            </Badge>
                          ) : null}
                          {discovered.task ? (
                            <Badge variant="outline" size="sm">
                              {t('pipeline.wizard.modelTask')}: {String(discovered.task)}
                            </Badge>
                          ) : null}
                          {discovered.owned_by ? (
                            <Badge variant="outline" size="sm">
                              {t('pipeline.wizard.ownedBy')}: {String(discovered.owned_by)}
                            </Badge>
                          ) : null}
                          {discovered.ready != null ? (
                            <Badge
                              variant="flat"
                              size="sm"
                              color={discovered.ready ? 'success' : 'warning'}
                            >
                              {t('pipeline.wizard.modelReady')}: {discovered.ready ? 'yes' : 'no'}
                            </Badge>
                          ) : null}
                          {discovered.source ? (
                            <Badge variant="outline" size="sm">
                              {t('pipeline.wizard.modelSource')}: {String(discovered.source)}
                            </Badge>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {row.selected ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Input
                        size="sm"
                        label={t('pipeline.wizard.logicalId')}
                        value={row.logical_id}
                        list={`logical-suggestions-${idx}`}
                        onChange={(e) => setImportRow(idx, { logical_id: e.target.value })}
                      />
                      <datalist id={`logical-suggestions-${idx}`}>
                        {filterSuggestionsForModalities(
                          row.logical_id,
                          row.input_modalities,
                          row.output_modalities
                        ).map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                      <Input
                        size="sm"
                        label={t('pipeline.wizard.displayName')}
                        value={row.display_name}
                        onChange={(e) => setImportRow(idx, { display_name: e.target.value })}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {state.step === 'success' && state.importResult && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-600">
            <PiCheckCircleBold className="h-6 w-6 shrink-0" />
            <Text className="font-medium">
              {t('pipeline.wizard.success', {
                imported: state.importResult.imported,
                total: state.importResult.total,
              })}
            </Text>
          </div>
          <div className="space-y-2 rounded-lg border border-muted p-4">
            {state.importResult.results.map((r) => (
              <div key={r.logical_id} className="flex items-center gap-2 text-sm">
                <StatusDot color={r.ok ? 'green' : 'red'} size="sm" />
                <Text>{r.logical_id}</Text>
                {r.physical_name ? (
                  <Text className="font-mono text-xs text-gray-400">{r.physical_name}</Text>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </PipelineAdminModal>
  );
}

function DiscoverSummary({
  result,
  t,
}: {
  result: LlmEndpointDiscoverResult;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const probeJson =
    result.probes && Object.keys(result.probes).length > 0
      ? JSON.stringify(result.probes, null, 2)
      : null;

  return (
    <div className="space-y-3 rounded-lg border border-muted bg-gray-50/60 p-4 dark:bg-gray-100/5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="flat" color={result.healthy ? 'success' : 'danger'} size="sm">
          {result.healthy ? t('pipeline.endpoints.healthy') : t('pipeline.endpoints.unhealthy')}
        </Badge>
        {result.latency_ms != null ? (
          <Badge variant="outline" size="sm">
            {result.latency_ms}ms
          </Badge>
        ) : null}
        {result.openai_compat ? (
          <Badge variant="flat" color="info" size="sm">
            {t('pipeline.wizard.openaiCompat')}
          </Badge>
        ) : null}
        {result.v2_protocol ? (
          <Badge variant="flat" color="info" size="sm">
            {t('pipeline.wizard.v2Protocol')}
          </Badge>
        ) : null}
        <Text className="text-xs text-gray-500">
          {result.models?.length ?? 0} {t('pipeline.endpoints.models')}
        </Text>
      </div>
      {result.base_url ? (
        <div>
          <Text className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            {t('pipeline.wizard.baseUrl')}
          </Text>
          <Text className="break-all font-mono text-xs">{result.base_url}</Text>
        </div>
      ) : null}
      {result.error ? <Text className="text-xs text-red-600">{String(result.error)}</Text> : null}
      {probeJson ? (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-gray-600">
            {t('pipeline.wizard.probeDetails')}
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded bg-gray-900 p-2 font-mono text-[10px] text-gray-100">
            {probeJson}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

function WizardSteps({
  current,
  t,
}: {
  current: string;
  t: (key: string) => string;
}) {
  const steps = ['connect', 'import', 'success'] as const;
  const currentIndex = steps.indexOf(current as (typeof steps)[number]);

  return (
    <ol className="flex gap-2" aria-label="Wizard progress">
      {steps.map((s, i) => {
        const isActive = current === s;
        const isComplete = currentIndex > i;
        return (
          <li
            key={s}
            className={cn(
              'flex-1 rounded-md border px-2 py-1.5 text-center text-xs font-medium transition-colors',
              isActive
                ? 'border-primary bg-primary text-white'
                : isComplete
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-muted bg-gray-50 text-gray-400 dark:bg-gray-100/5'
            )}
            aria-current={isActive ? 'step' : undefined}
          >
            {t(`pipeline.wizard.steps.${s}`)}
          </li>
        );
      })}
    </ol>
  );
}
