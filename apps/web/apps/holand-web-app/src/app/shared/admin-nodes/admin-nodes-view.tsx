'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Badge,
  Button,
  Loader,
  Text,
  Title,
} from 'rizzui';
import {
  PiArrowClockwiseBold,
  PiCpuDuotone,
  PiWarningCircleBold,
} from 'react-icons/pi';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  adminRemoteNodesService,
  deployedModelAgentName,
  deployedRowActions,
  deployedModelRuntimeLabel,
  measuredModelVramLabel,
  partitionDeployedModels,
  scanRowBadge,
  type RemoteNodeRow,
  type ScannedModelRow,
  type RemoteDeployedModel,
} from '@/services/admin-remote-nodes.service';
import { routes } from '@/config/routes';
import { buildPipelineUrl } from '@/app/shared/admin-pipeline/helpers/pipeline-tab-url';
import DeployModelModal from './components/deploy-model-modal';
import DeployedModelRowMenu from './components/deployed-model-row-menu';
import EditNodeModal from './components/edit-node-modal';
import NodeHeaderMenu, { type NodeHeaderActionKind } from './components/node-header-menu';
import NodeGpuPanel from './components/node-gpu-panel';
import NodeLogsPanel from './components/node-logs-panel';
import RegisterNodeModal from './components/register-node-modal';
import BootstrapHelpPanel from './components/bootstrap-help-panel';
import { useNodeGpuStream } from './hooks/use-node-gpu-stream';

export default function AdminNodesView() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nodeFromUrl = searchParams.get('node');
  const deployFromUrl = searchParams.get('deploy') === '1';

  const [nodes, setNodes] = useState<RemoteNodeRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scan, setScan] = useState<ScannedModelRow[]>([]);
  const [runningDeployed, setRunningDeployed] = useState<RemoteDeployedModel[]>([]);
  const [stoppedDeployed, setStoppedDeployed] = useState<RemoteDeployedModel[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [deployPath, setDeployPath] = useState('');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [scanRefreshing, setScanRefreshing] = useState(false);
  const [deployedRefreshing, setDeployedRefreshing] = useState(false);
  const [logsFocusModel, setLogsFocusModel] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const initialSelectDone = useRef(false);

  const selected = nodes.find((n) => n.id === selectedId) ?? null;
  const nodeOnline = selected?.online !== false;
  const gpuStream = useNodeGpuStream(selectedId, { enabled: Boolean(selectedId) });
  const pendingCount = Array.isArray(selected?.metadata?.pending_models)
    ? selected!.metadata!.pending_models!.length
    : 0;
  const poolLogicalId =
    runningDeployed.find((d) => typeof d.logical_id === 'string' && d.logical_id)?.logical_id ??
    runningDeployed.find((d) => d.served_name)?.served_name ??
    null;

  const loadNodes = useCallback(
    async (options?: { live?: boolean; refresh?: boolean }) => {
      const isRefresh = options?.refresh === true;
      if (!mountedRef.current) {
        setInitialLoading(true);
      } else if (isRefresh) {
        setListRefreshing(true);
      }
      try {
        const list = await adminRemoteNodesService.listRemoteNodes({
          live: options?.live === true,
        });
        setNodes(list);
        if (!initialSelectDone.current) {
          initialSelectDone.current = true;
          if (nodeFromUrl && list.some((n) => n.id === nodeFromUrl)) {
            setSelectedId(nodeFromUrl);
          } else if (list.length) {
            setSelectedId((prev) =>
              prev && list.some((n) => n.id === prev) ? prev : list[0]?.id ?? null
            );
          }
        } else {
          setSelectedId((prev) => (prev && list.some((n) => n.id === prev) ? prev : list[0]?.id ?? null));
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('adminNodes.loadFailed'));
      } finally {
        mountedRef.current = true;
        setInitialLoading(false);
        setListRefreshing(false);
      }
    },
    [nodeFromUrl, t]
  );

  const loadDetail = useCallback(
    async (nodeId: string) => {
      setDetailLoading(true);
      try {
        const [scanRows, allDeployed] = await Promise.all([
          adminRemoteNodesService.scanNode(nodeId, { refresh: false }),
          adminRemoteNodesService.listAllDeployed(nodeId),
        ]);
        const { running, stopped } = partitionDeployedModels(allDeployed);
        setScan(scanRows);
        setRunningDeployed(running);
        setStoppedDeployed(stopped);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('adminNodes.detailFailed'));
      } finally {
        setDetailLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    void loadNodes({ live: false });
  }, [loadNodes]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const handleManualRefresh = () => {
    void loadNodes({ live: true, refresh: true });
    if (selectedId) void loadDetail(selectedId);
  };

  const refreshDeployedOnly = useCallback(async () => {
    if (!selectedId) return;
    setDeployedRefreshing(true);
    try {
      await loadDetail(selectedId);
    } finally {
      setDeployedRefreshing(false);
    }
  }, [selectedId, loadDetail]);

  const openDeploy = useCallback((path?: string) => {
    setDeployPath(path ?? '');
    setDeployModalOpen(true);
  }, []);

  const deployOpenedFromUrl = useRef(false);
  useEffect(() => {
    if (deployFromUrl && selectedId && !deployOpenedFromUrl.current) {
      deployOpenedFromUrl.current = true;
      openDeploy();
    }
  }, [deployFromUrl, selectedId, openDeploy]);

  const handleToggle = async (row: RemoteDeployedModel, active: boolean) => {
    if (!selectedId) return;
    const agentName = deployedModelAgentName(row);
    if (!agentName) {
      toast.error(t('adminNodes.toggleFailed'));
      return;
    }
    try {
      await adminRemoteNodesService.toggleModel(selectedId, {
        name: agentName,
        is_active: active,
        storage_path: row.storage_path,
        served_name: row.served_name ?? agentName,
      });
      toast.success(t('adminNodes.toggleSuccess'));
      await loadDetail(selectedId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('adminNodes.toggleFailed'));
    }
  };

  const refreshScan = useCallback(async () => {
    if (!selectedId || !nodeOnline) return;
    setScanRefreshing(true);
    try {
      const scanRows = await adminRemoteNodesService.scanNode(selectedId, { refresh: true });
      setScan(scanRows);
      toast.success(t('adminNodes.scanDone'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('adminNodes.scanFailed'));
    } finally {
      setScanRefreshing(false);
    }
  }, [selectedId, nodeOnline, t]);

  const handleDeployedMenuAction = async (
    row: RemoteDeployedModel,
    kind: 'stop' | 'restart' | 'remove' | 'logs' | 'probe'
  ) => {
    if (kind === 'logs') {
      setLogsFocusModel(String(row.name ?? row.served_name ?? ''));
      return;
    }
    if (kind === 'stop') {
      await handleStopModel(row);
      return;
    }
    if (kind === 'restart') {
      await handleRestartModel(row);
      return;
    }
    if (kind === 'remove') {
      await handleRemoveModel(row);
      return;
    }
    if (kind === 'probe') {
      if (!selectedId) return;
      const name = String(row.served_name ?? row.name ?? '');
      if (!name) return;
      try {
        const result = await adminRemoteNodesService.probeModel(selectedId, name);
        if (result.ok) {
          toast.success(t('adminNodes.probeOk', 'Healthy'));
        } else {
          toast.error(t('adminNodes.probeFail', 'Unhealthy'));
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('adminNodes.probeFail', 'Unhealthy'));
      }
    }
  };

  const handleStopModel = async (row: RemoteDeployedModel) => {
    await handleToggle(row, false);
  };

  const handleRestartModel = async (row: RemoteDeployedModel) => {
    await handleToggle(row, true);
  };

  const handleRemoveModel = async (row: RemoteDeployedModel) => {
    if (!selectedId || !confirm(t('adminNodes.removeModelConfirm'))) return;
    await handleToggle(row, false);
  };

  const handleDrain = async () => {
    if (!selectedId || !nodeOnline || !confirm(t('adminNodes.drainConfirm'))) return;
    try {
      await adminRemoteNodesService.drainNode(selectedId);
      toast.success(t('adminNodes.drainSuccess'));
      await loadDetail(selectedId);
      await loadNodes({ live: true, refresh: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('adminNodes.drainFailed'));
    }
  };

  const handleDeleteNode = async () => {
    if (!selectedId || !confirm(t('adminNodes.deleteConfirm'))) return;
    try {
      await adminRemoteNodesService.deleteRemoteNode(selectedId);
      toast.success(t('common.delete'));
      setSelectedId(null);
      initialSelectDone.current = false;
      await loadNodes({ live: false, refresh: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('common.error'));
    }
  };

  const handleNodeHeaderAction = (kind: NodeHeaderActionKind) => {
    if (!selected) return;
    if (kind === 'edit') {
      setEditOpen(true);
      return;
    }
    if (kind === 'deploy') {
      openDeploy();
      return;
    }
    if (kind === 'viewOnBoard') {
      router.push(
        buildPipelineUrl('topology', {
          view: 'board',
          focus: `remoteNode:${selected.id}`,
        })
      );
      return;
    }
    if (kind === 'viewPoolOnBoard' && poolLogicalId) {
      router.push(
        buildPipelineUrl('topology', {
          view: 'board',
          focus: `model:${poolLogicalId}`,
        })
      );
      return;
    }
    if (kind === 'drain') {
      void handleDrain();
      return;
    }
    if (kind === 'delete') {
      void handleDeleteNode();
    }
  };

  const renderDeployedRow = (r: RemoteDeployedModel) => {
    const isRunning =
      r.running === true ||
      String(r.container_status ?? r.status ?? '').toLowerCase() === 'running';
    const statusText = isRunning
      ? t('adminNodes.statusRunning')
      : t('adminNodes.statusDeactivated');
    const statusColor = (isRunning ? 'success' : 'secondary') as 'success' | 'secondary';
    const actions = deployedRowActions(isRunning ? 'running' : 'stopped', {
      includeProbe: isRunning,
    });
    const liveVram = measuredModelVramLabel(r, gpuStream.snapshot, isRunning);
    const runtime = deployedModelRuntimeLabel(r);

    return {
      key: `${r.name}-${r.port ?? r.served_name}`,
      name: r.served_name ?? r.name,
      sub: runtime ?? undefined,
      badge: statusText,
      badgeColor: statusColor,
      meta: liveVram ? (
        <Badge variant="flat" size="sm" color="info" className="shrink-0 text-[10px]">
          {liveVram}
        </Badge>
      ) : undefined,
      action: (
        <DeployedModelRowMenu
          actions={actions}
          disabled={!nodeOnline}
          onAction={(kind) => void handleDeployedMenuAction(r, kind)}
        />
      ),
    };
  };

  const scanStatuses = scan.map((r) => String(r.deploy_status ?? ''));

  if (initialLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="space-y-6">
        <RegisterNodeModal
          open={registerOpen}
          onClose={() => setRegisterOpen(false)}
          onRegistered={() => void loadNodes({ live: true, refresh: true })}
        />
        <div className="rounded-lg border border-dashed border-muted p-12 text-center">
          <PiCpuDuotone className="mx-auto h-12 w-12 text-gray-300" />
          <Title as="h5" className="mt-3">
            {t('adminNodes.noNodes')}
          </Title>
          <Text className="mt-2 text-sm text-gray-500">{t('adminNodes.noNodesHint')}</Text>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button size="sm" onClick={() => setRegisterOpen(true)}>
              {t('adminNodes.register')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => void loadNodes({ live: true, refresh: true })}>
              {t('common.refresh')}
            </Button>
          </div>
        </div>
        <BootstrapHelpPanel />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <RegisterNodeModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onRegistered={() => void loadNodes({ live: true, refresh: true })}
      />
      <EditNodeModal
        open={editOpen}
        node={selected}
        onClose={() => setEditOpen(false)}
        onSaved={(saved) => {
          setNodes((prev) =>
            prev.map((n) =>
              n.id === saved.id ? { ...saved, online: n.online } : n
            )
          );
        }}
      />
      {selectedId && (
        <DeployModelModal
          open={deployModalOpen}
          nodeId={selectedId}
          initialPath={deployPath}
          onClose={() => setDeployModalOpen(false)}
          onDeployed={() => {
            setDeployModalOpen(false);
            if (selectedId) void loadDetail(selectedId);
            void loadNodes({ live: true, refresh: true });
          }}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Title className="text-lg">{t('adminNodes.title')}</Title>
          <Text className="text-sm text-gray-500">{t('adminNodes.subtitle')}</Text>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setRegisterOpen(true)}>
            {t('adminNodes.register')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleManualRefresh} disabled={listRefreshing}>
            {listRefreshing ? (
              <Loader size="sm" className="me-1" />
            ) : (
              <PiArrowClockwiseBold className="me-1 h-4 w-4" />
            )}
            {t('common.refresh')}
          </Button>
          <Link href={routes.admin.pipeline}>
            <Button variant="outline" size="sm">
              {t('adminNodes.openRegistry')}
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-1">
          {nodes.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => setSelectedId(node.id)}
              className={`w-full rounded-xl border p-4 text-start transition-colors ${
                selectedId === node.id
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:bg-gray-50 dark:hover:bg-gray-100/40'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <Text className="font-semibold">{node.display_name ?? node.id}</Text>
                <Badge size="sm" color={node.online ? 'success' : 'danger'} variant="flat">
                  {node.online ? t('adminNodes.online') : t('adminNodes.offline')}
                </Badge>
              </div>
              <Text className="mt-1 font-mono text-xs text-gray-400">{node.agent_url ?? '—'}</Text>
              <Text className="mt-2 text-xs text-gray-500">
                {adminRemoteNodesService.gpuSummaryFromNode(node)}
              </Text>
            </button>
          ))}
        </div>

        <div className="space-y-4 lg:col-span-2">
          {selected && (
            <>
              <div className="flex items-start justify-between gap-3 rounded-xl border border-muted p-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Text className="font-semibold">{selected.display_name ?? selected.id}</Text>
                    {pendingCount > 0 && (
                      <Badge size="sm" color="warning" variant="flat">
                        {t('adminNodes.pendingModels', { count: pendingCount })}
                      </Badge>
                    )}
                  </div>
                  <Text className="text-xs text-gray-500">
                    {t('adminNodes.modelsCount', {
                      count: selected.metadata?.models_count ?? scan.length,
                    })}
                  </Text>
                </div>
                <NodeHeaderMenu
                  showPoolOnBoard={Boolean(poolLogicalId)}
                  nodeOnline={nodeOnline}
                  onAction={handleNodeHeaderAction}
                />
              </div>

              <div className="rounded-xl border border-muted p-4 text-xs text-gray-600">
                <Text className="font-semibold">{t('adminNodes.nodeMetadata')}</Text>
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  <Text>
                    <span className="text-gray-400">ID:</span> {selected.id}
                  </Text>
                  <Text>
                    <span className="text-gray-400">models_root:</span>{' '}
                    {String(selected.metadata?.models_root ?? selected.models_root ?? '—')}
                  </Text>
                  <Text>
                    <span className="text-gray-400">has_gpu:</span>{' '}
                    {String(selected.has_gpu ?? selected.metadata?.has_gpu ?? '—')}
                  </Text>
                  <Text>
                    <span className="text-gray-400">last_seen:</span>{' '}
                    {String(selected.metadata?.last_seen ?? '—')}
                  </Text>
                  {Array.isArray(selected.metadata?.capabilities) &&
                    selected.metadata!.capabilities!.length > 0 && (
                      <Text className="sm:col-span-2">
                        <span className="text-gray-400">capabilities:</span>{' '}
                        {selected.metadata!.capabilities!.join(', ')}
                      </Text>
                    )}
                </div>
              </div>

              <div className="rounded-xl border border-muted p-4">
                <NodeGpuPanel nodeId={selected.id} stream={gpuStream} />
              </div>

              {detailLoading ? (
                <div className="flex min-h-[200px] items-center justify-center">
                  <Loader />
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <NodeModelTable
                    title={t('adminNodes.available')}
                    headerAction={
                      <Button
                        size="sm"
                        variant="text"
                        onClick={() => void refreshScan()}
                        disabled={scanRefreshing || !nodeOnline}
                      >
                        {scanRefreshing ? (
                          <Loader size="sm" />
                        ) : (
                          t('adminNodes.rescan')
                        )}
                      </Button>
                    }
                    rows={scan.map((r) => ({
                      key: r.storage_path,
                      name: r.name,
                      sub: r.suggested_runtime ?? r.suggested_task,
                      badge: scanRowBadge(r.deploy_status, scanStatuses),
                      action: (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDeploy(r.storage_path)}
                          disabled={!nodeOnline}
                        >
                          {t('adminNodes.deploy')}
                        </Button>
                      ),
                    }))}
                  />
                  <NodeModelTable
                    title={t('adminNodes.onGpu')}
                    headerAction={
                      <Button
                        size="sm"
                        variant="text"
                        onClick={() => void refreshDeployedOnly()}
                        disabled={deployedRefreshing}
                      >
                        {deployedRefreshing ? <Loader size="sm" /> : t('adminNodes.refreshDeployed')}
                      </Button>
                    }
                    rows={runningDeployed.map((r) => renderDeployedRow(r))}
                  />
                </div>
              )}

              {!detailLoading && stoppedDeployed.length > 0 && (
                <NodeModelTable
                  title={t('adminNodes.stoppedSection', {
                    count: stoppedDeployed.length,
                    defaultValue: `Stopped / previously deployed (${stoppedDeployed.length})`,
                  })}
                  rows={stoppedDeployed.map((r) => renderDeployedRow(r))}
                />
              )}

              <NodeLogsPanel
                nodeId={selected.id}
                focusModel={logsFocusModel}
                onFocusModelHandled={() => setLogsFocusModel(null)}
              />

              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <PiWarningCircleBold className="mt-0.5 h-4 w-4 shrink-0" />
                <Text>{t('adminNodes.gpuDisclaimer')}</Text>
              </div>
              <BootstrapHelpPanel />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NodeModelTable({
  title,
  rows,
  headerAction,
}: {
  title: string;
  headerAction?: React.ReactNode;
  rows: Array<{
    key: string;
    name: string;
    sub?: string;
    badge?: string;
    badgeColor?: 'success' | 'warning' | 'secondary' | 'danger' | 'info';
    meta?: React.ReactNode;
    action: React.ReactNode;
  }>;
}) {
  return (
    <div className="rounded-xl border border-muted">
      {title ? (
        <div className="flex items-center justify-between gap-2 border-b border-muted px-4 py-3">
          <Text className="font-medium">{title}</Text>
          {headerAction}
        </div>
      ) : null}
      <div className="max-h-[320px] overflow-y-auto">
        {rows.length === 0 ? (
          <Text className="p-4 text-sm text-gray-400">—</Text>
        ) : (
          rows.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between gap-2 border-b border-muted px-4 py-2 last:border-0"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Text className="truncate text-sm font-medium">{row.name}</Text>
                  {row.badge && (
                    <Badge
                      variant="flat"
                      size="sm"
                      color={row.badgeColor ?? 'secondary'}
                      className="shrink-0 text-[10px]"
                    >
                      {row.badge}
                    </Badge>
                  )}
                  {row.meta}
                </div>
                {row.sub && (
                  <Text className="truncate text-xs capitalize text-gray-400">{row.sub}</Text>
                )}
              </div>
              {row.action}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
