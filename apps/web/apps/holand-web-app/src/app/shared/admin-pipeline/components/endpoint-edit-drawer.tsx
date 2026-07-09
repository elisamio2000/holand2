'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, Input, Loader, Select, Switch } from 'rizzui';
import { PiPencilBold } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { pipelineAdminService } from '@/services/pipeline-admin.service';
import type { LlmEndpoint, LlmEndpointPatchPayload } from '@/types/pipeline-admin.types';
import { formatLlmApiError } from '../helpers/llm-api-errors';
import PipelineAdminModal from './pipeline-admin-modal';

interface EndpointEditDrawerProps {
  open: boolean;
  endpoint: LlmEndpoint | null;
  onClose: () => void;
  onSaved: () => void;
  onProbe?: (endpoint: LlmEndpoint) => void;
}

export default function EndpointEditDrawer({
  open,
  endpoint,
  onClose,
  onSaved,
  onProbe,
}: EndpointEditDrawerProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<LlmEndpointPatchPayload>({
    host: '',
    port: 8080,
    scheme: 'http',
    base_path: '',
    is_active: true,
  });

  useEffect(() => {
    if (!endpoint || !open) return;
    setForm({
      host: endpoint.host,
      port: endpoint.port,
      scheme: typeof endpoint.scheme === 'string' ? endpoint.scheme : 'http',
      base_path: typeof endpoint.base_path === 'string' ? endpoint.base_path : '',
      is_active: endpoint.is_active !== false,
    });
  }, [endpoint, open]);

  const handleSave = async () => {
    if (!endpoint || !form.host?.trim()) return;
    setSaving(true);
    try {
      const updated = await pipelineAdminService.patchEndpoint(endpoint.id, {
        host: form.host.trim(),
        port: Number(form.port) || endpoint.port,
        scheme: form.scheme || 'http',
        base_path: form.base_path ?? '',
        is_active: form.is_active,
      });
      toast.success(t('pipeline.endpoints.editSuccess', 'Endpoint updated'));
      onSaved();
      onProbe?.({ ...endpoint, ...updated });
      onClose();
    } catch (err) {
      toast.error(formatLlmApiError(err, t));
    } finally {
      setSaving(false);
    }
  };

  if (!endpoint) return null;

  return (
    <PipelineAdminModal
      open={open}
      onClose={onClose}
      titleId="endpoint-edit-title"
      title={t('pipeline.endpoints.editTitle', 'Edit endpoint')}
      icon={<PiPencilBold className="h-5 w-5" />}
      subtitle={
        <Badge variant="flat" size="sm" className="font-mono text-xs">
          {endpoint.name}
        </Badge>
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button size="sm" onClick={() => void handleSave()} disabled={saving || !form.host?.trim()}>
            {saving ? <Loader size="sm" /> : t('common.save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            size="sm"
            label={t('pipeline.endpoints.host')}
            value={form.host ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
          />
          <Input
            size="sm"
            type="number"
            label={t('pipeline.endpoints.port')}
            value={form.port ?? 8080}
            onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))}
          />
          <Select
            size="sm"
            label={t('pipeline.wizard.scheme', 'Scheme')}
            options={[
              { label: 'http', value: 'http' },
              { label: 'https', value: 'https' },
            ]}
            value={form.scheme ?? 'http'}
            onChange={(opt: { value: string } | null) =>
              setForm((f) => ({ ...f, scheme: opt?.value ?? 'http' }))
            }
          />
          <Input
            size="sm"
            label={t('pipeline.wizard.basePath', 'Base path')}
            placeholder="/v1"
            value={form.base_path ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, base_path: e.target.value }))}
          />
        </div>

        <div className="rounded-lg border border-muted px-3 py-2.5">
          <Switch
            label={t('pipeline.endpoints.active', 'Active')}
            checked={form.is_active !== false}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
          />
        </div>
      </div>
    </PipelineAdminModal>
  );
}
