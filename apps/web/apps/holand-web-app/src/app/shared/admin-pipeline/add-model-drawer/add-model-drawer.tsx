'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Loader,
  Text,
} from 'rizzui';
import {
  PiArrowClockwiseBold,
  PiCloudBold,
  PiCpuDuotone,
  PiPencilSimpleBold,
  PiPlusBold,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { pipelineAdminService } from '@/services/pipeline-admin.service';
import {
  adminRemoteNodesService,
  type RemoteNodeRow,
  type ScannedModelRow,
} from '@/services/admin-remote-nodes.service';
import type { LlmPool, ModelImportResultRow } from '@/types/pipeline-admin.types';
import { useEndpointWizard } from '../hooks/use-endpoint-wizard';
import { isBlockedHost, type ImportRowState } from '../wizards/external-endpoint-wizard.types';
import { buildPipelineUrl } from '../helpers/pipeline-tab-url';
import { formatLlmApiError } from '../helpers/llm-api-errors';
import PipelineAdminDrawer from '../components/pipeline-admin-drawer';

type DrawerTab = 'server' | 'gpu' | 'manual';

interface AddModelDrawerProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  remoteNodes?: RemoteNodeRow[];
}

export default function AddModelDrawer({
  open,
  onClose,
  onComplete,
  remoteNodes = [],
}: AddModelDrawerProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<DrawerTab>('server');
  const [poolSuggestions, setPoolSuggestions] = useState<string[]>([]);

  const {
    state: wizardState,
    busy,
    error: wizardError,
    setConnect,
    setImportRow,
    runDiscover,
    runRegisterAndImport,
    reset: resetWizard,
  } = useEndpointWizard();

  const [gpuNodeId, setGpuNodeId] = useState('');
  const [scanRows, setScanRows] = useState<ScannedModelRow[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [deployPath, setDeployPath] = useState('');
  const [deployLogicalId, setDeployLogicalId] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [lastDeployedLogicalId, setLastDeployedLogicalId] = useState('');
  const [importResults, setImportResults] = useState<ModelImportResultRow[]>([]);

  const [manualName, setManualName] = useState('');
  const [manualLogicalId, setManualLogicalId] = useState('');
  const [manualTask, setManualTask] = useState('text-generation');
  const [manualBackend, setManualBackend] = useState('external');
  const [manualActive, setManualActive] = useState(true);
  const [manualPipelineTag, setManualPipelineTag] = useState('text-generation');
  const [manualSaving, setManualSaving] = useState(false);
  const [taxonomyTags, setTaxonomyTags] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    pipelineAdminService.listPools().then((pools: LlmPool[]) => {
      setPoolSuggestions(pools.map((p) => p.logical_id).filter(Boolean));
    });
    pipelineAdminService.getTaxonomy().then((tax) => {
      const tags = tax.map((t) => t.pipeline_tag).filter(Boolean) as string[];
      setTaxonomyTags(tags.length ? tags : ['text-generation']);
      if (tags[0]) {
        setManualTask(tags[0]);
        setManualPipelineTag(tags[0]);
      }
    });
    if (remoteNodes.length && !gpuNodeId) {
      const online = remoteNodes.find((n) => n.online) ?? remoteNodes[0];
      if (online) setGpuNodeId(online.id);
    }
  }, [open, remoteNodes, gpuNodeId]);

  const handleClose = () => {
    resetWizard();
    setTab('server');
    setScanRows([]);
    setDeployPath('');
    setDeployLogicalId('');
    setImportResults([]);
    setLastDeployedLogicalId('');
    setManualName('');
    setManualLogicalId('');
    setManualActive(true);
    onClose();
  };

  const handleManualRegister = async () => {
    const physical = manualName.trim();
    const logical = manualLogicalId.trim();
    if (!physical || !logical) {
      toast.error(t('pipeline.addModel.manualRequired', 'Physical name and logical ID are required'));
      return;
    }
    setManualSaving(true);
    try {
      await pipelineAdminService.updateModel(physical, {
        name: physical,
        logical_id: logical,
        task: manualTask.trim() || manualPipelineTag,
        backend_kind: manualBackend,
        is_active: manualActive,
        metadata: {
          pipeline_tag: manualPipelineTag,
          api: 'chat',
          modalities: ['text'],
        },
      });
      toast.success(t('pipeline.addModel.manualSuccess', 'Model registered'));
      onComplete();
      handleClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setManualSaving(false);
    }
  };

  const handleDiscover = async () => {
    const ok = await runDiscover();
    if (!ok && wizardError) {
      toast.error(
        wizardError === 'discovery_blocked_host'
          ? t('pipeline.errors.discovery_blocked_host')
          : wizardError
      );
    }
  };

  const handleImport = async () => {
    const importResult = await runRegisterAndImport();
    if (!importResult) return;
    setImportResults(importResult.results ?? []);
    const failed = importResult.results?.filter((r) => !r.ok) ?? [];
    if (failed.length) {
      toast.error(
        t('pipeline.addModel.importPartial', '{{ok}}/{{total}} imported', {
          ok: importResult.imported,
          total: importResult.total,
        })
      );
    } else {
      toast.success(t('pipeline.addModel.importSuccess', 'Models imported'));
    }
    onComplete();
  };

  const refreshScan = useCallback(async () => {
    if (!gpuNodeId) return;
    setScanLoading(true);
    try {
      const rows = await adminRemoteNodesService.scanNode(gpuNodeId, { refresh: true });
      setScanRows(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('adminNodes.scanFailed'));
    } finally {
      setScanLoading(false);
    }
  }, [gpuNodeId, t]);

  useEffect(() => {
    if (open && tab === 'gpu' && gpuNodeId) void refreshScan();
  }, [open, tab, gpuNodeId, refreshScan]);

  const handleGpuDeploy = async () => {
    if (!gpuNodeId || !deployPath.trim()) return;
    setDeploying(true);
    try {
      const result = await adminRemoteNodesService.deployModel(gpuNodeId, {
        storage_path: deployPath.trim(),
        logical_id: deployLogicalId.trim() || undefined,
        gpu_memory_fraction: 0.9,
      });
      const served =
        (result as { served_name?: string })?.served_name ??
        (deployLogicalId.trim() || deployPath.split(/[/\\]/).pop() || deployPath);
      for (let i = 0; i < 10; i++) {
        const probe = await adminRemoteNodesService.probeModel(gpuNodeId, served);
        if (probe.ok) break;
        await new Promise((r) => setTimeout(r, 2000));
      }
      const lid = deployLogicalId.trim() || served;
      setLastDeployedLogicalId(lid);
      toast.success(t('adminNodes.deploySuccess'));
      onComplete();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('adminNodes.deployFailed'));
    } finally {
      setDeploying(false);
    }
  };

  useEffect(() => {
    if (!open || tab !== 'gpu' || !gpuNodeId || !deployPath.trim()) return;
    adminRemoteNodesService
      .inspectModel(gpuNodeId, deployPath.trim())
      .then((schema) => {
        const lid = String(schema.logical_id ?? '');
        if (lid && !deployLogicalId) setDeployLogicalId(lid);
      })
      .catch(() => undefined);
  }, [open, tab, gpuNodeId, deployPath, deployLogicalId]);

  const discover = wizardState.discoverResult;
  const errorMessage =
    wizardError === 'discovery_blocked_host'
      ? t('pipeline.errors.discovery_blocked_host')
      : wizardError
        ? formatLlmApiError(new Error(wizardError), t)
        : null;

  return (
    <PipelineAdminDrawer
      open={open}
      onClose={handleClose}
      title={t('pipeline.addModel.title', 'Add model')}
      headerExtra={
        <div className="flex flex-wrap gap-1">
          {(
            [
              ['server', PiCloudBold, t('pipeline.addModel.fromServer', 'From server')],
              ['gpu', PiCpuDuotone, t('pipeline.addModel.fromGpu', 'From GPU')],
              ['manual', PiPencilSimpleBold, t('pipeline.addModel.manual', 'Manual')],
            ] as const
          ).map(([key, Icon, label]) => (
            <Button
              key={key}
              size="sm"
              variant={tab === key ? 'solid' : 'outline'}
              onClick={() => setTab(key)}
              className="gap-1.5"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>
      }
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          {tab === 'server' && (
            <>
              <Button size="sm" variant="outline" onClick={() => void handleDiscover()} disabled={busy}>
                {busy ? <Loader size="sm" /> : t('pipeline.wizard.discover', 'Discover models')}
              </Button>
              {wizardState.importRows.some((r) => r.selected) && (
                <Button size="sm" onClick={() => void handleImport()} disabled={busy}>
                  {busy ? <Loader size="sm" /> : t('pipeline.wizard.import', 'Import')}
                </Button>
              )}
            </>
          )}
          {tab === 'gpu' && (
            <Button
              size="sm"
              onClick={() => void handleGpuDeploy()}
              disabled={deploying || !deployPath.trim()}
            >
              {deploying ? <Loader size="sm" /> : t('adminNodes.deploy')}
            </Button>
          )}
          {tab === 'manual' && (
            <Button
              size="sm"
              onClick={() => void handleManualRegister()}
              disabled={manualSaving || !manualName.trim() || !manualLogicalId.trim()}
            >
              {manualSaving ? <Loader size="sm" /> : t('pipeline.addModel.manualSubmit', 'Register')}
            </Button>
          )}
        </div>
      }
    >
      {tab === 'server' && (
        <div className="space-y-4">
          <Text className="text-sm text-gray-500">
            {t(
              'pipeline.addModel.serverHint',
              'Probe a running vLLM/Ollama server and import models with a logical_id.'
            )}
          </Text>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              size="sm"
              label={t('pipeline.endpoints.host')}
              placeholder="192.168.1.50"
              value={wizardState.connect.host}
              onChange={(e) => setConnect({ host: e.target.value })}
            />
            <Input
              size="sm"
              type="number"
              label={t('pipeline.endpoints.port')}
              value={wizardState.connect.port}
              onChange={(e) => setConnect({ port: Number(e.target.value) })}
            />
            <Input
              size="sm"
              className="sm:col-span-2"
              label={t('pipeline.endpoints.name')}
              value={wizardState.connect.name}
              onChange={(e) => setConnect({ name: e.target.value })}
            />
            <Input
              size="sm"
              className="sm:col-span-2"
              label={t('pipeline.wizard.bearerToken', 'Bearer token (optional)')}
              value={wizardState.connect.bearer_token}
              onChange={(e) => setConnect({ bearer_token: e.target.value })}
            />
          </div>
          {isBlockedHost(wizardState.connect.host) && (
            <Text className="text-xs text-amber-600">
              {t('pipeline.errors.discovery_blocked_host')}
            </Text>
          )}
          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          )}
          {discover && (
            <div className="rounded-lg border border-muted p-3">
              <div className="mb-2 flex flex-wrap gap-2">
                <Badge color={discover.healthy ? 'success' : 'danger'} variant="flat">
                  {discover.healthy
                    ? t('pipeline.wizard.healthy', 'Healthy')
                    : t('pipeline.wizard.unhealthy', 'Unhealthy')}
                </Badge>
                {discover.latency_ms != null && (
                  <Badge variant="outline">{discover.latency_ms}ms</Badge>
                )}
                <Badge variant="outline">
                  {discover.models?.length ?? 0} {t('pipeline.endpoints.models', 'models')}
                </Badge>
              </div>
              {wizardState.importRows.length > 0 ? (
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {wizardState.importRows.map((row, idx) => (
                    <ImportRowEditor
                      key={row.upstream_model_id}
                      row={row}
                      poolSuggestions={poolSuggestions}
                      onChange={(patch) => setImportRow(idx, patch)}
                    />
                  ))}
                </div>
              ) : (
                <Text className="text-sm text-gray-400">
                  {t('pipeline.addModel.noModelsFound', 'No models at this URL')}
                </Text>
              )}
            </div>
          )}
          {importResults.length > 0 && (
            <ul className="space-y-1 text-xs">
              {importResults.map((r) => (
                <li key={r.logical_id} className={r.ok ? 'text-green-600' : 'text-red-600'}>
                  {r.logical_id}: {r.ok ? 'OK' : r.error ?? 'failed'}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'gpu' && (
        <div className="space-y-4">
          <Text className="text-sm text-gray-500">
            {t('pipeline.addModel.gpuHint', 'Scan disk on a GPU host and deploy a model.')}
          </Text>
          <select
            className="w-full rounded-md border border-muted bg-transparent px-3 py-2 text-sm"
            value={gpuNodeId}
            onChange={(e) => setGpuNodeId(e.target.value)}
          >
            {remoteNodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.display_name ?? n.id} {n.online ? '●' : '○'}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void refreshScan()} disabled={scanLoading}>
              {scanLoading ? <Loader size="sm" /> : <PiArrowClockwiseBold className="h-4 w-4" />}
              {t('adminNodes.rescan', 'Rescan')}
            </Button>
          </div>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-muted">
            {scanRows.map((row) => (
              <button
                key={row.storage_path}
                type="button"
                className={`flex w-full items-center justify-between px-3 py-2 text-start text-sm hover:bg-gray-50 ${
                  deployPath === row.storage_path ? 'bg-primary/5' : ''
                }`}
                onClick={() => {
                  setDeployPath(row.storage_path);
                  const short = row.name ?? row.storage_path.split(/[/\\]/).pop() ?? '';
                  if (!deployLogicalId) {
                    setDeployLogicalId(
                      short.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
                    );
                  }
                }}
              >
                <span>{row.name}</span>
                <span className="font-mono text-xs text-gray-400">{row.storage_path}</span>
              </button>
            ))}
          </div>
          <Input
            size="sm"
            label={t('adminNodes.storagePathPlaceholder')}
            value={deployPath}
            onChange={(e) => setDeployPath(e.target.value)}
          />
          <Input
            size="sm"
            label={t('pipeline.wizard.logicalId')}
            value={deployLogicalId}
            list="add-model-pool-suggestions"
            onChange={(e) => setDeployLogicalId(e.target.value)}
          />
          <datalist id="add-model-pool-suggestions">
            {poolSuggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          {lastDeployedLogicalId && (
            <div className="flex flex-wrap gap-3">
              <Link
                href={buildPipelineUrl('models')}
                className="text-xs text-primary hover:underline"
              >
                {t('pipeline.addModel.viewModelsHub', 'Models Hub')}
              </Link>
              <Link
                href={buildPipelineUrl('topology', {
                  lens: 'graph',
                  focus: `model:${lastDeployedLogicalId}`,
                })}
                className="text-xs text-primary hover:underline"
              >
                {t('pipeline.addModel.viewOnBoard', 'View on topology board')}
              </Link>
            </div>
          )}
        </div>
      )}

      {tab === 'manual' && (
        <div className="space-y-4">
          <Text className="text-sm text-gray-500">
            {t(
              'pipeline.addModel.manualHint',
              'Register a model directly in the control plane (advanced). Use discover/import when possible.'
            )}
          </Text>
          <Input
            size="sm"
            label={t('pipeline.models.physicalName', 'Physical name')}
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="replica-host-model"
          />
          <Input
            size="sm"
            label={t('pipeline.wizard.logicalId')}
            value={manualLogicalId}
            list="add-model-pool-suggestions"
            onChange={(e) => setManualLogicalId(e.target.value)}
          />
          {poolSuggestions.includes(manualLogicalId) && (
            <Text className="text-xs text-teal-600">
              {t('pipeline.addModel.joinPool', 'Joins existing pool')}
            </Text>
          )}
          <Input
            size="sm"
            label={t('pipeline.models.task', 'Task / capability')}
            value={manualTask}
            list="manual-taxonomy-tags"
            onChange={(e) => setManualTask(e.target.value)}
          />
          <datalist id="manual-taxonomy-tags">
            {taxonomyTags.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
          <div>
            <Text className="mb-1 text-xs text-gray-500">
              {t('pipeline.models.backend', 'Backend')}
            </Text>
            <select
              className="w-full rounded-md border border-muted bg-transparent px-3 py-2 text-sm"
              value={manualBackend}
              onChange={(e) => setManualBackend(e.target.value)}
            >
              <option value="external">external</option>
              <option value="kserve">kserve</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={manualActive} onChange={() => setManualActive(!manualActive)} />
            {t('pipeline.models.registry', 'Registry active')}
          </label>
        </div>
      )}
    </PipelineAdminDrawer>
  );
}

function ImportRowEditor({
  row,
  poolSuggestions,
  onChange,
}: {
  row: ImportRowState;
  poolSuggestions: string[];
  onChange: (patch: Partial<ImportRowState>) => void;
}) {
  const { t } = useTranslation();
  const poolExists = poolSuggestions.includes(row.logical_id);
  return (
    <div className="rounded border border-muted p-2">
      <div className="flex items-start gap-2">
        <Checkbox checked={row.selected} onChange={() => onChange({ selected: !row.selected })} />
        <div className="min-w-0 flex-1 space-y-1">
          <Text className="truncate font-mono text-xs">{row.upstream_model_id}</Text>
          <Input
            size="sm"
            label={t('pipeline.wizard.logicalId')}
            value={row.logical_id}
            list="add-model-pool-suggestions"
            onChange={(e) => onChange({ logical_id: e.target.value })}
          />
          {poolExists && (
            <Text className="text-xs text-teal-600">
              {t('pipeline.addModel.joinPool', 'Joins existing pool')}
            </Text>
          )}
        </div>
      </div>
    </div>
  );
}

export function AddModelTrigger({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <Button size="sm" onClick={onClick}>
      <PiPlusBold className="me-1.5 h-4 w-4" />
      {t('pipeline.addModel.title', 'Add model')}
    </Button>
  );
}
