'use client';

import { useMemo } from 'react';
import { Badge, Button, Text, Title } from 'rizzui';
import {
  PiBrainBold,
  PiCloudBold,
  PiFlowArrowBold,
  PiUsersFourBold,
  PiWrenchBold,
  PiWarningCircleBold,
} from 'react-icons/pi';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import MetricCard from '@core/components/cards/metric-card';
import type {
  BindingsCatalogEntry,
  LlmEndpoint,
  LlmModel,
  LlmPool,
  LlmRole,
  LlmRoute,
  ToolBinding,
  ToolRegistryEntry,
} from '@/types/pipeline-admin.types';
import type { RemoteNodeRow } from '@/services/admin-remote-nodes.service';
import { buildPipelineUrl } from '../helpers/pipeline-tab-url';
import { countHealthyModels, modelHealthKind } from '@/utils/model-health';
import SectionCard from '../components/section-card';

interface OverviewTabProps {
  models: LlmModel[];
  endpoints: LlmEndpoint[];
  routes: LlmRoute[];
  roles: LlmRole[];
  tools: ToolRegistryEntry[];
  bindings: Record<string, ToolBinding>;
  bindingsCatalog: BindingsCatalogEntry[];
  remoteNodes?: RemoteNodeRow[];
  pools?: LlmPool[];
}

interface IssueItem {
  id: string;
  label: string;
  count: number;
  href: string;
  severity: 'danger' | 'warning';
}

export default function OverviewTab({
  models,
  endpoints,
  routes,
  roles,
  tools,
  bindings,
  bindingsCatalog,
  remoteNodes = [],
  pools = [],
}: OverviewTabProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const stats = useMemo(() => {
    const healthyModels = countHealthyModels(models);
    const registryActive = models.filter((m) => m.is_active).length;
    const assignedRoles = roles.filter((r) => r.is_assigned || r.current_model).length;
    const boundTools = Object.values(bindings).filter((b) => b?.model).length;
    return {
      totalModels: models.length,
      healthyModels,
      registryActive,
      totalEndpoints: endpoints.length,
      totalRoutes: routes.length,
      assignedRoles,
      totalRoles: roles.length,
      boundTools,
      totalTools: tools.length,
    };
  }, [models, endpoints, routes, roles, tools, bindings]);

  const issues = useMemo(() => {
    const list: IssueItem[] = [];

    const unhealthyModels = models.filter((m) => modelHealthKind(m) === 'unhealthy').length;
    if (unhealthyModels > 0) {
      list.push({
        id: 'unhealthy-models',
        label: t('pipeline.overview.issues.unhealthyModels', '{{count}} models unhealthy', {
          count: unhealthyModels,
        }),
        count: unhealthyModels,
        href: buildPipelineUrl('models'),
        severity: 'danger',
      });
    }

    const offlineNodes = remoteNodes.filter((n) => n.online === false).length;
    if (offlineNodes > 0) {
      list.push({
        id: 'offline-nodes',
        label: t('pipeline.overview.issues.offlineNodes', '{{count}} GPU hosts offline', {
          count: offlineNodes,
        }),
        count: offlineNodes,
        href: '/admin/nodes',
        severity: 'warning',
      });
    }

    const singleReplicaPools = pools.filter((p) => (p.replicas?.length ?? 0) === 1).length;
    if (singleReplicaPools > 0) {
      list.push({
        id: 'single-replica',
        label: t(
          'pipeline.overview.issues.singleReplica',
          '{{count}} pools with only one replica',
          { count: singleReplicaPools }
        ),
        count: singleReplicaPools,
        href: buildPipelineUrl('models', { section: undefined }),
        severity: 'warning',
      });
    }

    const unboundTools = tools.filter((tool) => !bindings[tool.tool_id]?.model).length;
    if (unboundTools > 0) {
      list.push({
        id: 'unbound-tools',
        label: t('pipeline.overview.issues.unboundTools', '{{count}} tools need binding', {
          count: unboundTools,
        }),
        count: unboundTools,
        href: buildPipelineUrl('topology', { unbound: true, lens: 'graph' }),
        severity: 'warning',
      });
    }

    const missingRequiredRoles = roles.filter(
      (r) => r.required && !r.is_assigned && !r.current_model
    ).length;
    if (missingRequiredRoles > 0) {
      list.push({
        id: 'required-roles',
        label: t('pipeline.overview.issues.requiredRoles', '{{count}} required roles unassigned', {
          count: missingRequiredRoles,
        }),
        count: missingRequiredRoles,
        href: buildPipelineUrl('topology', {
          focus: 'roles',
          unassigned: true,
          required: true,
        }),
        severity: 'danger',
      });
    }

    const unboundCatalog = bindingsCatalog.filter(
      (e) => e.required && !e.bound_model && e.is_bound !== true
    ).length;
    if (unboundCatalog > 0) {
      list.push({
        id: 'catalog-slots',
        label: t('pipeline.overview.issues.catalogSlots', '{{count}} catalog slots unbound', {
          count: unboundCatalog,
        }),
        count: unboundCatalog,
        href: buildPipelineUrl('topology', {
          unbound: true,
          status: 'needsBinding',
        }),
        severity: 'warning',
      });
    }

    const unhealthyRoutes = routes.filter((route) => {
      const model = models.find((m) => m.name === route.model_name);
      return model && model.health && model.health.healthy === false;
    }).length;
    if (unhealthyRoutes > 0) {
      list.push({
        id: 'unhealthy-routes',
        label: t('pipeline.overview.issues.unhealthyRoutes', '{{count}} routes unhealthy', {
          count: unhealthyRoutes,
        }),
        count: unhealthyRoutes,
        href: buildPipelineUrl('topology', {
          focus: 'routes',
          unhealthy: true,
        }),
        severity: 'danger',
      });
    }

    return list;
  }, [bindings, bindingsCatalog, models, pools, remoteNodes, roles, routes, t, tools]);

  return (
    <div className="space-y-6">
      <SectionCard title={t('pipeline.overview.title', 'System overview')}>
        <Text className="mb-4 text-sm text-gray-500">
          {t(
            'pipeline.overview.subtitle',
            'Health summary and quick actions for pipeline configuration.'
          )}
        </Text>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
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
          <MetricCard
            title={t('pipeline.stats.totalEndpoints')}
            metric={stats.totalEndpoints}
            icon={<PiCloudBold className="h-6 w-6 text-blue-500" />}
            iconClassName="bg-blue-100 dark:bg-blue-900/30"
          />
          <MetricCard
            title={t('pipeline.stats.totalRoutes')}
            metric={stats.totalRoutes}
            icon={<PiFlowArrowBold className="h-6 w-6 text-purple-500" />}
            iconClassName="bg-purple-100 dark:bg-purple-900/30"
          />
          <MetricCard
            title={t('pipeline.stats.assignedRoles')}
            metric={`${stats.assignedRoles}/${stats.totalRoles}`}
            icon={<PiUsersFourBold className="h-6 w-6 text-amber-500" />}
            iconClassName="bg-amber-100 dark:bg-amber-900/30"
          />
          <MetricCard
            title={t('pipeline.stats.boundTools')}
            metric={`${stats.boundTools}/${stats.totalTools}`}
            icon={<PiWrenchBold className="h-6 w-6 text-teal-500" />}
            iconClassName="bg-teal-100 dark:bg-teal-900/30"
          />
        </div>
      </SectionCard>

      <SectionCard title={t('pipeline.overview.issuesTitle', 'Needs attention')}>
        {issues.length === 0 ? (
          <Text className="text-sm text-green-700 dark:text-green-400">
            {t('pipeline.overview.allHealthy', 'No blocking issues detected.')}
          </Text>
        ) : (
          <ul className="space-y-2">
            {issues.map((issue) => (
              <li
                key={issue.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-muted px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <PiWarningCircleBold
                    className={
                      issue.severity === 'danger' ? 'text-red-500' : 'text-amber-500'
                    }
                  />
                  <Text className="text-sm">{issue.label}</Text>
                  <Badge
                    variant="flat"
                    size="sm"
                    color={issue.severity === 'danger' ? 'danger' : 'warning'}
                  >
                    {issue.count}
                  </Badge>
                </div>
                <Button size="sm" variant="outline" onClick={() => router.push(issue.href)}>
                  {t('pipeline.overview.fixNow', 'Fix now')}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() =>
              router.push(buildPipelineUrl('topology', { lens: 'graph' }))
            }
          >
            {t('pipeline.overview.openGraph', 'Open topology graph')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              router.push(
                buildPipelineUrl('topology', { unbound: true, status: 'needsBinding' })
              )
            }
          >
            {t('pipeline.overview.openBindings', 'Open unbound bindings')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push(buildPipelineUrl('models'))}
          >
            {t('pipeline.overview.openModels', 'Open models hub')}
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
