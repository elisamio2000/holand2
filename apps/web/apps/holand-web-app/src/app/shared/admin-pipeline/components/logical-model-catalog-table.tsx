'use client';

import { Tooltip } from '@/components/tooltip';
import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, ActionIcon, Loader, Text } from 'rizzui';
import {
  PiTrashBold,
  PiPencilSimpleBold,
  PiShareNetworkBold,
  PiDesktopTowerBold,
  PiCloudBold,
  PiBrainBold,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { pipelineAdminService } from '@/services/pipeline-admin.service';
import type {
  BindingsCatalogEntry,
  LlmModel,
  LlmPool,
  LlmRoute,
  ToolBinding,
} from '@/types/pipeline-admin.types';
import {
  buildLogicalCatalogRows,
  replicaIsDeployed,
  replicaIsHealthy,
  replicaNodeReachable,
  type LogicalCatalogRow,
  type LogicalReplicaRow,
} from '../helpers/build-logical-catalog-rows';
import { buildPipelineUrl } from '../helpers/pipeline-tab-url';
import EmptyState from './empty-state';
import StatusDot from './status-dot';

interface LogicalModelCatalogTableProps {
  models: LlmModel[];
  pools: LlmPool[];
  routes: LlmRoute[];
  bindings: Record<string, ToolBinding>;
  bindingsCatalog: BindingsCatalogEntry[];
  onRefresh: () => void;
  onEditReplica: (physicalName: string) => void;
  search: string;
}

function CatalogBoolCell({ value, health }: { value: boolean; health?: boolean }) {
  const color = value ? 'green' : health ? 'red' : 'gray';
  return (
    <span className="inline-flex justify-center">
      <StatusDot
        color={color}
        size="sm"
        pulse={health && value}
        ariaLabel={value ? 'yes' : 'no'}
      />
    </span>
  );
}

function ReplicaDetailTable({
  row,
  onEdit,
  onDelete,
  deleting,
  t,
}: {
  row: LogicalCatalogRow;
  onEdit: (name: string) => void;
  onDelete: (name: string) => void;
  deleting: string | null;
  t: (key: string, fallback?: string) => string;
}) {
  const router = useRouter();

  if (row.replicas.length === 0) {
    return (
      <Text className="text-xs text-gray-500">
        {t('pipeline.models.noReplicas', 'No registry replicas for this logical id')}
      </Text>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-auto rounded-md border border-muted">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-100">
              <th className="px-3 py-2 text-start">
                {t('pipeline.models.colProvider', 'Provider')}
              </th>
              <th className="px-3 py-2 text-center">
                {t('pipeline.models.colReachable', 'Reachable')}
              </th>
              <th className="px-3 py-2 text-center">
                {t('pipeline.models.colDeployedOnNode', 'Deployed')}
              </th>
              <th className="px-3 py-2 text-center">
                {t('pipeline.models.colHealthyOnNode', 'Healthy')}
              </th>
              <th className="px-3 py-2 text-start">
                {t('pipeline.models.physicalName', 'Physical name')}
              </th>
              <th className="px-3 py-2 text-end">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-muted">
            {row.replicas.map((rep) => (
              <ReplicaRow
                key={rep.physicalName}
                rep={rep}
                logicalId={row.logicalId}
                deleting={deleting}
                onEdit={onEdit}
                onDelete={onDelete}
                t={t}
                router={router}
              />
            ))}
          </tbody>
        </table>
      </div>

      {row.bindings.length > 0 && (
        <div>
          <Text className="mb-2 text-xs font-semibold uppercase text-gray-500">
            {t('pipeline.models.bindings', 'Bindings')}
          </Text>
          <ul className="space-y-1 text-xs">
            {row.bindings.map((b) => (
              <li key={b.route_key ?? b.slot_id ?? b.tool_id} className="flex gap-2">
                <Badge variant="outline" size="sm">
                  {b.kind ?? b.consumer_type ?? 'slot'}
                </Badge>
                <span className="font-mono text-gray-600">{b.route_key}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ReplicaRow({
  rep,
  logicalId,
  deleting,
  onEdit,
  onDelete,
  t,
  router,
}: {
  rep: LogicalReplicaRow;
  logicalId: string;
  deleting: string | null;
  onEdit: (name: string) => void;
  onDelete: (name: string) => void;
  t: (key: string, fallback?: string) => string;
  router: ReturnType<typeof useRouter>;
}) {
  const reachable = replicaNodeReachable(rep);
  const deployed = replicaIsDeployed(rep);
  const healthy = replicaIsHealthy(rep);

  return (
    <tr>
      <td className="px-3 py-2">
        {rep.providerKind === 'endpoint' ? (
          <Link href={buildPipelineUrl('endpoints')}>
            <Badge variant="outline" size="sm" className="cursor-pointer gap-1">
              <PiCloudBold className="h-3 w-3" />
              {rep.nodeLabel}
            </Badge>
          </Link>
        ) : rep.nodeId ? (
          <Link href={`/admin/nodes?node=${encodeURIComponent(rep.nodeId)}`}>
            <Badge variant="outline" size="sm" className="cursor-pointer">
              {rep.nodeLabel}
            </Badge>
          </Link>
        ) : (
          <span className="text-gray-600">{rep.nodeLabel}</span>
        )}
      </td>
      <td className="px-3 py-2 text-center">
        <CatalogBoolCell value={reachable} />
      </td>
      <td className="px-3 py-2 text-center">
        <CatalogBoolCell value={deployed} />
      </td>
      <td className="px-3 py-2 text-center">
        <CatalogBoolCell value={healthy} health />
      </td>
      <td className="px-3 py-2 font-mono text-[11px] text-gray-500">{rep.physicalName}</td>
      <td className="px-3 py-2">
        <div className="flex justify-end gap-1">
          <Tooltip content={t('pipeline.models.editModel', 'Edit')}>
            <ActionIcon size="sm" variant="text" onClick={() => onEdit(rep.physicalName)}>
              <PiPencilSimpleBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
          {rep.providerKind === 'endpoint' ? (
            <Tooltip content={t('pipeline.models.openEndpoint', 'Open endpoints')}>
              <Link href={buildPipelineUrl('endpoints')}>
                <ActionIcon size="sm" variant="text">
                  <PiCloudBold className="h-4 w-4" />
                </ActionIcon>
              </Link>
            </Tooltip>
          ) : (
            rep.nodeId && (
              <Tooltip content={t('pipeline.models.openOnNode', 'Open on node')}>
                <Link href={`/admin/nodes?node=${encodeURIComponent(rep.nodeId)}`}>
                  <ActionIcon size="sm" variant="text">
                    <PiDesktopTowerBold className="h-4 w-4" />
                  </ActionIcon>
                </Link>
              </Tooltip>
            )
          )}
          <Tooltip content={t('pipeline.models.showTopology', 'Topology')}>
            <ActionIcon
              size="sm"
              variant="text"
              onClick={() =>
                router.push(
                  buildPipelineUrl('topology', { lens: 'graph', focus: `model:${logicalId}` })
                )
              }
            >
              <PiShareNetworkBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
          <Tooltip content={t('common.delete')}>
            <ActionIcon
              size="sm"
              variant="text"
              className="text-red-500"
              disabled={deleting === rep.physicalName}
              onClick={() => onDelete(rep.physicalName)}
            >
              {deleting === rep.physicalName ? (
                <Loader size="sm" />
              ) : (
                <PiTrashBold className="h-4 w-4" />
              )}
            </ActionIcon>
          </Tooltip>
        </div>
      </td>
    </tr>
  );
}

export default function LogicalModelCatalogTable({
  models,
  pools,
  routes,
  bindings,
  bindingsCatalog,
  onRefresh,
  onEditReplica,
  search,
}: LogicalModelCatalogTableProps) {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const rows = useMemo(
    () => buildLogicalCatalogRows(pools, models, bindingsCatalog, routes),
    [pools, models, bindingsCatalog, routes]
  );

  const filteredRows = rows.filter((row) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      row.logicalId.toLowerCase().includes(q) ||
      row.replicas.some((r) => r.physicalName.toLowerCase().includes(q))
    );
  });

  const handleDelete = async (physicalName: string) => {
    const hasRefs = pipelineAdminService.modelHasReferences(physicalName, {
      routes,
      bindings,
      bindingsCatalog,
    });
    if (hasRefs) {
      toast.error(t('pipeline.models.deleteBlocked', 'Model is referenced by routes or bindings'));
      return;
    }
    if (!confirm(t('pipeline.models.deleteConfirm'))) return;
    setDeleting(physicalName);
    try {
      await pipelineAdminService.deleteModel(physicalName);
      toast.success(t('common.delete'));
      onRefresh();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setDeleting(null);
    }
  };

  if (filteredRows.length === 0) {
    return (
      <EmptyState
        icon={<PiBrainBold className="h-full w-full" />}
        message={
          search
            ? t('common.noResults')
            : t('pipeline.models.noModels', 'No models registered')
        }
      />
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-100">
              <th className="px-4 py-3 text-start font-medium text-gray-600">
                {t('pipeline.models.logicalId', 'Logical ID')}
              </th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">
                {t('pipeline.models.colDeployed', 'Deployed')}
              </th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">
                {t('pipeline.models.colBinded', 'Binded')}
              </th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">
                {t('pipeline.models.colHealth', 'Health')}
              </th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">
                {t('pipeline.models.replicas', 'Replicas')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-muted">
            {filteredRows.map((row) => {
              const isExpanded = expandedId === row.logicalId;
              return (
                <Fragment key={row.logicalId}>
                  <tr
                    className="cursor-pointer hover:bg-gray-50/60 dark:hover:bg-gray-100/30"
                    onClick={() => setExpandedId(isExpanded ? null : row.logicalId)}
                  >
                    <td className="px-4 py-3 font-medium font-mono">{row.logicalId}</td>
                    <td className="px-4 py-3 text-center">
                      <CatalogBoolCell value={row.deployed} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <CatalogBoolCell value={row.binded} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <CatalogBoolCell value={row.healthy} health />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" size="sm">
                        {row.replicaCount}
                      </Badge>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-gray-50/40 dark:bg-gray-100/10">
                      <td colSpan={5} className="px-6 py-4">
                        <ReplicaDetailTable
                          row={row}
                          onEdit={onEditReplica}
                          onDelete={handleDelete}
                          deleting={deleting}
                          t={t as (k: string, f?: string) => string}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
