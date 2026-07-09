// ============================================
// EndpointsTab — External LLM endpoints + wizard
// ============================================
'use client';

import { Tooltip } from '@/components/tooltip';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge, Button, Input, Text, ActionIcon, Loader, Switch } from 'rizzui';
import {
  PiCloudBold,
  PiPlusBold,
  PiTrashBold,
  PiHeartbeatBold,
  PiArrowClockwiseBold,
  PiDownloadBold,
  PiPencilBold,
  PiXBold,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';

import { pipelineAdminService } from '@/services/pipeline-admin.service';
import type {
  LlmEndpoint,
  LlmEndpointCreatePayload,
  LlmEndpointProbeResult,
  LlmRoute,
} from '@/types/pipeline-admin.types';
import { buildPipelineUrl } from '../helpers/pipeline-tab-url';
import { formatLlmApiError } from '../helpers/llm-api-errors';
import SectionCard from '../components/section-card';
import EmptyState from '../components/empty-state';
import StatusDot from '../components/status-dot';
import ExternalEndpointWizard from '../wizards/external-endpoint-wizard';
import EndpointEditDrawer from '../components/endpoint-edit-drawer';

const LOG_TAG = '[EndpointsTab]';

interface EndpointsTabProps {
  endpoints: LlmEndpoint[];
  routes?: LlmRoute[];
  onRefresh: () => void;
  autoProbe?: boolean;
  wizardOpen?: boolean;
  onWizardOpenChange?: (open: boolean, endpointId?: string | null) => void;
  wizardEndpointId?: string | null;
}

export default function EndpointsTab({
  endpoints,
  routes = [],
  onRefresh,
  autoProbe = false,
  wizardOpen: wizardOpenProp,
  onWizardOpenChange,
  wizardEndpointId,
}: EndpointsTabProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [wizardOpenLocal, setWizardOpenLocal] = useState(false);
  const [wizardEndpoint, setWizardEndpoint] = useState<LlmEndpoint | null>(null);
  const wizardOpen = wizardOpenProp ?? wizardOpenLocal;
  const setWizardOpen = useCallback(
    (open: boolean, endpointId?: string | null) => {
      if (onWizardOpenChange) {
        onWizardOpenChange(open, endpointId);
        return;
      }
      setWizardOpenLocal(open);
      if (endpointId) {
        const ep = endpoints.find((e) => e.id === endpointId) ?? null;
        if (ep) setWizardEndpoint(ep);
      }
    },
    [onWizardOpenChange, endpoints]
  );

  const [creating, setCreating] = useState(false);
  const [probing, setProbing] = useState<string | null>(null);
  const [probeResults, setProbeResults] = useState<
    Record<string, LlmEndpointProbeResult>
  >({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editEndpoint, setEditEndpoint] = useState<LlmEndpoint | null>(null);
  const [togglingActive, setTogglingActive] = useState<string | null>(null);

  const routeUsageByEndpoint = useMemo(() => {
    const map = new Map<string, number>();
    for (const ep of endpoints) {
      const count = routes.filter((route) => {
        const blob =
          typeof route.constraints === 'string'
            ? route.constraints
            : JSON.stringify(route.constraints ?? {});
        return blob.includes(ep.name) || blob.includes(ep.host);
      }).length;
      map.set(ep.id, count);
    }
    return map;
  }, [endpoints, routes]);

  const handleToggleActive = useCallback(
    async (ep: LlmEndpoint, next: boolean) => {
      setTogglingActive(ep.id);
      try {
        await pipelineAdminService.patchEndpoint(ep.id, { is_active: next });
        toast.success(t('pipeline.endpoints.editSuccess'));
        onRefresh();
      } catch (err) {
        toast.error(formatLlmApiError(err, t));
      } finally {
        setTogglingActive(null);
      }
    },
    [onRefresh, t]
  );

  const [form, setForm] = useState<LlmEndpointCreatePayload>({
    name: '',
    host: '',
    port: 8080,
    scheme: 'http',
  });

  useEffect(() => {
    if (!wizardEndpointId) return;
    const ep = endpoints.find((e) => e.id === wizardEndpointId) ?? null;
    if (ep) setWizardEndpoint(ep);
  }, [wizardEndpointId, endpoints]);

  useEffect(() => {
    const endpointParam = searchParams.get('endpoint');
    if (!endpointParam || endpoints.length === 0) return;
    if (searchParams.get('wizard') === 'external') return;
    const ep =
      endpoints.find((e) => e.id === endpointParam) ??
      endpoints.find((e) => e.name === endpointParam) ??
      null;
    if (ep) setEditEndpoint(ep);
  }, [searchParams, endpoints]);

  const openWizard = useCallback(
    (ep?: LlmEndpoint | null) => {
      setWizardEndpoint(ep ?? null);
      setWizardOpen(true, ep?.id ?? null);
    },
    [setWizardOpen]
  );

  const handleCreate = useCallback(async () => {
    if (!form.name.trim() || !form.host.trim()) return;
    setCreating(true);
    try {
      await pipelineAdminService.createEndpoint(form);
      toast.success(t('pipeline.endpoints.addEndpoint') + ' ✓');
      setShowCreate(false);
      setForm({ name: '', host: '', port: 8080, scheme: 'http' });
      onRefresh();
    } catch (err) {
      toast.error(formatLlmApiError(err, t));
    } finally {
      setCreating(false);
    }
  }, [form, onRefresh, t]);

  const handleProbe = useCallback(
    async (ep: LlmEndpoint) => {
      setProbing(ep.id);
      try {
        const result = await pipelineAdminService.probeEndpoint(ep.id, 'GET');
        setProbeResults((prev) => ({ ...prev, [ep.id]: result }));
        toast.success(
          result.healthy
            ? `${ep.name}: ${t('pipeline.endpoints.healthy')}`
            : `${ep.name}: ${t('pipeline.endpoints.unhealthy')}`
        );
      } catch (err) {
        setProbeResults((prev) => ({
          ...prev,
          [ep.id]: { healthy: false, error: formatLlmApiError(err, t) },
        }));
        toast.error(formatLlmApiError(err, t));
      } finally {
        setProbing(null);
      }
    },
    [t]
  );

  const handleDelete = useCallback(
    async (ep: LlmEndpoint) => {
      if (!confirm(t('pipeline.endpoints.deleteConfirm'))) return;
      setDeleting(ep.id);
      try {
        await pipelineAdminService.deleteEndpoint(ep.id);
        toast.success(`${ep.name} ${t('common.delete')} ✓`);
        onRefresh();
      } catch (err) {
        toast.error(formatLlmApiError(err, t));
      } finally {
        setDeleting(null);
      }
    },
    [onRefresh, t]
  );

  useEffect(() => {
    if (!autoProbe || endpoints.length === 0) return;
    const probeAll = async () => {
      for (const ep of endpoints) {
        try {
          const result = await pipelineAdminService.probeEndpoint(ep.id, 'GET');
          setProbeResults((prev) => ({ ...prev, [ep.id]: result }));
        } catch {
          setProbeResults((prev) => ({
            ...prev,
            [ep.id]: { healthy: false, error: 'probe failed' },
          }));
        }
      }
    };
    void probeAll();
    const id = window.setInterval(probeAll, 30_000);
    return () => window.clearInterval(id);
  }, [autoProbe, endpoints]);

  return (
    <div className="space-y-6">
      <ExternalEndpointWizard
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false);
          setWizardEndpoint(null);
        }}
        onComplete={() => {
          onRefresh();
        }}
        initialEndpoint={wizardEndpoint}
      />

      <EndpointEditDrawer
        open={editEndpoint != null}
        endpoint={editEndpoint}
        onClose={() => setEditEndpoint(null)}
        onSaved={onRefresh}
        onProbe={(ep) => void handleProbe(ep)}
      />

      {showCreate && (
        <SectionCard
          title={t('pipeline.endpoints.createTitle')}
          icon={<PiPlusBold className="h-4 w-4 text-primary" />}
          headerActions={
            <ActionIcon variant="text" size="sm" onClick={() => setShowCreate(false)}>
              <PiXBold className="h-4 w-4" />
            </ActionIcon>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              size="sm"
              label={t('pipeline.endpoints.name')}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              size="sm"
              label={t('pipeline.endpoints.host')}
              value={form.host}
              onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
            />
            <Input
              size="sm"
              type="number"
              label={t('pipeline.endpoints.port')}
              value={form.port}
              onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button size="sm" onClick={handleCreate} disabled={creating}>
              {creating ? <Loader size="sm" /> : t('pipeline.endpoints.addEndpoint')}
            </Button>
          </div>
        </SectionCard>
      )}

      <SectionCard
        title={t('pipeline.endpoints.title')}
        icon={<PiCloudBold className="h-5 w-5 text-primary" />}
        badge={
          <Badge variant="flat" size="sm" className="ms-2">
            {endpoints.length}
          </Badge>
        }
        headerActions={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => openWizard()} className="gap-1">
              <PiPlusBold className="h-3.5 w-3.5" />
              {t('pipeline.endpoints.addExternalServer')}
            </Button>
            <Tooltip content={t('common.refresh')}>
              <ActionIcon variant="outline" size="sm" onClick={onRefresh} aria-label={t('common.refresh')}>
                <PiArrowClockwiseBold className="h-4 w-4" />
              </ActionIcon>
            </Tooltip>
          </div>
        }
        bodyClassName="p-0"
      >
        {endpoints.length === 0 ? (
          <EmptyState
            icon={<PiCloudBold className="h-full w-full" />}
            message={t('pipeline.endpoints.noEndpoints')}
            action={{
              label: t('pipeline.endpoints.addExternalServer'),
              onClick: () => openWizard(),
            }}
          />
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-100">
                  <th className="px-4 py-3 text-start font-medium">{t('pipeline.endpoints.name')}</th>
                  <th className="hidden px-4 py-3 text-start font-medium sm:table-cell">
                    {t('pipeline.endpoints.host')}
                  </th>
                  <th className="hidden px-4 py-3 text-center font-medium md:table-cell">
                    {t('pipeline.endpoints.status')}
                  </th>
                  <th className="hidden px-4 py-3 text-center font-medium lg:table-cell">
                    {t('pipeline.endpoints.usedByRoutes', 'Used by routes')}
                  </th>
                  <th className="hidden px-4 py-3 text-center font-medium lg:table-cell">
                    {t('pipeline.endpoints.active')}
                  </th>
                  <th className="px-4 py-3 text-end font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted">
                {endpoints.map((ep) => (
                  <tr key={ep.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-100/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusDot color={ep.is_active ? 'green' : 'gray'} size="sm" />
                        <Text className="font-medium">{ep.name}</Text>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <Text className="font-mono text-xs">
                        {ep.host}:{ep.port}
                      </Text>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {probeResults[ep.id] ? (
                        <Badge
                          variant="flat"
                          size="sm"
                          color={probeResults[ep.id].healthy ? 'success' : 'danger'}
                        >
                          {probeResults[ep.id].healthy
                            ? t('pipeline.endpoints.healthy')
                            : t('pipeline.endpoints.unhealthy')}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-center lg:table-cell">
                      <Button
                        size="sm"
                        variant="text"
                        disabled={(routeUsageByEndpoint.get(ep.id) ?? 0) === 0}
                        onClick={() =>
                          router.push(
                            buildPipelineUrl('topology', {
                              focus: 'routes',
                            })
                          )
                        }
                      >
                        {routeUsageByEndpoint.get(ep.id) ?? 0}
                      </Button>
                    </td>
                    <td className="hidden px-4 py-3 text-center lg:table-cell">
                      <Switch
                        size="sm"
                        checked={ep.is_active !== false}
                        disabled={togglingActive === ep.id}
                        onChange={(event) =>
                          void handleToggleActive(ep, event.target.checked)
                        }
                        aria-label={t('pipeline.endpoints.active')}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Tooltip content={t('pipeline.endpoints.probe')}>
                          <ActionIcon
                            variant="text"
                            size="sm"
                            onClick={() => handleProbe(ep)}
                            disabled={probing === ep.id}
                            aria-label={t('pipeline.endpoints.probe')}
                          >
                            {probing === ep.id ? (
                              <Loader size="sm" />
                            ) : (
                              <PiHeartbeatBold className="h-4 w-4" />
                            )}
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip content={t('pipeline.endpoints.editTitle', 'Edit endpoint')}>
                          <ActionIcon
                            variant="text"
                            size="sm"
                            onClick={() => setEditEndpoint(ep)}
                            aria-label={t('pipeline.endpoints.editTitle', 'Edit endpoint')}
                          >
                            <PiPencilBold className="h-4 w-4" />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip content={t('pipeline.endpoints.importMore')}>
                          <ActionIcon
                            variant="text"
                            size="sm"
                            onClick={() => openWizard(ep)}
                            aria-label={t('pipeline.endpoints.importMore')}
                          >
                            <PiDownloadBold className="h-4 w-4" />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip content={t('common.delete')}>
                          <ActionIcon
                            variant="text"
                            color="danger"
                            size="sm"
                            onClick={() => handleDelete(ep)}
                            disabled={deleting === ep.id}
                            aria-label={t('common.delete')}
                          >
                            {deleting === ep.id ? (
                              <Loader size="sm" />
                            ) : (
                              <PiTrashBold className="h-4 w-4" />
                            )}
                          </ActionIcon>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
