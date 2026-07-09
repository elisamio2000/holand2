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
import { PiTrashBold } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { pipelineAdminService } from '@/services/pipeline-admin.service';
import type {
  BindingsCatalogEntry,
  LlmModel,
  LlmModelMeta,
  LlmPool,
  LlmRoute,
  ToolBinding,
} from '@/types/pipeline-admin.types';
import { resolveLogicalId } from '../helpers/logical-model-options';
import { buildPipelineUrl } from '../helpers/pipeline-tab-url';
import { modelHealthKind, statusDotColor } from '@/utils/model-health';
import StatusDot from './status-dot';
import PipelineAdminDrawer from './pipeline-admin-drawer';

interface ModelDetailDrawerProps {
  open: boolean;
  modelName: string | null;
  pools?: LlmPool[];
  routes?: LlmRoute[];
  bindings?: Record<string, ToolBinding>;
  bindingsCatalog?: BindingsCatalogEntry[];
  onClose: () => void;
  onSaved: () => void;
}

function ReadRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '' || value === '—') return null;
  return (
    <div className="flex justify-between gap-2 border-b border-muted py-2 text-xs">
      <Text className="text-gray-500">{label}</Text>
      <Text className="max-w-[60%] break-all text-end font-mono">{value}</Text>
    </div>
  );
}

export default function ModelDetailDrawer({
  open,
  modelName,
  pools = [],
  routes = [],
  bindings = {},
  bindingsCatalog = [],
  onClose,
  onSaved,
}: ModelDetailDrawerProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState<LlmModel | null>(null);
  const [meta, setMeta] = useState<LlmModelMeta | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [task, setTask] = useState('');
  const [pipelineTag, setPipelineTag] = useState('');
  const [modalitiesText, setModalitiesText] = useState('');
  const [taxonomyTags, setTaxonomyTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const logicalId = model ? resolveLogicalId(model) : '';
  const pool = pools.find((p) => p.logical_id === logicalId);
  const replicaCount = pool?.replicas?.length ?? 0;

  useEffect(() => {
    pipelineAdminService.getTaxonomy().then((tax) => {
      const tags = Object.keys(tax ?? {});
      if (tags.length) setTaxonomyTags(tags);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open || !modelName) {
      setModel(null);
      return;
    }
    setLoading(true);
    pipelineAdminService
      .getModel(modelName)
      .then((m) => {
        if (!m) {
          const fallback = pools
            .flatMap((p) => p.replicas ?? [])
            .find((r) => r.name === modelName);
          if (fallback) return null;
          return null;
        }
        setModel(m);
        setIsActive(m.is_active);
        setTask(m.task ?? '');
        const parsed = pipelineAdminService.parseModelMeta(m);
        setMeta(parsed);
        setPipelineTag(parsed?.pipeline_tag ?? m.task ?? '');
        setModalitiesText((parsed?.modalities ?? []).join(', '));
        return m;
      })
      .catch(() => {
        const local = pools.length ? null : null;
        return local;
      })
      .finally(() => setLoading(false));
  }, [open, modelName, pools]);

  useEffect(() => {
    if (!open || !modelName || model) return;
    const fromList = async () => {
      const all = await pipelineAdminService.listModels({ probe: true });
      const found = all.find((m) => m.name === modelName);
      if (found) {
        setModel(found);
        setIsActive(found.is_active);
        setTask(found.task ?? '');
        const parsed = pipelineAdminService.parseModelMeta(found);
        setMeta(parsed);
        setPipelineTag(parsed?.pipeline_tag ?? found.task ?? '');
        setModalitiesText((parsed?.modalities ?? []).join(', '));
      }
    };
    void fromList();
  }, [open, modelName, model]);

  const healthKind = model ? modelHealthKind(model) : 'unknown';

  const handleSave = async () => {
    if (!model) return;
    setSaving(true);
    try {
      const modalities = modalitiesText
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const nextMeta: LlmModelMeta = {
        ...(meta ?? {}),
        pipeline_tag: pipelineTag.trim() || task.trim() || meta?.pipeline_tag,
        modalities: modalities.length ? modalities : meta?.modalities,
      };
      await pipelineAdminService.updateModel(model.name, {
        is_active: isActive,
        task: task.trim() || model.task,
        metadata: nextMeta,
      });
      setMeta(nextMeta);
      toast.success(t('common.saved', 'Saved'));
      onSaved();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!model) return;
    const hasRefs = pipelineAdminService.modelHasReferences(model.name, {
      routes,
      bindings,
      bindingsCatalog,
    });
    if (hasRefs) {
      toast.error(t('pipeline.models.deleteBlocked'));
      return;
    }
    if (!confirm(t('pipeline.models.deleteConfirm'))) return;
    setDeleting(true);
    try {
      await pipelineAdminService.deleteModel(model.name);
      toast.success(t('common.delete'));
      onSaved();
      onClose();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setDeleting(false);
    }
  };

  const handleProbe = async () => {
    try {
      await pipelineAdminService.fetchLlmHealth();
      onSaved();
      if (modelName) {
        const fresh = await pipelineAdminService.getModel(modelName);
        if (fresh) setModel(fresh);
      }
      toast.success(t('pipeline.models.probeDone'));
    } catch {
      toast.error(t('common.error'));
    }
  };

  if (!open) return null;

  return (
    <PipelineAdminDrawer
      open={open}
      onClose={onClose}
      title={t('pipeline.models.detailTitle', 'Model settings')}
      footer={
        <div className="flex justify-between gap-2">
          <Button
            size="sm"
            variant="outline"
            color="danger"
            disabled={!model || deleting}
            onClick={() => void handleDelete()}
          >
            {deleting ? <Loader size="sm" /> : <PiTrashBold className="h-4 w-4" />}
            {t('common.delete')}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" disabled={!model || saving} onClick={() => void handleSave()}>
              {saving ? <Loader size="sm" /> : t('common.save')}
            </Button>
          </div>
        </div>
      }
    >
      {loading && (
            <div className="flex justify-center py-8">
              <Loader />
            </div>
          )}
          {!loading && !model && (
            <Text className="text-sm text-gray-500">{t('common.noResults')}</Text>
          )}
          {model && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <StatusDot color={statusDotColor(healthKind)} pulse={healthKind === 'healthy'} />
                <Text className="font-semibold">{logicalId}</Text>
                <Badge variant="outline" size="sm" className="font-mono text-[10px]">
                  {model.name}
                </Badge>
              </div>

              <div className="rounded-lg border border-muted p-3">
                <Text className="mb-2 text-xs font-semibold uppercase text-gray-500">
                  {t('pipeline.models.health', 'Health')}
                </Text>
                <ReadRow
                  label={t('pipeline.models.status', 'Status')}
                  value={healthKind}
                />
                <ReadRow
                  label={t('pipeline.endpoints.latency', 'Latency')}
                  value={
                    model.health?.latency_ms != null ? `${model.health.latency_ms}ms` : '—'
                  }
                />
                <ReadRow
                  label={t('pipeline.models.detailLastError', 'Last error')}
                  value={model.health?.last_error ?? '—'}
                />
                <ReadRow
                  label={t('pipeline.models.detailCheckedAt', 'Checked')}
                  value={model.health?.checked_at ?? '—'}
                />
              </div>

              <div className="rounded-lg border border-muted p-3">
                <Text className="mb-2 text-xs font-semibold uppercase text-gray-500">
                  {t('pipeline.models.metadata', 'Technical Info')}
                </Text>
                <ReadRow label={t('pipeline.models.logicalId')} value={logicalId} />
                <ReadRow label={t('pipeline.models.physicalName')} value={model.name} />
                <ReadRow label={t('pipeline.models.origin')} value={model.origin ?? '—'} />
                <ReadRow label={t('pipeline.models.backend')} value={model.backend_kind} />
                <ReadRow label={t('pipeline.models.upstreamModel')} value={model.upstream_model ?? '—'} />
                <ReadRow label={t('pipeline.models.endpoint')} value={model.endpoint_name ?? '—'} />
                <ReadRow label={t('pipeline.models.runsOn')} value={model.node_id ?? '—'} />
                <ReadRow label={t('pipeline.models.controlPlane')} value={model.control_plane ?? '—'} />
                <ReadRow
                  label={t('pipeline.models.replicas', 'Replicas')}
                  value={replicaCount || '—'}
                />
                {meta && (
                  <pre className="mt-2 max-h-32 overflow-auto rounded bg-gray-50 p-2 text-[10px] dark:bg-gray-100">
                    {JSON.stringify(meta, null, 2)}
                  </pre>
                )}
              </div>

              <div className="space-y-3 rounded-lg border border-muted p-3">
                <Text className="text-xs font-semibold uppercase text-gray-500">
                  {t('pipeline.models.registry', 'Registry')}
                </Text>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={isActive} onChange={() => setIsActive(!isActive)} />
                  {t('pipeline.models.active')}
                </label>
                <Input
                  size="sm"
                  label={t('pipeline.models.task', 'Task')}
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                />
                <Input
                  size="sm"
                  label={t('pipeline.models.pipelineTag', 'Pipeline tag')}
                  value={pipelineTag}
                  list="model-detail-taxonomy-tags"
                  onChange={(e) => setPipelineTag(e.target.value)}
                />
                <datalist id="model-detail-taxonomy-tags">
                  {taxonomyTags.map((tag) => (
                    <option key={tag} value={tag} />
                  ))}
                </datalist>
                <Input
                  size="sm"
                  label={t('pipeline.models.modalities', 'Modalities')}
                  placeholder="text, image"
                  value={modalitiesText}
                  onChange={(e) => setModalitiesText(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void handleProbe()}>
                  {t('pipeline.models.probe')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    router.push(
                      buildPipelineUrl('topology', {
                        view: 'board',
                        focus: `model:${logicalId}`,
                      })
                    )
                  }
                >
                  {t('pipeline.models.showTopology')}
                </Button>
                {model.node_id && (
                  <Link href={`/admin/nodes?node=${encodeURIComponent(model.node_id)}`}>
                    <Button size="sm" variant="outline">
                      {t('pipeline.models.openOnNode', 'Open on node')}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}
    </PipelineAdminDrawer>
  );
}
