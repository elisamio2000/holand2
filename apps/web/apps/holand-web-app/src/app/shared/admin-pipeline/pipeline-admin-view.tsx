// ============================================
// PipelineAdminView — Main orchestrator for Pipeline Admin
// Coordinates tabs: Overview, Model Catalog, Endpoints, Routing Topology, Simulator
// ============================================
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge, Button, Loader, Text, Title } from 'rizzui';
import {
  PiBrainBold,
  PiCloudBold,
  PiChartPieSliceBold,
  PiLightningBold,
  PiWarningCircleBold,
  PiShareNetworkBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import MetricCard from '@core/components/cards/metric-card';
import { useTranslation } from 'react-i18next';

import { pipelineAdminService } from '@/services/pipeline-admin.service';
import { adminRemoteNodesService, RemoteNodeRow } from '@/services/admin-remote-nodes.service';
import type {
  LlmModel,
  LlmEndpoint,
  LlmRoute,
  LlmRole,
  ToolRegistryEntry,
  ToolBinding,
  PipelineTabKey,
  ServiceBinding,
  LlmPool,
  BindingsCatalogEntry,
  LogicalCatalogEntry,
} from '@/types/pipeline-admin.types';

import OverviewTab from './tabs/overview-tab';
import ModelCatalogTab from './tabs/model-catalog-tab';
import EndpointsTab from './tabs/endpoints-tab';
import DecisionSimulatorTab from './tabs/decision-simulator-tab';
import RoutingTopologyTab from './tabs/routing-topology-tab';
import {
  buildPipelineUrl,
  isTopologyGraphLens,
  resolvePipelineTab,
  usePipelineTabRedirect,
} from './helpers/pipeline-tab-url';
import { countHealthyModels } from '@/utils/model-health';

const LOG_TAG = '[PipelineAdminView]';

interface TabConfig {
  key: PipelineTabKey;
  icon: React.ReactNode;
  i18nKey: string;
}

const TABS: TabConfig[] = [
  {
    key: 'overview',
    icon: <PiChartPieSliceBold className="h-4 w-4" />,
    i18nKey: 'pipeline.tabs.overview',
  },
  {
    key: 'topology',
    icon: <PiShareNetworkBold className="h-4 w-4" />,
    i18nKey: 'pipeline.tabs.topology',
  },
  {
    key: 'models',
    icon: <PiBrainBold className="h-4 w-4" />,
    i18nKey: 'pipeline.tabs.models',
  },
  {
    key: 'endpoints',
    icon: <PiCloudBold className="h-4 w-4" />,
    i18nKey: 'pipeline.tabs.endpoints',
  },
  {
    key: 'simulator',
    icon: <PiLightningBold className="h-4 w-4" />,
    i18nKey: 'pipeline.tabs.simulator',
  },
];

export default function PipelineAdminView() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  usePipelineTabRedirect();

  const tabParamRaw = searchParams.get('tab');
  const toolParam = searchParams.get('tool');

  const activeTab = useMemo(
    () => resolvePipelineTab(tabParamRaw),
    [tabParamRaw]
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [models, setModels] = useState<LlmModel[]>([]);
  const [endpoints, setEndpoints] = useState<LlmEndpoint[]>([]);
  const [routes, setRoutes] = useState<LlmRoute[]>([]);
  const [roles, setRoles] = useState<LlmRole[]>([]);
  const [tools, setTools] = useState<ToolRegistryEntry[]>([]);
  const [bindings, setBindings] = useState<Record<string, ToolBinding>>({});
  const [pluginBindings, setPluginBindings] = useState<Record<string, ToolBinding>>({});
  const [serviceBindings, setServiceBindings] = useState<ServiceBinding[]>([]);
  const [remoteNodes, setRemoteNodes] = useState<RemoteNodeRow[]>([]);
  const [pools, setPools] = useState<LlmPool[]>([]);
  const [bindingsCatalog, setBindingsCatalog] = useState<BindingsCatalogEntry[]>([]);
  const [logicalCatalog, setLogicalCatalog] = useState<LogicalCatalogEntry[]>([]);

  const loadData = useCallback(async () => {
    console.info(LOG_TAG, 'Loading all pipeline data...');
    setLoading(true);
    setError(null);
    try {
      const data = await pipelineAdminService.loadAll();
      const [plugins, services, nodes, catalog] = await Promise.all([
        pipelineAdminService.listPluginBindings().catch(() => ({})),
        pipelineAdminService.listServiceBindings().catch(() => []),
        adminRemoteNodesService.listRemoteNodes({ live: false }).catch(() => []),
        pipelineAdminService.listLogicalCatalog().catch(() => []),
      ]);
      setModels(data.models);
      setEndpoints(data.endpoints);
      setRoutes(data.routes);
      setRoles(data.roles);
      setTools(data.tools);
      setBindings(data.bindings);
      setPools(data.pools);
      setBindingsCatalog(data.bindingsCatalog);
      setPluginBindings(plugins as Record<string, ToolBinding>);
      setServiceBindings(services);
      setRemoteNodes(nodes);
      setLogicalCatalog(catalog);
      console.info(LOG_TAG, 'Pipeline data loaded successfully');
    } catch (err) {
      console.error(LOG_TAG, 'Failed to load pipeline data:', err);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (activeTab !== 'models' && activeTab !== 'overview') return;
    const id = window.setInterval(async () => {
      try {
        const health = await pipelineAdminService.fetchLlmHealth();
        setModels((prev) =>
          pipelineAdminService.mergeModelHealth(prev, health.models ?? {})
        );
      } catch {
        /* ignore poll errors */
      }
    }, 30_000);
    return () => window.clearInterval(id);
  }, [activeTab]);

  const stats = useMemo(() => {
    const healthyModels = countHealthyModels(models);
    const registryActive = models.filter((m) => m.is_active).length;
    const assignedRoles = roles.filter(
      (r) => r.is_assigned || r.current_model
    ).length;
    const boundTools = Object.values(bindings).filter((b) => b?.model).length;

    return {
      totalModels: models.length,
      healthyModels,
      registryActive,
      totalEndpoints: endpoints.length,
      totalRoutes: routes.length,
      assignedRoles,
      totalTools: tools.length,
      boundTools,
    };
  }, [models, endpoints, routes, roles, tools, bindings]);

  const isTopologyGraph = activeTab === 'topology' && isTopologyGraphLens(searchParams);

  const handleTabClick = useCallback(
    (tab: PipelineTabKey) => {
      if (tab === 'topology') {
        router.push(
          buildPipelineUrl('topology', { lens: 'graph', filter: 'all', density: 'compact' })
        );
      } else {
        router.push(buildPipelineUrl(tab));
      }
    },
    [router]
  );

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-12 text-center dark:border-red-800 dark:bg-red-950/30">
        <PiWarningCircleBold className="mx-auto h-12 w-12 text-red-500" />
        <Title as="h5" className="mt-3 text-red-600 dark:text-red-400">
          {error}
        </Title>
        <Button variant="outline" size="sm" onClick={loadData} className="mt-4">
          {t('common.refresh')}
        </Button>
      </div>
    );
  }

  const contextualMetrics = (() => {
    if (activeTab === 'models') {
      return (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <MetricCard
            title={t('pipeline.stats.totalModels')}
            metric={stats.totalModels}
            icon={<PiBrainBold className="h-6 w-6 text-primary" />}
            iconClassName="bg-primary/10"
          />
          <MetricCard
            title={t('pipeline.stats.healthyModels')}
            metric={stats.healthyModels}
            icon={<PiBrainBold className="h-6 w-6 text-green-500" />}
            iconClassName="bg-green-100 dark:bg-green-900/30"
          />
          <MetricCard
            title={t('pipeline.stats.registryActive')}
            metric={stats.registryActive}
            icon={<PiBrainBold className="h-6 w-6 text-teal-500" />}
            iconClassName="bg-teal-100 dark:bg-teal-900/30"
          />
        </div>
      );
    }
    if (activeTab === 'endpoints') {
      return (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            title={t('pipeline.stats.totalEndpoints')}
            metric={stats.totalEndpoints}
            icon={<PiCloudBold className="h-6 w-6 text-blue-500" />}
            iconClassName="bg-blue-100 dark:bg-blue-900/30"
          />
        </div>
      );
    }
    if (isTopologyGraph) {
      return (
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-600">
          <Badge variant="outline" size="sm" className="font-mono">
            {stats.totalRoutes} {t('pipeline.stats.totalRoutes', 'Routes')}
          </Badge>
          <Badge variant="outline" size="sm" className="font-mono">
            {stats.boundTools} {t('pipeline.stats.boundTools', 'Bound')}
          </Badge>
          <Badge variant="outline" size="sm" className="font-mono">
            {stats.healthyModels}/{stats.totalModels}{' '}
            {t('pipeline.stats.healthyModels', 'Healthy')}
          </Badge>
        </div>
      );
    }
    return null;
  })();

  return (
    <div className="space-y-6">
      {contextualMetrics}

      <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-muted bg-gray-0 p-1 dark:bg-gray-50">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleTabClick(tab.key)}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-medium transition-all',
              activeTab === tab.key
                ? 'bg-primary text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/50'
            )}
          >
            {tab.icon}
            <span className="hidden sm:inline">{t(tab.i18nKey)}</span>
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <OverviewTab
          models={models}
          endpoints={endpoints}
          routes={routes}
          roles={roles}
          tools={tools}
          bindings={bindings}
          bindingsCatalog={bindingsCatalog}
          remoteNodes={remoteNodes}
          pools={pools}
        />
      )}
      {activeTab === 'models' && (
        <ModelCatalogTab
          models={models}
          pools={pools}
          routes={routes}
          bindings={bindings}
          bindingsCatalog={bindingsCatalog}
          logicalCatalog={logicalCatalog}
          remoteNodes={remoteNodes}
          onRefresh={loadData}
        />
      )}
      {activeTab === 'endpoints' && (
        <EndpointsTab
          endpoints={endpoints}
          routes={routes}
          onRefresh={loadData}
          autoProbe
          wizardOpen={searchParams.get('wizard') === 'external'}
          onWizardOpenChange={(open, endpointId) => {
            if (open) {
              router.push(
                buildPipelineUrl('endpoints', {
                  wizard: 'external',
                  endpoint: endpointId ?? undefined,
                }),
                { scroll: false }
              );
              return;
            }
            if (searchParams.get('wizard')) {
              router.replace(buildPipelineUrl('endpoints'), { scroll: false });
            }
          }}
          wizardEndpointId={searchParams.get('endpoint')}
        />
      )}
      {activeTab === 'topology' && (
        <RoutingTopologyTab
          routes={routes}
          models={models}
          roles={roles}
          tools={tools}
          bindings={bindings}
          bindingsCatalog={bindingsCatalog}
          logicalCatalog={logicalCatalog}
          endpoints={endpoints}
          pluginBindings={pluginBindings}
          serviceBindings={serviceBindings}
          remoteNodes={remoteNodes}
          pools={pools}
          initialToolId={toolParam}
          onRefresh={loadData}
        />
      )}
      {activeTab === 'simulator' && (
        <DecisionSimulatorTab
          routes={routes}
          models={models}
          tools={tools}
          initialRouteKey={searchParams.get('route_key')}
        />
      )}
    </div>
  );
}
