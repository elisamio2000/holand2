'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Input, Loader, Text, Title } from 'rizzui';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  adminRemoteNodesService,
  buildFormStateFromSchema,
  formatDeployTransportError,
  parseInspectDefaults,
  splitDeployPayload,
  type DeployFailureDetails,
} from '@/services/admin-remote-nodes.service';
import type { DeployInspectResult, DeploySchemaField } from '@/services/deploy-schema-types';
import { DEPLOY_TOP_LEVEL_KEYS } from '@/services/deploy-schema-types';
import { pipelineAdminService } from '@/services/pipeline-admin.service';
import { buildPipelineUrl } from '@/app/shared/admin-pipeline/helpers/pipeline-tab-url';
import { useNodeDeployStream } from '../hooks/use-node-deploy-stream';

interface DeployModelModalProps {
  open: boolean;
  nodeId: string;
  initialPath?: string;
  onClose: () => void;
  onDeployed: () => void;
}

const ROUTING_KEYS = new Set(['logical_id', 'served_name', 'bind_route', 'priority', 'set_as_default']);

const STAGE_ORDER = [
  'accepted',
  'resolved',
  'preflight',
  'container_start',
  'container_log',
  'probe',
  'agent_ready',
  'mother_verify',
  'registry',
  'ready',
] as const;

function deployFailureMessage(error: unknown): string {
  const failure = (error as Error & { deployFailure?: DeployFailureDetails }).deployFailure;
  if (failure?.logs) {
    return `${failure.message}\n\n${failure.logs.slice(0, 1200)}`;
  }
  if (error instanceof Error && error.message) return error.message;
  return formatDeployTransportError(error).message;
}

function schemaExtraFields(schema: DeployInspectResult['deploy_schema']): DeploySchemaField[] {
  if (!schema?.fields) return [];
  return schema.fields.filter((f) => !DEPLOY_TOP_LEVEL_KEYS.has(f.key) && !ROUTING_KEYS.has(f.key));
}

export default function DeployModelModal({
  open,
  nodeId,
  initialPath = '',
  onClose,
  onDeployed,
}: DeployModelModalProps) {
  const { t } = useTranslation();
  const deployStream = useNodeDeployStream();
  const [storagePath, setStoragePath] = useState(initialPath);
  const [logicalId, setLogicalId] = useState('');
  const [servedName, setServedName] = useState('');
  const [gpuFraction, setGpuFraction] = useState('0.9');
  const [runtime, setRuntime] = useState('');
  const [task, setTask] = useState('');
  const [bindRoute, setBindRoute] = useState('');
  const [priority, setPriority] = useState('1000');
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [extraFields, setExtraFields] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [deploying, setDeploying] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [lastLogicalId, setLastLogicalId] = useState('');
  const [inspectResult, setInspectResult] = useState<DeployInspectResult | null>(null);

  const advancedSchemaFields = useMemo(
    () => schemaExtraFields(inspectResult?.deploy_schema),
    [inspectResult]
  );

  useEffect(() => {
    setStoragePath(initialPath);
  }, [initialPath, open]);

  useEffect(() => {
    if (!open) {
      setInspectResult(null);
      deployStream.reset();
      return;
    }
    pipelineAdminService.listPools().then((pools) => {
      setSuggestions(pools.map((p) => p.logical_id).filter(Boolean));
    });
  }, [open, deployStream]);

  useEffect(() => {
    if (!open || !storagePath.trim()) return;
    setInspecting(true);
    adminRemoteNodesService
      .inspectModel(nodeId, storagePath.trim(), runtime.trim() || undefined)
      .then((inspect) => {
        setInspectResult(inspect);
        const defaults = parseInspectDefaults(
          inspect as Record<string, unknown>,
          storagePath.trim()
        );
        if (defaults.served_name && !servedName) setServedName(String(defaults.served_name));
        if (defaults.logical_id && !logicalId) setLogicalId(String(defaults.logical_id));
        if (defaults.runtime && !runtime) setRuntime(String(defaults.runtime));
        if (defaults.task && !task) setTask(String(defaults.task));
        if (defaults.gpu_memory_fraction != null && gpuFraction === '0.9') {
          setGpuFraction(String(defaults.gpu_memory_fraction));
        }
        if (defaults.bind_route && !bindRoute) setBindRoute(String(defaults.bind_route));
        if (defaults.priority != null && priority === '1000') {
          setPriority(String(defaults.priority));
        }
        if (defaults.set_as_default) setSetAsDefault(true);

        const extras: Record<string, string> = {};
        for (const field of schemaExtraFields(inspect.deploy_schema)) {
          if (field.default != null) extras[field.key] = String(field.default);
        }
        setExtraFields(extras);
      })
      .catch(() => {
        /* optional inspect */
      })
      .finally(() => setInspecting(false));
  }, [open, nodeId, storagePath]);

  if (!open) return null;

  const handleDeploy = async () => {
    if (!storagePath.trim()) return;
    setDeploying(true);
    deployStream.reset();
    try {
      const schema = inspectResult?.deploy_schema;
      let body: Parameters<typeof adminRemoteNodesService.deployModel>[1];

      const preserve: Record<string, unknown> = {
        logical_id: logicalId.trim() || undefined,
        served_name: servedName.trim() || undefined,
        runtime: runtime.trim() || undefined,
        task: task.trim() || undefined,
        gpu_memory_fraction: Number(gpuFraction) || 0.9,
        bind_route: bindRoute.trim() || undefined,
        priority: priority.trim() ? Number(priority) : undefined,
        set_as_default: setAsDefault,
        ...Object.fromEntries(
          Object.entries(extraFields).filter(([, v]) => v !== '').map(([k, v]) => [k, v])
        ),
      };

      if (schema) {
        const formState = buildFormStateFromSchema(inspectResult!, storagePath.trim(), preserve);
        const split = splitDeployPayload(formState, schema, storagePath.trim());
        body = {
          ...split.topLevel,
          storage_path: storagePath.trim(),
          deploy_options: split.deploy_options,
          process_options: split.process_options,
        } as Parameters<typeof adminRemoteNodesService.deployModel>[1];
      } else {
        body = {
          storage_path: storagePath.trim(),
          ...preserve,
        } as Parameters<typeof adminRemoteNodesService.deployModel>[1];
      }

      const rt = String(body.runtime ?? '').toLowerCase();
      const useAsync =
        rt === 'vllm-openai' || rt === 'vllm-omni' || rt === 'diffusion' || rt === 'triton';

      const probeName =
        servedName.trim() ||
        storagePath.split(/[/\\]/).pop() ||
        storagePath.trim();

      if (useAsync) {
        const job = await adminRemoteNodesService.startDeployJob(nodeId, body);
        if (job.pool_warning) toast(job.pool_warning, { icon: '⚠️' });

        const wsUrl = typeof job.ws_url === 'string' ? job.ws_url : undefined;
        const completion = await deployStream.waitForCompletion({
          wsUrl,
          nodeId,
          servedName: probeName,
        });

        if (!completion.ok) {
          throw new Error(deployStream.error ?? t('adminNodes.deployFailed'));
        }
      } else {
        await adminRemoteNodesService.deployModel(nodeId, body);
        const completion = await deployStream.waitForCompletion({
          nodeId,
          servedName: probeName,
          timeoutMs: 3 * 60 * 1000,
        });
        if (!completion.ok) {
          toast(t('adminNodes.deployTimeoutHint'), { icon: '⚠️', duration: 8000 });
        }
      }

      toast.success(t('adminNodes.deploySuccess'));
      setLastLogicalId(logicalId.trim() || servedName.trim() || probeName);
      onDeployed();
    } catch (e) {
      toast.error(deployFailureMessage(e), { duration: 8000 });
    } finally {
      setDeploying(false);
      deployStream.reset();
    }
  };

  const streamBadge =
    deployStream.mode === 'live'
      ? t('adminNodes.deployWsLive', 'Live stream')
      : deployStream.mode === 'connecting'
        ? t('adminNodes.deployWsConnecting', 'Connecting…')
        : deployStream.mode === 'polling'
          ? t('adminNodes.deployLogWaiting', 'Waiting for container logs…')
          : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-muted bg-gray-0 p-6 dark:bg-gray-50">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Title as="h5" className="text-lg font-semibold">
            {t('adminNodes.deployModalTitle', 'Deploy model')}
          </Title>
          {deploying && streamBadge && (
            <Badge variant="flat" size="sm" color="info">
              {streamBadge}
            </Badge>
          )}
        </div>

        <div className="space-y-3">
          <Input
            size="sm"
            label={t('adminNodes.storagePathPlaceholder')}
            value={storagePath}
            onChange={(e) => setStoragePath(e.target.value)}
            disabled={deploying}
          />

          <Text className="text-xs font-semibold text-gray-500">
            {t('adminNodes.deployRoutingContext', 'Routing')}
          </Text>
          <Input
            size="sm"
            label={t('pipeline.wizard.logicalId')}
            value={logicalId}
            list="deploy-logical-suggestions"
            onChange={(e) => setLogicalId(e.target.value)}
            disabled={deploying}
          />
          <datalist id="deploy-logical-suggestions">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <Text className="text-[10px] text-gray-400">
            {t(
              'adminNodes.deployLogicalIdHint',
              'Same logical ID on multiple nodes = one load-balancing pool (mother registry).'
            )}
          </Text>
          <Input
            size="sm"
            label={t('adminNodes.servedName', 'Served name')}
            value={servedName}
            onChange={(e) => setServedName(e.target.value)}
            disabled={deploying}
          />

          <Text className="text-xs font-semibold text-gray-500">
            {t('adminNodes.deployMotherSection', 'Route binding')}
          </Text>
          <Input
            size="sm"
            label={t('adminNodes.bindRoute', 'Bind route')}
            value={bindRoute}
            onChange={(e) => setBindRoute(e.target.value)}
            disabled={deploying}
          />
          <Input
            size="sm"
            type="number"
            label={t('adminNodes.priority', 'Priority')}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            disabled={deploying}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={setAsDefault}
              onChange={(e) => setSetAsDefault(e.target.checked)}
              disabled={deploying}
            />
            {t('adminNodes.setAsDefault', 'Set as default')}
          </label>

          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {t('adminNodes.deployAdvanced', 'Advanced options')}
          </button>

          {showAdvanced && (
            <div className="space-y-3 rounded-lg border border-muted p-3">
              <Input
                size="sm"
                type="number"
                step="0.05"
                min="0.1"
                max="1"
                label={t('adminNodes.gpuFraction', 'GPU memory fraction')}
                value={gpuFraction}
                onChange={(e) => setGpuFraction(e.target.value)}
                disabled={deploying}
              />
              <Input
                size="sm"
                label={t('adminNodes.runtime', 'Runtime')}
                value={runtime}
                onChange={(e) => setRuntime(e.target.value)}
                disabled={deploying}
              />
              <Input
                size="sm"
                label={t('pipeline.models.task', 'Task')}
                value={task}
                onChange={(e) => setTask(e.target.value)}
                disabled={deploying}
              />
              {advancedSchemaFields.map((field) => (
                <Input
                  key={field.key}
                  size="sm"
                  label={field.label ?? field.key}
                  value={extraFields[field.key] ?? ''}
                  onChange={(e) =>
                    setExtraFields((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  disabled={deploying}
                />
              ))}
            </div>
          )}

          {inspecting && (
            <Text className="text-xs text-gray-400">
              {t('adminNodes.inspecting', 'Inspecting…')}
            </Text>
          )}

          {deploying && (
            <div className="rounded-lg border border-muted bg-gray-50/80 p-3 dark:bg-gray-100/10">
              <Text className="mb-2 text-xs font-medium">
                {t('adminNodes.deployInProgress', 'Deploy in progress…')}
              </Text>
              <ul className="mb-2 space-y-1">
                {STAGE_ORDER.map((stage) => {
                  const done = deployStream.completedStages.includes(stage);
                  const active = deployStream.currentStage === stage;
                  return (
                    <li
                      key={stage}
                      className={`text-[10px] ${done ? 'text-green-600' : active ? 'text-primary' : 'text-gray-400'}`}
                    >
                      {t(`adminNodes.deployStage.${stage}`, stage)}
                      {done ? ' ✓' : active ? ' …' : ''}
                    </li>
                  );
                })}
              </ul>
              {deployStream.logLines.length > 0 && (
                <pre className="max-h-32 overflow-auto rounded bg-gray-900 p-2 font-mono text-[9px] text-green-200">
                  {deployStream.logLines.slice(-40).join('\n')}
                </pre>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          {lastLogicalId && (
            <div className="me-auto flex flex-wrap gap-3">
              <Link
                href={buildPipelineUrl('models')}
                className="text-xs text-primary hover:underline"
              >
                {t('pipeline.addModel.viewModelsHub', 'Models Hub')}
              </Link>
              <Link
                href={buildPipelineUrl('topology', {
                  view: 'board',
                  focus: `model:${lastLogicalId}`,
                })}
                className="text-xs text-primary hover:underline"
              >
                {t('adminNodes.viewInPipeline', 'View on board')}
              </Link>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={onClose} disabled={deploying}>
            {t('common.cancel')}
          </Button>
          <Button
            size="sm"
            onClick={() => void handleDeploy()}
            disabled={deploying || !storagePath.trim()}
          >
            {deploying ? <Loader size="sm" /> : t('adminNodes.deploy')}
          </Button>
        </div>
      </div>
    </div>
  );
}
