'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  LlmEndpoint,
  LlmModel,
  LlmRole,
  LlmRoute,
  ToolBinding,
  ToolRegistryEntry,
  ServiceBinding,
  BindingsCatalogEntry,
  LogicalCatalogEntry,
} from '@/types/pipeline-admin.types';
import type { RemoteNodeRow } from '@/services/admin-remote-nodes.service';
import TopologyBoardView from '../topology-board/topology-board-view';
import type { TopologyPipelineData } from '../topology-board/helpers/topology-board-types';
import { useTopologyBoardStore } from '../topology-board/store/topology-board-store';

interface RoutingTopologyTabProps {
  routes: LlmRoute[];
  models: LlmModel[];
  roles: LlmRole[];
  tools: ToolRegistryEntry[];
  bindings: Record<string, ToolBinding>;
  bindingsCatalog: BindingsCatalogEntry[];
  logicalCatalog?: LogicalCatalogEntry[];
  endpoints: LlmEndpoint[];
  pluginBindings: Record<string, ToolBinding>;
  serviceBindings: ServiceBinding[];
  remoteNodes: RemoteNodeRow[];
  pools?: import('@/types/pipeline-admin.types').LlmPool[];
  initialToolId?: string | null;
  onRefresh: () => Promise<void>;
}

export default function RoutingTopologyTab({
  routes,
  models,
  roles,
  tools,
  bindings,
  bindingsCatalog,
  logicalCatalog = [],
  endpoints,
  pluginBindings,
  serviceBindings,
  remoteNodes,
  pools = [],
  onRefresh,
}: RoutingTopologyTabProps) {
  const { t } = useTranslation();

  const pipelineData: TopologyPipelineData = useMemo(
    () => ({
      models,
      endpoints,
      routes,
      roles,
      tools,
      bindings,
      pluginBindings,
      serviceBindings,
      remoteNodes,
      logicalCatalog,
      pools,
    }),
    [
      models,
      endpoints,
      routes,
      roles,
      tools,
      bindings,
      pluginBindings,
      serviceBindings,
      remoteNodes,
      logicalCatalog,
      pools,
    ]
  );

  const hydratedDataRef = useRef<TopologyPipelineData | null>(null);

  useEffect(() => {
    useTopologyBoardStore.setState({ pipelineData });
    if (hydratedDataRef.current !== pipelineData) {
      useTopologyBoardStore.getState().hydrate(pipelineData);
      hydratedDataRef.current = pipelineData;
    }
  }, [pipelineData]);

  return (
    <div className="overflow-hidden rounded-xl border border-muted">
      <div className="border-b border-muted bg-gray-0 px-3 py-1.5 dark:bg-gray-50">
        <span className="text-xs font-medium text-gray-600">
          {t('pipeline.topology.lens.graph', 'Topology graph')}
        </span>
      </div>
      <TopologyBoardView pipelineData={pipelineData} onRefresh={onRefresh} />
    </div>
  );
}

export { loadTopologyPipelineData } from '../topology-board/topology-board-view';
