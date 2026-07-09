'use client';

import { useState } from 'react';
import { Button, Input, Loader, Text, Title } from 'rizzui';
import { PiXBold } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { adminRemoteNodesService } from '@/services/admin-remote-nodes.service';

interface RegisterNodeModalProps {
  open: boolean;
  onClose: () => void;
  onRegistered: () => void;
}

export default function RegisterNodeModal({
  open,
  onClose,
  onRegistered,
}: RegisterNodeModalProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    node_id: '',
    display_name: '',
    host: '',
    port: 9100,
    token: '',
  });

  if (!open) return null;

  const handleSubmit = async () => {
    if (!form.node_id.trim()) {
      toast.error(t('adminNodes.nodeId', 'Node ID'));
      return;
    }
    if (!form.host.trim()) {
      toast.error(t('adminNodes.editHostRequired', 'Host is required for remote agent nodes'));
      return;
    }
    const port = Number(form.port);
    if (!Number.isFinite(port) || port <= 0 || port > 65535) {
      toast.error(t('pipeline.endpoints.port'));
      return;
    }
    setSaving(true);
    try {
      await adminRemoteNodesService.registerRemoteNode({
        node_id: form.node_id.trim(),
        display_name: form.display_name.trim() || undefined,
        host: form.host.trim(),
        port: Number(form.port) || 9100,
        token: form.token.trim() || undefined,
      });
      toast.success(t('adminNodes.registerSuccess', 'Node registered'));
      onRegistered();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('adminNodes.registerFailed', 'Registration failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl border border-muted bg-gray-0 p-6 dark:bg-gray-50">
        <div className="mb-4 flex items-center justify-between">
          <Title as="h5" className="text-lg font-semibold">
            {t('adminNodes.registerTitle', 'Register GPU node')}
          </Title>
          <button type="button" onClick={onClose} aria-label={t('common.close', 'Close')}>
            <PiXBold className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            size="sm"
            label={t('adminNodes.nodeId', 'Node ID')}
            value={form.node_id}
            onChange={(e) => setForm((f) => ({ ...f, node_id: e.target.value }))}
          />
          <Input
            size="sm"
            label={t('adminNodes.displayName', 'Display name')}
            value={form.display_name}
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
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
          <div className="sm:col-span-2">
            <Input
              size="sm"
              label={t('adminNodes.agentToken', 'Agent token (optional)')}
              value={form.token}
              onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? <Loader size="sm" /> : t('adminNodes.register', 'Register')}
          </Button>
        </div>
      </div>
    </div>
  );
}
