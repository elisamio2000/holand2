'use client';

import { useEffect, useState } from 'react';
import { Button, Input, Loader, Switch, Text, Title } from 'rizzui';
import { PiXBold } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  adminRemoteNodesService,
  isRemoteAgentNode,
  type RemoteNodeRow,
} from '@/services/admin-remote-nodes.service';

interface EditNodeModalProps {
  open: boolean;
  node: RemoteNodeRow | null;
  onClose: () => void;
  onSaved: (node: RemoteNodeRow) => void;
}

function agentHostPort(node: RemoteNodeRow): { host: string; port: number } {
  const meta = node.metadata ?? {};
  let host = String(meta.host ?? '');
  let port = Number(meta.port ?? 8020);
  const url = node.agent_url ?? (typeof meta.agent_url === 'string' ? meta.agent_url : '');
  if (!host && url) {
    try {
      const parsed = new URL(url);
      host = parsed.hostname;
      port = Number(parsed.port) || 8020;
    } catch {
      /* ignore */
    }
  }
  return { host, port: Number.isFinite(port) ? port : 8020 };
}

function canEditConnection(node: RemoteNodeRow): boolean {
  if (isRemoteAgentNode(node)) return true;
  return Boolean(agentHostPort(node).host);
}

export default function EditNodeModal({
  open,
  node,
  onClose,
  onSaved,
}: EditNodeModalProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    display_name: '',
    host: '',
    port: 8020,
    is_active: true,
  });

  useEffect(() => {
    if (!open || !node) return;
    const { host, port } = agentHostPort(node);
    setForm({
      display_name: node.display_name ?? '',
      host,
      port,
      is_active: node.is_active !== false,
    });
  }, [open, node]);

  if (!open || !node) return null;

  const showConnectionFields = canEditConnection(node);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const body: {
        display_name?: string;
        is_active?: boolean;
        host?: string;
        port?: number;
      } = {
        display_name: form.display_name.trim() || node.id,
        is_active: form.is_active,
      };
      if (showConnectionFields) {
        if (!form.host.trim()) {
          toast.error(t('adminNodes.editHostRequired'));
          return;
        }
        body.host = form.host.trim();
        body.port = Number(form.port) || 8020;
      }
      const result = await adminRemoteNodesService.patchRemoteNode(node.id, body);
      const saved = result.node;
      if (!saved?.id) {
        throw new Error(t('adminNodes.editFailed'));
      }
      toast.success(t('adminNodes.editSuccess'));
      onSaved(saved);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('adminNodes.editFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl border border-muted bg-gray-0 p-6 dark:bg-gray-50">
        <div className="mb-4 flex items-center justify-between">
          <Title as="h5" className="text-lg font-semibold">
            {t('adminNodes.editTitle')}
          </Title>
          <button type="button" onClick={onClose} aria-label={t('common.close', 'Close')}>
            <PiXBold className="h-4 w-4" />
          </button>
        </div>
        <Text className="mb-4 text-xs text-gray-500">
          {t('adminNodes.nodeId')}: {node.id}
        </Text>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              size="sm"
              label={t('adminNodes.displayName')}
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            />
          </div>
          {showConnectionFields && (
            <>
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
            </>
          )}
          <div className="flex items-center gap-2 sm:col-span-2">
            <Switch
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            <Text className="text-sm">{t('adminNodes.nodeActive')}</Text>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? <Loader size="sm" /> : t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
