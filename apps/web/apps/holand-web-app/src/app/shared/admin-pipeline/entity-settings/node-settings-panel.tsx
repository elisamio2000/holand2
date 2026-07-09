'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, Button, Text } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { PiCaretDownBold, PiCaretRightBold, PiTrashBold, PiCrosshairBold } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { TopologyNode, TopologyPipelineData } from '../topology-board/helpers/topology-board-types';
import { useTopologyBoardStore } from '../topology-board/store/topology-board-store';
import { applyEntityPatch } from '../topology-board/helpers/save-to-api';
import { edgeLabel } from '../topology-board/helpers/edge-styles';
import { resolveEdgeSemantics } from '../topology-board/helpers/edge-semantics';
import StatusDot from '../components/status-dot';
import { statusDotColor, modelHealthKind } from '@/utils/model-health';
import { resolveLogicalId, normalizeBindingModelId, findModelsForLogicalId } from '../helpers/logical-model-options';
import { buildPipelineUrl } from '../helpers/pipeline-tab-url';
import { adminRemoteNodesService } from '@/services/admin-remote-nodes.service';
import type { RemoteDeployedModel } from '@/services/admin-remote-nodes.service';
import { pipelineAdminService } from '@/services/pipeline-admin.service';
import { modelsImportedFromEndpoint } from '../helpers/endpoint-imported-models';
import { candidateModelName } from '@/app/shared/admin-llm/utils/format-model-label';
import { useEntitySchema } from './use-entity-schema';
import { filterVisibleFields } from './field-visibility';
import { buildNodeFieldValues } from './build-entity-values';
import FieldRenderer from './field-renderer/field-renderer';
import ModelDetailDrawer from '../components/model-detail-drawer';
import type { LlmModel, LlmModelMeta } from '@/types/pipeline-admin.types';
import type { SettingsPanelMode } from './schema-types';

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-muted last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-600"
      >
        {open ? <PiCaretDownBold className="h-3 w-3" /> : <PiCaretRightBold className="h-3 w-3" />}
        {title}
      </button>
      {open && <div className="space-y-2 px-3 pb-3">{children}</div>}
    </div>
  );
}

interface NodeSettingsPanelProps {
  node: TopologyNode;
  pipelineData: TopologyPipelineData | null;
  mode: SettingsPanelMode;
  onRefresh: () => Promise<void>;
  showConnections?: boolean;
}

export default function NodeSettingsPanel({
  node,
  pipelineData,
  mode,
  onRefresh,
  showConnections = true,
}: NodeSettingsPanelProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [probing, setProbing] = useState(false);
  const [endpointProbing, setEndpointProbing] = useState(false);
  const [endpointProbeResult, setEndpointProbeResult] = useState<string | null>(null);
  const [detailModelName, setDetailModelName] = useState<string | null>(null);
  const [nodeDeployed, setNodeDeployed] = useState<RemoteDeployedModel[]>([]);
  const [nodeGpuSummary, setNodeGpuSummary] = useState<string | null>(null);
  const [nodeSnapshotLoading, setNodeSnapshotLoading] = useState(false);
  const [assigningRole, setAssigningRole] = useState(false);
  const [deletingRoute, setDeletingRoute] = useState(false);
  const { schema, loading: schemaLoading } = useEntitySchema(node.data.kind);
  const models = useMemo(() => pipelineData?.models ?? [], [pipelineData?.models]);
  const pools = useMemo(() => pipelineData?.pools ?? [], [pipelineData?.pools]);
  const logicalCatalog = pipelineData?.logicalCatalog ?? [];
  const nodes = useTopologyBoardStore((s) => s.nodes);
  const edges = useTopologyBoardStore((s) => s.edges);
  const updateNodeData = useTopologyBoardStore((s) => s.updateNodeData);
  const removeNode = useTopologyBoardStore((s) => s.removeNode);
  const setSelectedEdgeId = useTopologyBoardStore((s) => s.setSelectedEdgeId);
  const setSelectedNodeId = useTopologyBoardStore((s) => s.setSelectedNodeId);

  const connected = useMemo(() => {
    return {
      in: edges.filter((e) => e.target === node.id),
      out: edges.filter((e) => e.source === node.id),
    };
  }, [node.id, edges]);

  const deployTargets = useMemo(() => {
    if (node.data.kind !== 'model') return [];
    return connected.out
      .map((e) => nodes.find((n) => n.id === e.target))
      .filter((n) => n?.data.kind === 'remoteNode')
      .map((n) => ({
        label: n!.data.label,
        nodeId: n!.data.entityId,
      }));
  }, [node.data.kind, connected.out, nodes]);

  const modelLogicalId = useMemo(() => {
    if (node.data.kind !== 'model' || !node.data.model) return '';
    return resolveLogicalId(node.data.model as import('@/types/pipeline-admin.types').LlmModel);
  }, [node.data.kind, node.data.model]);

  const replicaCount = useMemo(() => {
    if (!modelLogicalId) return 0;
    const pool = pools.find((p) => p.logical_id === modelLogicalId);
    if (pool?.replicas?.length) return pool.replicas.length;
    return findModelsForLogicalId(models, modelLogicalId).length;
  }, [modelLogicalId, pools, models]);

  const endpointImportedModels = useMemo(() => {
    if (node.data.kind !== 'endpoint' || !node.data.endpoint) return [];
    if (!node.data.endpoint) return [];
    const ep = node.data.endpoint;
    return modelsImportedFromEndpoint(
      { id: ep.id ?? ep.name ?? '', name: ep.name ?? ep.id ?? '' },
      models
    );
  }, [node.data.kind, node.data.endpoint, models]);

  useEffect(() => {
    if (node.data.kind !== 'remoteNode') {
      setNodeDeployed([]);
      setNodeGpuSummary(null);
      return;
    }
    const nodeId = node.data.entityId;
    let cancelled = false;
    setNodeSnapshotLoading(true);
    void (async () => {
      try {
        const [deployed, gpu] = await Promise.all([
          adminRemoteNodesService.listDeployed(nodeId),
          adminRemoteNodesService.getNodeGpu(nodeId),
        ]);
        if (cancelled) return;
        setNodeDeployed(deployed);
        const devices = Array.isArray(gpu?.devices) ? gpu.devices : [];
        if (devices.length === 0) {
          setNodeGpuSummary(null);
        } else {
          const first = devices[0] as Record<string, unknown>;
          const name = String(first.name ?? first.model ?? 'GPU');
          const mem =
            first.memory_used_mb != null && first.memory_total_mb != null
              ? `${first.memory_used_mb}/${first.memory_total_mb} MB`
              : '';
          setNodeGpuSummary(mem ? `${name} · ${mem}` : name);
        }
      } catch {
        if (!cancelled) {
          setNodeDeployed([]);
          setNodeGpuSummary(null);
        }
      } finally {
        if (!cancelled) setNodeSnapshotLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [node.data.kind, node.data.entityId]);

  const handleProbeEndpoint = useCallback(async () => {
    const ep = node.data.endpoint;
    if (!ep?.id) return;
    setEndpointProbing(true);
    try {
      const result = await pipelineAdminService.probeEndpoint(ep.id);
      const healthy = result?.healthy ?? false;
      const latency = result?.latency_ms;
      setEndpointProbeResult(
        `${healthy ? 'healthy' : 'unhealthy'}${latency != null ? ` · ${latency}ms` : ''}`
      );
      toast.success(t('pipeline.models.probeDone'));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setEndpointProbing(false);
    }
  }, [node.data.endpoint, t]);

  const handleDrainNode = useCallback(async () => {
    const nodeId = node.data.entityId;
    if (!nodeId || !confirm(t('adminNodes.drainConfirm', 'Drain all inference on this node?'))) return;
    try {
      await adminRemoteNodesService.drainNode(nodeId);
      toast.success(t('adminNodes.drainSuccess'));
      await onRefresh();
    } catch {
      toast.error(t('common.error'));
    }
  }, [node.data.entityId, onRefresh, t]);

  const canApply = node.data.kind !== 'remoteNode';

  const handleProbeModel = useCallback(async () => {
    setProbing(true);
    try {
      await pipelineAdminService.fetchLlmHealth();
      await onRefresh();
      toast.success(t('pipeline.models.probeDone'));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setProbing(false);
    }
  }, [onRefresh, t]);

  const handleAssignCandidate = useCallback(
    async (modelName: string) => {
      if (node.data.kind !== 'role' || !node.data.role) return;
      setAssigningRole(true);
      try {
        await pipelineAdminService.assignRoleModel(
          node.data.entityId,
          normalizeBindingModelId(models, modelName)
        );
        toast.success(t('pipeline.roles.assignSuccess'));
        await onRefresh();
      } catch {
        toast.error(t('common.error'));
      } finally {
        setAssigningRole(false);
      }
    },
    [models, node.data.entityId, node.data.kind, node.data.role, onRefresh, t]
  );

  const handleDeleteEntity = useCallback(async () => {
    if (node.data.kind === 'group') return;
    if (node.data.kind === 'route') {
      if (!confirm(t('pipeline.routes.deleteConfirm', 'Delete this route?'))) return;
      setDeletingRoute(true);
      try {
        await pipelineAdminService.deleteRoute(node.data.entityId);
        toast.success(`${node.data.entityId} ${t('common.delete')} ✓`);
        removeNode(node.id);
        await onRefresh();
      } catch {
        toast.error(t('common.error'));
      } finally {
        setDeletingRoute(false);
      }
      return;
    }
    if (!confirm(t('common.deleteConfirm', 'Remove from canvas?'))) return;
    removeNode(node.id);
  }, [node.data.entityId, node.data.kind, node.id, onRefresh, removeNode, t]);

  const values = useMemo(
    () => buildNodeFieldValues(node, models, pools, deployTargets.map((d) => d.label)),
    [node, models, pools, deployTargets]
  );

  const stateBadges = useMemo(() => {
    const badges: { label: string; tone: 'warning' | 'danger' | 'info' }[] = [];
    if (node.data.muted) badges.push({ label: 'bypass', tone: 'warning' });
    if (node.data.kind === 'tool' && !node.data.binding?.model) {
      badges.push({ label: 'unbound', tone: 'warning' });
    }
    if (node.data.kind === 'model' && node.data.model?.is_active === false) {
      badges.push({ label: 'registry off', tone: 'warning' });
    }
    if (node.data.kind === 'model') {
      const hk = modelHealthKind(node.data.model as Parameters<typeof modelHealthKind>[0]);
      if (hk === 'unhealthy') badges.push({ label: 'unhealthy', tone: 'danger' });
    }
    if (node.data.kind === 'remoteNode' && node.data.remoteNode?.online === false) {
      badges.push({ label: 'offline', tone: 'danger' });
    }
    const modelExists =
      node.data.kind !== 'model' ||
      models.some((m) => m.name === node.data.entityId);
    if (node.data.kind === 'tool' && node.data.binding?.fallback_model) {
      badges.push({ label: 'fallback configured', tone: 'info' });
    }
    if (node.data.kind === 'route' && node.data.route?.fallback_model_name) {
      badges.push({ label: 'fallback configured', tone: 'info' });
    }
    if (node.data.kind === 'model' && !modelExists) {
      badges.push({ label: 'orphan', tone: 'danger' });
    }
    return badges;
  }, [node, models]);

  const handleFieldChange = useCallback(
    (key: string, value: unknown) => {
      const kind = node.data.kind;
      if (kind === 'tool' || kind === 'plugin') {
        updateNodeData(node.id, {
          binding: { ...node.data.binding!, [key]: value || null },
        });
      } else if (kind === 'route') {
        if (key === 'constraints') {
          const val = value;
          updateNodeData(node.id, {
            route: {
              ...node.data.route!,
              constraints:
                typeof val === 'object' && val !== null
                  ? (val as Record<string, unknown>)
                  : node.data.route!.constraints,
            },
          });
        } else {
          updateNodeData(node.id, {
            route: { ...node.data.route!, [key]: value },
          });
        }
      } else if (kind === 'role' && key === 'current_model') {
        updateNodeData(node.id, {
          role: { ...node.data.role!, current_model: String(value) },
        });
      } else if (kind === 'role' && key === 'fallback_model_name') {
        updateNodeData(node.id, {
          role: { ...node.data.role!, fallback_model_name: String(value) || null },
        });
      } else if (kind === 'model') {
        const meta =
          typeof node.data.model?.metadata === 'object' && node.data.model.metadata
            ? { ...(node.data.model.metadata as LlmModelMeta) }
            : {};
        if (key === 'pipeline_tag') meta.pipeline_tag = String(value);
        else if (key === 'modalities') meta.modalities = value as string[];
        else if (key === 'metadata') Object.assign(meta, value as Record<string, unknown>);
        else if (key === 'task' || key === 'is_active') {
          updateNodeData(node.id, {
            model: { ...node.data.model!, [key]: value },
          });
          return;
        }
        updateNodeData(node.id, {
          model: { ...node.data.model!, metadata: meta, task: node.data.model!.task },
        });
      } else if (kind === 'endpoint') {
        updateNodeData(node.id, {
          endpoint: {
            ...node.data.endpoint!,
            [key]: key === 'port' ? Number(value) : value,
          },
        });
      } else if (kind === 'service' && node.data.serviceBinding) {
        updateNodeData(node.id, {
          serviceBinding: { ...node.data.serviceBinding, [key]: value },
        });
      } else if (kind === 'group' && key === 'groupLabel') {
        updateNodeData(node.id, {
          groupLabel: String(value),
          label: String(value),
        });
      } else if (key === 'muted') {
        updateNodeData(node.id, { muted: Boolean(value) });
      }
    },
    [node, updateNodeData]
  );

  const handleApply = async () => {
    const kind = node.data.kind;
    try {
      if (kind === 'tool' && node.data.binding) {
        await applyEntityPatch('tool', node.data.entityId, { ...node.data.binding });
      } else if (kind === 'route' && node.data.route) {
        await applyEntityPatch('route', node.data.entityId, {
          model_name: node.data.route.model_name,
          fallback_model_name: node.data.route.fallback_model_name,
          is_active: node.data.route.is_active,
          constraints: node.data.route.constraints,
        });
      } else if (kind === 'role' && node.data.role?.current_model) {
        await applyEntityPatch('role', node.data.entityId, {
          model_name: node.data.role.current_model,
        });
      } else if (kind === 'plugin' && node.data.binding) {
        await applyEntityPatch('plugin', node.data.entityId, { ...node.data.binding });
      } else if (kind === 'model' && node.data.model) {
        const meta =
          typeof node.data.model.metadata === 'object' && node.data.model.metadata
            ? { ...(node.data.model.metadata as LlmModelMeta) }
            : {};
        await applyEntityPatch('model', node.data.entityId, {
          is_active: node.data.model.is_active,
          task: node.data.model.task,
          metadata: {
            ...meta,
            pipeline_tag: String(values.pipeline_tag ?? meta.pipeline_tag ?? ''),
            modalities: (values.modalities as string[]) ?? meta.modalities ?? [],
          },
        });
      } else if (kind === 'endpoint' && node.data.endpoint) {
        await applyEntityPatch('endpoint', node.data.entityId, {
          host: node.data.endpoint.host,
          port: node.data.endpoint.port,
          scheme: node.data.endpoint.scheme,
          base_path: node.data.endpoint.base_path,
          is_active: node.data.endpoint.is_active,
        });
      } else if (kind === 'group') {
        useTopologyBoardStore.getState().persistLayout();
      } else if (kind === 'service' && node.data.serviceBinding) {
        const sb = node.data.serviceBinding;
        const sbExtra = sb as Record<string, unknown>;
        await applyEntityPatch('service', node.data.entityId, {
          model: normalizeBindingModelId(models, String(sb.model_name ?? '')),
          fallback_model: sb.fallback_model_name
            ? normalizeBindingModelId(models, String(sb.fallback_model_name))
            : null,
          constraints: {
            prefer_external: Boolean(sbExtra.prefer_external),
            load_balance: Boolean(sbExtra.load_balance),
          },
        });
      }
      toast.success(t('pipeline.topology.board.applied', 'Applied'));
      await onRefresh();
    } catch {
      toast.error(t('common.error'));
    }
  };

  const kindLabel = t(`pipeline.topology.board.entities.${node.data.kind}`, node.data.kind);
  const primaryKeys = schema?.primaryFields ?? [];
  const sections = schema?.sections ?? [];

  const renderFields = (fieldKeys: string[]) =>
    sections.flatMap((sec) =>
      filterVisibleFields(
        sec.fields.filter((f) => fieldKeys.includes(f.key)),
        values
      ).map((field) => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={values[field.key]}
          models={models}
          catalog={logicalCatalog}
          onChange={handleFieldChange}
        />
      ))
    );

  return (
    <>
      <div className="border-b border-muted p-2">
        <Text className="text-sm font-semibold">
          {mode === 'advanced'
            ? t('pipeline.settings.advancedTitle', 'Node Settings')
            : t('pipeline.topology.board.inspector', 'Inspector')}
        </Text>
        <Badge variant="flat" size="sm" className="mt-1 capitalize">
          {kindLabel}
        </Badge>
        <Text className="mt-1 break-all font-mono text-xs">{node.data.label}</Text>
        {node.data.kind === 'model' && node.data.model && (
          <Text className="mt-0.5 font-mono text-[10px] text-gray-400">
            {resolveLogicalId(node.data.model as import('@/types/pipeline-admin.types').LlmModel)} ·{' '}
            {(node.data.model as import('@/types/pipeline-admin.types').LlmModel).name}
          </Text>
        )}
        {node.data.kind === 'model' && node.data.healthKind && (
          <div className="mt-1 flex items-center gap-1">
            <StatusDot
              color={statusDotColor(node.data.healthKind)}
              pulse={node.data.healthKind === 'healthy'}
              size="sm"
            />
            <Text className="text-[10px] text-gray-500">{node.data.healthKind}</Text>
          </div>
        )}
        {stateBadges.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {stateBadges.map((b) => (
              <Badge
                key={b.label}
                variant="outline"
                size="sm"
                className={`text-[9px] ${
                  b.tone === 'danger'
                    ? 'border-red-300 text-red-600'
                    : b.tone === 'info'
                      ? 'border-indigo-300 text-indigo-600'
                      : 'border-amber-300 text-amber-700'
                }`}
              >
                {b.label}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {node.data.kind === 'endpoint' && node.data.endpoint && (
        <Section title={t('pipeline.inspector.endpointActions', 'Endpoint actions')} defaultOpen>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={endpointProbing}
              onClick={() => void handleProbeEndpoint()}
            >
              {t('pipeline.endpoints.probe')}
            </Button>
            <Link
              href={buildPipelineUrl('endpoints', {
                endpoint: node.data.endpoint.id ?? node.data.endpoint.name,
              })}
            >
              <Button size="sm" variant="outline">
                {t('pipeline.inspector.editEndpoint', 'Edit in Endpoints')}
              </Button>
            </Link>
          </div>
          {endpointProbeResult && (
            <Text className="mt-2 font-mono text-[10px] text-gray-500">{endpointProbeResult}</Text>
          )}
          <Text className="mt-2 font-mono text-[10px] text-gray-400">
            {node.data.endpoint.host}:{node.data.endpoint.port}
          </Text>
          <div className="mt-3">
            <Text className="text-[10px] font-semibold text-gray-500">
              {t('pipeline.inspector.importedModels', 'Imported models')}
            </Text>
            {endpointImportedModels.length === 0 ? (
              <Text className="text-[10px] text-gray-400">
                {t('pipeline.inspector.noImportedModels', 'No imported models')}
              </Text>
            ) : (
              <div className="mt-1 max-h-32 space-y-1 overflow-y-auto">
                {endpointImportedModels.map((m) => {
                  const hk = modelHealthKind(m);
                  return (
                    <div
                      key={m.name}
                      className="flex items-center justify-between gap-2 rounded border border-muted px-2 py-1"
                    >
                      <div className="min-w-0">
                        <Text className="truncate font-mono text-[10px]">{m.name}</Text>
                        <Text className="text-[9px] text-gray-400">{resolveLogicalId(m)}</Text>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <StatusDot color={statusDotColor(hk)} size="sm" />
                        <Button
                          size="sm"
                          variant="text"
                          className="text-[9px]"
                          onClick={() => setDetailModelName(m.name)}
                        >
                          {t('common.edit')}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Section>
      )}

      {node.data.kind === 'remoteNode' && (
        <Section title={t('pipeline.inspector.nodeActions', 'Node actions')} defaultOpen>
          <Text className="font-mono text-[10px] text-gray-500">
            {node.data.remoteNode?.agent_url ?? node.data.entityId}
          </Text>
          <Text className="mt-1 text-[10px] text-gray-400">
            models_root:{' '}
            {String(
              node.data.remoteNode?.metadata?.models_root ??
                node.data.remoteNode?.models_root ??
                '—'
            )}
          </Text>
          <Text className="text-[10px] text-gray-400">
            last_seen: {String(node.data.remoteNode?.metadata?.last_seen ?? '—')}
          </Text>
          {nodeSnapshotLoading ? (
            <Text className="mt-2 text-[10px] text-gray-400">{t('common.loading')}</Text>
          ) : (
            <>
              {nodeGpuSummary && (
                <Text className="mt-2 text-[10px] text-gray-500">GPU: {nodeGpuSummary}</Text>
              )}
              {nodeDeployed.length > 0 && (
                <div className="mt-2 max-h-28 space-y-1 overflow-y-auto">
                  {nodeDeployed.map((d) => (
                    <div
                      key={d.served_name ?? d.name ?? d.storage_path}
                      className="rounded border border-muted px-2 py-1 font-mono text-[9px]"
                    >
                      {d.served_name ?? d.name ?? d.storage_path}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href={`/admin/nodes?node=${encodeURIComponent(node.data.entityId)}`}>
              <Button size="sm" variant="outline">
                {t('pipeline.inspector.openInNodes', 'Open in Nodes')}
              </Button>
            </Link>
            <Link
              href={`/admin/nodes?node=${encodeURIComponent(node.data.entityId)}&deploy=1`}
            >
              <Button size="sm" variant="outline">
                {t('adminNodes.deploy', 'Deploy model')}
              </Button>
            </Link>
            <Button size="sm" variant="outline" color="danger" onClick={() => void handleDrainNode()}>
              {t('adminNodes.drain', 'Drain node')}
            </Button>
          </div>
        </Section>
      )}

      {node.data.kind === 'model' && node.data.model && (
        <Section title={t('pipeline.inspector.modelActions', 'Quick actions')} defaultOpen>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={probing} onClick={() => void handleProbeModel()}>
              {t('pipeline.models.probe', 'Probe health')}
            </Button>
            {modelLogicalId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  router.push(
                    buildPipelineUrl('topology', {
                      view: 'board',
                      focus: `model:${modelLogicalId}`,
                    })
                  )
                }
              >
                {t('pipeline.models.showTopology', 'Show on board')}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDetailModelName(node.data.entityId)}
            >
              {t('pipeline.inspector.openFullSettings', 'Open full settings')}
            </Button>
          </div>
          <Text className="text-[10px] text-gray-500">
            {t('pipeline.models.replicas', 'Replicas')}: {replicaCount}
            {node.data.model.origin ? ` · ${t('pipeline.models.origin', 'Origin')}: ${String(node.data.model.origin)}` : ''}
          </Text>
        </Section>
      )}

      {node.data.kind === 'model' && deployTargets.length > 0 && (
        <Section title={t('pipeline.topology.board.deploy', 'Deploy / Host')} defaultOpen>
          {deployTargets.map((host) => (
            <div key={host.nodeId} className="flex items-center justify-between gap-2">
              <Text className="font-mono text-[10px] text-cyan-700">deploy → {host.label}</Text>
              <Link href={`/admin/nodes?node=${encodeURIComponent(host.nodeId)}`}>
                <Button size="sm" variant="text" className="text-[10px]">
                  {t('pipeline.models.openOnNode', 'Open node')}
                </Button>
              </Link>
            </div>
          ))}
        </Section>
      )}

      {showConnections && mode === 'compact' && (
        <Section
          title={t('pipeline.topology.board.connected', 'Connections')}
          defaultOpen={connected.in.length + connected.out.length > 0}
        >
          {connected.out.map((e) => {
            const target = nodes.find((n) => n.id === e.target);
            const sem = resolveEdgeSemantics(e, node, target, models, edges, nodes);
            return (
              <div key={e.id} className="flex items-center gap-1">
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded border border-muted px-2 py-1 text-left text-[10px] hover:bg-gray-100"
                  onClick={() => setSelectedEdgeId(e.id)}
                >
                  → {target?.data.label ?? e.target}{' '}
                  <span className="font-mono text-gray-500">· {sem.label}</span>
                </button>
                {target && (
                  <button
                    type="button"
                    className="shrink-0 rounded border border-muted p-1 text-gray-500 hover:bg-gray-100"
                    title={t('pipeline.topology.board.focus', 'Focus')}
                    onClick={() => {
                      setSelectedNodeId(target.id);
                      setSelectedEdgeId(null);
                    }}
                  >
                    <PiCrosshairBold className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
          {connected.in.map((e) => {
            const source = nodes.find((n) => n.id === e.source);
            const sem = resolveEdgeSemantics(e, source, node, models, edges, nodes);
            return (
              <div key={e.id} className="flex items-center gap-1">
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded border border-muted px-2 py-1 text-left text-[10px] hover:bg-gray-100"
                  onClick={() => setSelectedEdgeId(e.id)}
                >
                  ← {source?.data.label ?? e.source}{' '}
                  <span className="font-mono text-gray-500">· {sem.label}</span>
                </button>
                {source && (
                  <button
                    type="button"
                    className="shrink-0 rounded border border-muted p-1 text-gray-500 hover:bg-gray-100"
                    title={t('pipeline.topology.board.focus', 'Focus')}
                    onClick={() => {
                      setSelectedNodeId(source.id);
                      setSelectedEdgeId(null);
                    }}
                  >
                    <PiCrosshairBold className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </Section>
      )}

      {node.data.kind === 'role' && node.data.role && (
        <Section title={t('pipeline.roles.candidates', 'Candidates')} defaultOpen>
          <div className="flex flex-wrap gap-1">
            {(node.data.role.candidate_models ?? []).slice(0, 6).map((m, idx) => {
              const modelName = candidateModelName(m);
              if (modelName === '—') return null;
              return (
                <Button
                  key={`${node.data.entityId}-${modelName}-${idx}`}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  disabled={assigningRole}
                  onClick={() => void handleAssignCandidate(modelName)}
                >
                  {modelName}
                </Button>
              );
            })}
            {(node.data.role.candidate_models ?? []).length === 0 && (
              <Text className="text-xs text-gray-400">—</Text>
            )}
          </div>
        </Section>
      )}

      {mode === 'compact' && primaryKeys.length > 0 && (
        <Section title={t('pipeline.settings.primary', 'Primary')} defaultOpen>
          {renderFields(primaryKeys)}
        </Section>
      )}

      {schemaLoading && (
        <Text className="px-3 py-2 text-xs text-gray-400">
          {t('pipeline.settings.loadingSchema', 'Loading schema…')}
        </Text>
      )}

      {sections.map((sec) => {
        const fields = filterVisibleFields(
          mode === 'compact'
            ? sec.fields.filter((f) => !primaryKeys.includes(f.key))
            : sec.fields,
          values
        );
        if (fields.length === 0) return null;
        return (
          <Section
            key={sec.id}
            title={sec.labelKey ? t(sec.labelKey, sec.label) : sec.label}
            defaultOpen={sec.defaultOpen !== false}
          >
            {fields.map((field) => (
              <FieldRenderer
                key={field.key}
                field={field}
                value={values[field.key]}
                models={models}
                catalog={logicalCatalog}
                onChange={handleFieldChange}
              />
            ))}
          </Section>
        );
      })}

      <Section title={t('pipeline.topology.board.mute', 'Mute')} defaultOpen={false}>
        <FieldRenderer
          field={{ key: 'muted', type: 'toggle', label: t('pipeline.topology.board.bypass', 'Bypass') }}
          value={values.muted}
          onChange={handleFieldChange}
        />
      </Section>

      <div className="mt-auto space-y-2 border-t border-muted p-3">
        {canApply && (
          <Button size="sm" className="w-full" onClick={handleApply}>
            {t('pipeline.topology.board.save', 'Save')}
          </Button>
        )}
        {node.data.kind !== 'group' && (
          <Button
            size="sm"
            variant="outline"
            color="danger"
            className="w-full"
            disabled={deletingRoute}
            onClick={() => void handleDeleteEntity()}
          >
            <PiTrashBold className="me-1 h-3.5 w-3.5" />
            {t('common.delete')}
          </Button>
        )}
      </div>
      <ModelDetailDrawer
        open={detailModelName != null}
        modelName={detailModelName}
        pools={pools}
        routes={pipelineData?.routes ?? []}
        bindings={pipelineData?.bindings ?? {}}
        bindingsCatalog={[]}
        onClose={() => setDetailModelName(null)}
        onSaved={() => void onRefresh()}
      />
    </>
  );
}
