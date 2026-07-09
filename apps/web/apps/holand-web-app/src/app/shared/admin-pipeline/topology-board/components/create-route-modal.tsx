'use client';

import { useCallback, useMemo, useState } from 'react';
import { Button, Input, Loader, Modal, Select, Text, Textarea, Title } from 'rizzui';
import { PiCheckBold } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { pipelineAdminService } from '@/services/pipeline-admin.service';
import type { LlmRouteUpsertPayload, LogicalCatalogEntry, LlmModel } from '@/types/pipeline-admin.types';
import { buildLogicalSelectOptions, normalizeBindingModelId } from '../../helpers/logical-model-options';

interface CreateRouteModalProps {
  open: boolean;
  models: LlmModel[];
  logicalCatalog?: LogicalCatalogEntry[];
  onClose: () => void;
  onCreated: (routeKey: string) => Promise<void>;
}

export default function CreateRouteModal({
  open,
  models,
  logicalCatalog = [],
  onClose,
  onCreated,
}: CreateRouteModalProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<LlmRouteUpsertPayload>({
    route_key: '',
    model_name: '',
    fallback_model_name: '',
    constraints: {},
  });
  const [constraintsStr, setConstraintsStr] = useState('');

  const modelOptions = useMemo(
    () =>
      buildLogicalSelectOptions(models, logicalCatalog, { activeOnly: true }).map((o) => ({
        label: o.label,
        value: o.value,
      })),
    [models, logicalCatalog]
  );

  const reset = useCallback(() => {
    setForm({
      route_key: '',
      model_name: '',
      fallback_model_name: '',
      constraints: {},
    });
    setConstraintsStr('');
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleSave = useCallback(async () => {
    if (!form.route_key.trim() || !form.model_name.trim()) return;
    setSaving(true);
    try {
      let constraints = form.constraints;
      if (constraintsStr.trim()) {
        try {
          constraints = JSON.parse(constraintsStr) as Record<string, unknown>;
        } catch {
          toast.error('Invalid JSON in constraints');
          setSaving(false);
          return;
        }
      }
      const routeKey = form.route_key.trim();
      await pipelineAdminService.upsertRoute({
        ...form,
        route_key: routeKey,
        model_name: normalizeBindingModelId(models, form.model_name),
        fallback_model_name: form.fallback_model_name
          ? normalizeBindingModelId(models, form.fallback_model_name)
          : '',
        constraints,
      });
      toast.success(`${routeKey} ✓`);
      reset();
      onClose();
      await onCreated(routeKey);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  }, [constraintsStr, form, models, onClose, onCreated, reset, t]);

  return (
    <Modal isOpen={open} onClose={handleClose} size="lg">
      <div className="flex max-h-[80vh] flex-col overflow-hidden">
        <Title as="h4" className="border-b border-muted px-6 py-4">
          {t('pipeline.routes.addRoute', 'Add route')}
        </Title>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <Input
            size="sm"
            label={t('pipeline.routes.routeKey', 'Route key')}
            value={form.route_key}
            onChange={(e) => setForm((f) => ({ ...f, route_key: e.target.value }))}
          />
          <Select
            size="sm"
            label={t('pipeline.routes.model', 'Model')}
            options={modelOptions}
            value={form.model_name || undefined}
            onChange={(opt: { value: string } | null) =>
              setForm((f) => ({ ...f, model_name: opt?.value || '' }))
            }
          />
          <Select
            size="sm"
            label={t('pipeline.routes.fallback', 'Fallback')}
            options={[{ label: '— None —', value: '' }, ...modelOptions]}
            value={form.fallback_model_name || ''}
            onChange={(opt: { value: string } | null) =>
              setForm((f) => ({ ...f, fallback_model_name: opt?.value || '' }))
            }
          />
          <Textarea
            size="sm"
            label={t('pipeline.routes.constraints', 'Constraints (JSON)')}
            value={constraintsStr}
            onChange={(e) => setConstraintsStr(e.target.value)}
            rows={3}
            className="font-mono text-xs"
          />
          <Text className="text-xs text-gray-500">
            {t(
              'pipeline.routes.createHint',
              'Route is saved to the API and added to the topology canvas.'
            )}
          </Text>
        </div>
        <div className="flex justify-end gap-2 border-t border-muted px-6 py-4">
          <Button variant="outline" size="sm" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving || !form.route_key.trim() || !form.model_name.trim()}
          >
            {saving ? <Loader size="sm" /> : <PiCheckBold className="h-3.5 w-3.5" />}
            {t('common.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
