// ============================================
// ModelCatalogTab — List, search, filter registered LLM models
// Shows KServe + External models with metadata, status, actions
// ============================================
'use client';

import { Tooltip } from '@/components/tooltip';
import { useCallback, useMemo, useState, Fragment } from 'react';
import { Badge, Input, Text, Button, ActionIcon, Loader, Dropdown } from 'rizzui';
import {
  PiMagnifyingGlassBold,
  PiBrainBold,
  PiTrashBold,
  PiInfoBold,
  PiArrowClockwiseBold,
  PiShareNetworkBold,
  PiDotsThreeBold,
  PiToggleLeftBold,
  PiHeartbeatBold,
  PiDesktopTowerBold,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { pipelineAdminService } from '@/services/pipeline-admin.service';
import type {
  LlmModel,
  LlmModelMeta,
  LlmPool,
  LlmRoute,
  ToolBinding,
  BindingsCatalogEntry,
  LogicalCatalogEntry,
} from '@/types/pipeline-admin.types';
import SectionCard from '../components/section-card';
import EmptyState from '../components/empty-state';
import StatusDot from '../components/status-dot';
import { modelHealthKind, statusDotColor } from '@/utils/model-health';
import {
  buildModelRunsOnMap,
  computeModelLifecycle,
  type ModelLifecycle,
} from '../helpers/model-pools';
import { buildPipelineUrl } from '../helpers/pipeline-tab-url';
import { resolveLogicalId } from '../helpers/logical-model-options';
import PoolsPanel from '../components/pools-panel';
import AddModelDrawer, { AddModelTrigger } from '../add-model-drawer/add-model-drawer';
import ModelDetailDrawer from '../components/model-detail-drawer';
import { groupModelsByLogicalId } from '../helpers/group-models-by-logical-id';
import type { RemoteNodeRow } from '@/services/admin-remote-nodes.service';

interface ModelCatalogTabProps {
  models: LlmModel[];
  pools?: LlmPool[];
  routes?: LlmRoute[];
  bindings?: Record<string, ToolBinding>;
  bindingsCatalog?: BindingsCatalogEntry[];
  logicalCatalog?: LogicalCatalogEntry[];
  remoteNodes?: RemoteNodeRow[];
  onRefresh: () => void;
}

export default function ModelCatalogTab({
  models,
  pools = [],
  routes = [],
  bindings = {},
  bindingsCatalog = [],
  remoteNodes = [],
  onRefresh,
}: ModelCatalogTabProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grouped' | 'flat' | 'pools'>('grouped');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailModelName, setDetailModelName] = useState<string | null>(null);

  const runsOnMap = useMemo(() => buildModelRunsOnMap(pools), [pools]);
  const grouped = useMemo(() => groupModelsByLogicalId(models, pools), [models, pools]);

  const filteredModels = useMemo(() => {
    if (!search.trim()) return models;
    const q = search.toLowerCase();
    return models.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        resolveLogicalId(m).toLowerCase().includes(q) ||
        m.task?.toLowerCase().includes(q) ||
        m.backend_kind?.toLowerCase().includes(q) ||
        (m.origin ?? '').toLowerCase().includes(q)
    );
  }, [models, search]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return grouped;
    const q = search.toLowerCase();
    return grouped.filter(
      (g) =>
        g.logicalId.toLowerCase().includes(q) ||
        g.replicas.some(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            (m.origin ?? '').toLowerCase().includes(q)
        )
    );
  }, [grouped, search]);

  const handleDelete = useCallback(
    async (model: LlmModel) => {
      const hasRefs = pipelineAdminService.modelHasReferences(model.name, {
        routes,
        bindings,
        bindingsCatalog,
      });
      if (hasRefs) {
        toast.error(t('pipeline.models.deleteBlocked', 'Model is referenced by routes or bindings'));
        return;
      }
      if (!confirm(t('pipeline.models.deleteConfirm'))) return;
      setDeleting(model.name);
      try {
        await pipelineAdminService.deleteModel(model.name);
        toast.success(`${model.name} ${t('common.delete')} ✓`);
        onRefresh();
      } catch {
        toast.error(t('common.error'));
      } finally {
        setDeleting(null);
      }
    },
    [onRefresh, t, routes, bindings, bindingsCatalog]
  );

  const handleToggleActive = useCallback(
    async (model: LlmModel) => {
      setToggling(model.name);
      try {
        await pipelineAdminService.updateModel(model.name, {
          is_active: !model.is_active,
        });
        toast.success(t('common.saved', 'Saved'));
        onRefresh();
      } catch {
        toast.error(t('common.error'));
      } finally {
        setToggling(null);
      }
    },
    [onRefresh, t]
  );

  const handleProbe = useCallback(async () => {
    try {
      const health = await pipelineAdminService.fetchLlmHealth();
      onRefresh();
      toast.success(t('pipeline.models.probeDone'));
    } catch {
      toast.error(t('common.error'));
    }
  }, [onRefresh, t]);

  const showInTopology = (model: LlmModel) => {
    const logicalId = resolveLogicalId(model);
    router.push(
      buildPipelineUrl('topology', { view: 'board', focus: `model:${logicalId}` })
    );
  };

  const openOnNode = (nodeId: string) => {
    router.push(`/admin/nodes?node=${encodeURIComponent(nodeId)}`);
  };

  const parseMeta = (model: LlmModel): LlmModelMeta | null => {
    return pipelineAdminService.parseModelMeta(model);
  };

  return (
    <SectionCard
      title={t('pipeline.models.title')}
      icon={<PiBrainBold className="h-5 w-5 text-primary" />}
      badge={
        <Badge variant="flat" size="sm" className="ms-2">
          {models.length}
        </Badge>
      }
      headerActions={
        <div className="flex items-center gap-2">
          <AddModelTrigger onClick={() => setDrawerOpen(true)} />
          <div className="flex rounded-md border border-muted p-0.5">
            <Button
              size="sm"
              variant={viewMode === 'grouped' ? 'solid' : 'text'}
              onClick={() => setViewMode('grouped')}
              className="text-xs"
            >
              {t('pipeline.models.viewGrouped', 'Grouped')}
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'flat' ? 'solid' : 'text'}
              onClick={() => setViewMode('flat')}
              className="text-xs"
            >
              {t('pipeline.models.viewTable', 'Table')}
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'pools' ? 'solid' : 'text'}
              onClick={() => setViewMode('pools')}
              className="text-xs"
            >
              {t('pipeline.models.viewPools', 'Pools')}
            </Button>
          </div>
          <div className="relative">
            <PiMagnifyingGlassBold className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              size="sm"
              placeholder={t('pipeline.models.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 ps-9 lg:w-64"
              inputClassName="ps-9"
            />
          </div>
          <Tooltip content={t('common.refresh')}>
            <ActionIcon variant="outline" size="sm" onClick={onRefresh}>
              <PiArrowClockwiseBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
        </div>
      }
      bodyClassName="p-0"
    >
      {viewMode === 'pools' ? (
        <div className="p-4">
          <PoolsPanel pools={pools} models={models} />
        </div>
      ) : viewMode === 'grouped' ? (
        filteredGroups.length === 0 ? (
          <EmptyState
            icon={<PiBrainBold className="h-full w-full" />}
            message={search ? t('common.noResults') : t('pipeline.models.noModels')}
          />
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-100">
                  <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                    {t('pipeline.models.logicalId', 'Logical ID')}
                  </th>
                  <th className="hidden px-4 py-3 text-center font-medium text-gray-600 sm:table-cell">
                    {t('pipeline.models.replicas', 'Replicas')}
                  </th>
                  <th className="hidden px-4 py-3 text-start font-medium text-gray-600 md:table-cell">
                    {t('pipeline.models.origin', 'Origin')}
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">
                    {t('pipeline.models.health')}
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">
                    {t('pipeline.models.registry', 'Registry')}
                  </th>
                  <th className="px-4 py-3 text-end font-medium text-gray-600">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted">
                {filteredGroups.map((group) => {
                  const isExpanded = expandedGroup === group.logicalId;
                  const healthColor =
                    group.healthSummary === 'healthy'
                      ? 'success'
                      : group.healthSummary === 'unhealthy'
                        ? 'danger'
                        : group.healthSummary === 'mixed'
                          ? 'warning'
                          : 'secondary';
                  return (
                    <Fragment key={group.logicalId}>
                      <tr
                        className="cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-100/30"
                        onClick={() =>
                          setExpandedGroup(isExpanded ? null : group.logicalId)
                        }
                      >
                        <td className="px-4 py-3 font-medium">{group.logicalId}</td>
                        <td className="hidden px-4 py-3 text-center sm:table-cell">
                          <Badge variant="flat" size="sm">
                            {group.poolReplicaCount}
                          </Badge>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {group.origins.map((o) => (
                              <Badge key={o} variant="outline" size="sm">
                                {o}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="flat" size="sm" color={healthColor}>
                            {group.healthSummary}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            variant="flat"
                            size="sm"
                            color={group.anyActive ? 'success' : 'secondary'}
                          >
                            {group.anyActive
                              ? t('pipeline.models.active', 'Active')
                              : t('pipeline.models.inactive', 'Inactive')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(
                                buildPipelineUrl('topology', {
                                  lens: 'graph',
                                  focus: `model:${group.logicalId}`,
                                })
                              );
                            }}
                          >
                            {t('pipeline.models.showTopology', 'Board')}
                          </Button>
                        </td>
                      </tr>
                      {isExpanded &&
                        group.replicas.map((model) => {
                          const kind = modelHealthKind(model);
                          return (
                            <tr
                              key={model.name}
                              className="bg-gray-50/40 dark:bg-gray-100/10"
                            >
                              <td className="px-8 py-2">
                                <div className="flex items-center gap-2">
                                  <StatusDot color={statusDotColor(kind)} size="sm" />
                                  <Text className="font-mono text-xs">{model.name}</Text>
                                </div>
                              </td>
                              <td className="hidden px-4 py-2 sm:table-cell" />
                              <td className="hidden px-4 py-2 md:table-cell">
                                {model.origin && (
                                  <Badge variant="outline" size="sm">
                                    {model.origin}
                                  </Badge>
                                )}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <Badge
                                  variant="flat"
                                  size="sm"
                                  color={
                                    kind === 'healthy'
                                      ? 'success'
                                      : kind === 'unhealthy'
                                        ? 'danger'
                                        : 'secondary'
                                  }
                                >
                                  {t(`pipeline.models.health_${kind}`)}
                                </Badge>
                                {model.health?.latency_ms != null && (
                                  <Text className="text-[10px] text-gray-400">
                                    {model.health.latency_ms}ms
                                  </Text>
                                )}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <Badge
                                  variant="flat"
                                  size="sm"
                                  color={model.is_active ? 'success' : 'secondary'}
                                >
                                  {model.is_active
                                    ? t('pipeline.models.active', 'Active')
                                    : t('pipeline.models.inactive', 'Inactive')}
                                </Badge>
                              </td>
                              <td className="px-4 py-2 text-end">
                                <div className="flex flex-wrap items-center justify-end gap-1">
                                  {model.node_id && (
                                    <Link href={`/admin/nodes?node=${encodeURIComponent(model.node_id)}`}>
                                      <Badge variant="outline" size="sm" className="cursor-pointer">
                                        {model.node_id}
                                      </Badge>
                                    </Link>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="text"
                                    className="text-xs"
                                    onClick={() => setDetailModelName(model.name)}
                                  >
                                    {t('pipeline.models.editModel', 'Edit')}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : filteredModels.length === 0 ? (
        <EmptyState
          icon={<PiBrainBold className="h-full w-full" />}
          message={
            search
              ? t('common.noResults')
              : t('pipeline.models.noModels')
          }
        />
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-100">
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {t('pipeline.models.name')}
                </th>
                <th className="hidden px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400 sm:table-cell">
                  {t('pipeline.models.capability', 'Capability')}
                </th>
                <th className="hidden px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400 md:table-cell">
                  {t('pipeline.models.runsOn', 'Runs on')}
                </th>
                <th className="hidden px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400 lg:table-cell">
                  {t('pipeline.models.endpoint', 'Endpoint')}
                </th>
                <th className="hidden px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400 xl:table-cell">
                  {t('pipeline.models.node', 'Node')}
                </th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">
                  {t('pipeline.models.health')}
                </th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">
                  {t('pipeline.models.registry', 'Registry')}
                </th>
                <th className="hidden px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400 md:table-cell">
                  {t('pipeline.models.lifecycle', 'Lifecycle')}
                </th>
                <th className="px-4 py-3 text-end font-medium text-gray-600 dark:text-gray-400">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted">
              {filteredModels.map((model) => {
                const meta = parseMeta(model);
                const isExpanded = expandedId === model.name;
                const runsOn =
                  runsOnMap.get(model.name) ??
                  runsOnMap.get(resolveLogicalId(model)) ??
                  [];
                const lifecycle = computeModelLifecycle(model, pools, runsOnMap);
                return (
                  <ModelRow
                    key={model.name}
                    model={model}
                    meta={meta}
                    runsOn={runsOn}
                    lifecycle={lifecycle}
                    isExpanded={isExpanded}
                    isDeleting={deleting === model.name}
                    isToggling={toggling === model.name}
                    onToggleExpand={() =>
                      setExpandedId(isExpanded ? null : model.name)
                    }
                    onDelete={() => handleDelete(model)}
                    onToggleActive={() => handleToggleActive(model)}
                    onShowTopology={() => showInTopology(model)}
                    onOpenOnNode={
                      runsOn[0] ? () => openOnNode(runsOn[0]) : undefined
                    }
                    onProbe={handleProbe}
                    onEdit={() => setDetailModelName(model.name)}
                    t={t as (key: string, fallback?: string) => string}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <AddModelDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onComplete={() => {
          setDrawerOpen(false);
          onRefresh();
        }}
        remoteNodes={remoteNodes}
      />
      <ModelDetailDrawer
        open={detailModelName != null}
        modelName={detailModelName}
        pools={pools}
        routes={routes}
        bindings={bindings}
        bindingsCatalog={bindingsCatalog}
        onClose={() => setDetailModelName(null)}
        onSaved={onRefresh}
      />
    </SectionCard>
  );
}

// ==========================================
// Model Row Sub-Component
// ==========================================

interface ModelRowProps {
  model: LlmModel;
  meta: LlmModelMeta | null;
  runsOn: string[];
  lifecycle: ModelLifecycle;
  isExpanded: boolean;
  isDeleting: boolean;
  isToggling: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onShowTopology: () => void;
  onOpenOnNode?: () => void;
  onProbe: () => void;
  onEdit: () => void;
  t: (key: string, fallback?: string) => string;
}

function ModelRow({
  model,
  meta,
  runsOn,
  lifecycle,
  isExpanded,
  isDeleting,
  isToggling,
  onToggleExpand,
  onDelete,
  onToggleActive,
  onShowTopology,
  onOpenOnNode,
  onProbe,
  onEdit,
  t,
}: ModelRowProps) {
  const kind = modelHealthKind(model);
  const dotColor = statusDotColor(kind);

  const lifecycleColor =
    lifecycle === 'deployed' ? 'success' : lifecycle === 'active' ? 'info' : 'secondary';

  return (
    <>
      <tr
        className="cursor-pointer transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-100/30"
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('button, a, [role="menuitem"], [data-no-row-click]')) return;
          onEdit();
        }}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <StatusDot color={dotColor} pulse={kind === 'healthy'} size="sm" />
            <div>
              <Text className="font-medium">{resolveLogicalId(model)}</Text>
              <Text className="font-mono text-xs text-gray-400">{model.name}</Text>
              {model.origin && (
                <Badge variant="outline" size="sm" className="mt-1">
                  {model.origin}
                </Badge>
              )}
            </div>
          </div>
        </td>
        <td className="hidden px-4 py-3 sm:table-cell">
          <Tooltip content={t('pipeline.models.capabilityHint', 'Inference capability type')}>
            <Badge variant="outline" size="sm">
              {model.task || '—'}
            </Badge>
          </Tooltip>
        </td>
        <td className="hidden px-4 py-3 md:table-cell">
          <div className="flex flex-wrap gap-1">
            {runsOn.length ? (
              runsOn.map((node) => (
                <Badge key={node} variant="flat" size="sm">
                  {node}
                </Badge>
              ))
            ) : (
              <Text className="text-xs text-gray-400">—</Text>
            )}
            {lifecycle === 'deployed' && (
              <Badge variant="flat" size="sm" color="success">
                {t('pipeline.models.deployed', 'Deployed')}
              </Badge>
            )}
          </div>
        </td>
        <td className="hidden px-4 py-3 lg:table-cell">
          <Text className="text-xs text-gray-500">
            {model.endpoint_name ?? meta?.endpoint_name ?? '—'}
          </Text>
          {model.upstream_model && (
            <Text className="text-[10px] text-gray-400">
              ↑ {model.upstream_model}
            </Text>
          )}
        </td>
        <td className="hidden px-4 py-3 xl:table-cell">
          {model.node_id ? (
            <Link href={`/admin/nodes?node=${encodeURIComponent(model.node_id)}`}>
              <Badge variant="outline" size="sm" className="cursor-pointer">
                {model.node_id}
              </Badge>
            </Link>
          ) : (
            <Text className="text-xs text-gray-400">—</Text>
          )}
          {model.control_plane && (
            <Badge variant="flat" size="sm" className="mt-1">
              {String(model.control_plane)}
            </Badge>
          )}
        </td>
        <td className="px-4 py-3 text-center">
          <Tooltip
            content={
              model.health?.last_error ??
              (model.health?.latency_ms != null
                ? `${model.health.latency_ms}ms`
                : '')
            }
          >
            <Badge
              variant="flat"
              size="sm"
              color={
                kind === 'healthy'
                  ? 'success'
                  : kind === 'unhealthy'
                    ? 'danger'
                    : 'secondary'
              }
            >
              {t(`pipeline.models.health_${kind}`)}
            </Badge>
          </Tooltip>
          {model.health?.latency_ms != null && (
            <Text className="text-[10px] text-gray-400">{model.health.latency_ms}ms</Text>
          )}
        </td>
        <td className="px-4 py-3 text-center">
          <Badge
            variant="flat"
            size="sm"
            color={model.is_active ? 'success' : 'secondary'}
          >
            {model.is_active
              ? t('pipeline.models.active', 'Active')
              : t('pipeline.models.inactive', 'Inactive')}
          </Badge>
        </td>
        <td className="hidden px-4 py-3 text-center md:table-cell">
          <Badge variant="flat" size="sm" color={lifecycleColor}>
            {t(`pipeline.models.lifecycle_${lifecycle}`, lifecycle)}
          </Badge>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            <Tooltip content={t('pipeline.models.metadata')}>
              <ActionIcon
                variant="text"
                size="sm"
                onClick={onToggleExpand}
                className={cn(isExpanded && 'text-primary')}
              >
                <PiInfoBold className="h-4 w-4" />
              </ActionIcon>
            </Tooltip>
            <Dropdown>
              <Dropdown.Trigger>
                <ActionIcon variant="text" size="sm">
                  <PiDotsThreeBold className="h-4 w-4" />
                </ActionIcon>
              </Dropdown.Trigger>
              <Dropdown.Menu>
                <Dropdown.Item onClick={onEdit}>
                  <PiInfoBold className="me-2 h-4 w-4" />
                  {t('pipeline.models.editModel', 'Edit model')}
                </Dropdown.Item>
                <Dropdown.Item onClick={onToggleActive} disabled={isToggling}>
                  <PiToggleLeftBold className="me-2 h-4 w-4" />
                  {model.is_active
                    ? t('pipeline.models.deactivate', 'Deactivate')
                    : t('pipeline.models.activate', 'Activate')}
                </Dropdown.Item>
                <Dropdown.Item onClick={onShowTopology}>
                  <PiShareNetworkBold className="me-2 h-4 w-4" />
                  {t('pipeline.models.showTopology', 'Show in Topology')}
                </Dropdown.Item>
                {onOpenOnNode && (
                  <Dropdown.Item onClick={onOpenOnNode}>
                    <PiDesktopTowerBold className="me-2 h-4 w-4" />
                    {t('pipeline.models.openOnNode', 'Open on Node')}
                  </Dropdown.Item>
                )}
                <Dropdown.Item onClick={onProbe}>
                  <PiHeartbeatBold className="me-2 h-4 w-4" />
                  {t('pipeline.models.probe', 'Probe health')}
                </Dropdown.Item>
                <Dropdown.Item onClick={onDelete} disabled={isDeleting} className="text-red-600">
                  <PiTrashBold className="me-2 h-4 w-4" />
                  {t('pipeline.models.deleteModel')}
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-gray-50/30 dark:bg-gray-100/10">
          <td colSpan={9} className="px-6 py-3">
            <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <MetaItem
                label={t('pipeline.models.logicalId', 'Logical ID')}
                value={resolveLogicalId(model)}
              />
              <MetaItem
                label={t('pipeline.models.physicalName', 'Physical name')}
                value={model.name}
              />
              {model.upstream_model && (
                <MetaItem
                  label={t('pipeline.models.upstreamModel', 'Upstream model')}
                  value={model.upstream_model}
                />
              )}
              {model.control_plane && (
                <MetaItem
                  label={t('pipeline.models.controlPlane', 'Control plane')}
                  value={String(model.control_plane)}
                />
              )}
              {model.origin && (
                <MetaItem label={t('pipeline.models.origin', 'Origin')} value={model.origin} />
              )}
              {meta?.api && (
                <MetaItem label={t('pipeline.models.api')} value={meta.api} />
              )}
              {meta?.pipeline_tag && (
                <MetaItem
                  label={t('pipeline.models.pipelineTag')}
                  value={meta.pipeline_tag}
                />
              )}
              {meta?.modalities && meta.modalities.length > 0 && (
                <MetaItem
                  label={t('pipeline.models.modalities')}
                  value={meta.modalities.join(', ')}
                />
              )}
              {meta?.endpoint_name && (
                <MetaItem
                  label={t('pipeline.models.endpoint')}
                  value={`${meta.endpoint_name} (${meta.host}:${meta.port})`}
                />
              )}
              {meta?.endpoint_id && !meta?.endpoint_name && (
                <MetaItem
                  label={t('pipeline.models.endpoint')}
                  value={meta.endpoint_id}
                />
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text className="text-gray-400">{label}</Text>
      <Text className="font-medium text-gray-700 dark:text-gray-300">
        {value}
      </Text>
    </div>
  );
}
