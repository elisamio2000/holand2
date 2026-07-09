'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Loader, Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { adminRemoteNodesService } from '@/services/admin-remote-nodes.service';

type LogScope = 'all' | 'inference' | 'stack';

interface NodeLogsPanelProps {
  nodeId: string;
  focusModel?: string | null;
  onFocusModelHandled?: () => void;
}

export default function NodeLogsPanel({
  nodeId,
  focusModel,
  onFocusModelHandled,
}: NodeLogsPanelProps) {
  const { t } = useTranslation();
  const [scope, setScope] = useState<LogScope>('all');
  const [containers, setContainers] = useState<string[]>([]);
  const [container, setContainer] = useState('');
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [modelFocusName, setModelFocusName] = useState<string | null>(null);

  const modelFocusActive = Boolean(modelFocusName);

  const loadContainers = useCallback(async () => {
    try {
      const rows = await adminRemoteNodesService.listRemoteNodeContainers(nodeId, { scope });
      setContainers(rows.map((r) => r.name).filter(Boolean));
    } catch {
      setContainers([]);
    }
  }, [nodeId, scope]);

  const fetchContainerLogs = useCallback(async () => {
    if (!container.trim()) {
      setLines([]);
      return;
    }
    setLoading(true);
    try {
      const res = await adminRemoteNodesService.getRemoteContainerLogs(nodeId, container.trim());
      const raw = res.lines ?? (typeof res.logs === 'string' ? res.logs.split('\n') : []);
      setLines(Array.isArray(raw) ? raw.filter(Boolean) : []);
    } catch {
      setLines([t('adminNodes.logsFailed', 'Failed to load logs')]);
    } finally {
      setLoading(false);
    }
  }, [container, nodeId, t]);

  const fetchModelLogs = useCallback(
    async (modelName: string) => {
      if (!modelName.trim()) return;
      setLoading(true);
      try {
        const res = await adminRemoteNodesService.getRemoteModelLogs(nodeId, modelName.trim());
        const raw =
          typeof res.logs === 'string'
            ? res.logs.split('\n')
            : Array.isArray((res as { lines?: string[] }).lines)
              ? (res as { lines: string[] }).lines
              : [];
        setLines(raw.filter(Boolean));
      } catch {
        setLines([t('adminNodes.logsFailed', 'Failed to load logs')]);
      } finally {
        setLoading(false);
      }
    },
    [nodeId, t]
  );

  useEffect(() => {
    void loadContainers();
  }, [loadContainers]);

  useEffect(() => {
    if (modelFocusActive) return;
    void fetchContainerLogs();
  }, [fetchContainerLogs, modelFocusActive]);

  useEffect(() => {
    if (!focusModel) return;
    setModelFocusName(focusModel);
    void fetchModelLogs(focusModel);
    onFocusModelHandled?.();
  }, [focusModel, fetchModelLogs, onFocusModelHandled]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      if (modelFocusActive && modelFocusName) {
        void fetchModelLogs(modelFocusName);
      } else {
        void fetchContainerLogs();
      }
    }, 5000);
    return () => window.clearInterval(id);
  }, [autoRefresh, fetchContainerLogs, fetchModelLogs, modelFocusName, modelFocusActive]);

  const title = modelFocusActive
    ? `${t('adminNodes.modelLogs', 'Logs')} — ${modelFocusName}`
    : t('adminNodes.containerLogs', 'Container logs');

  return (
    <div className="rounded-lg border border-muted p-4">
      <Title as="h6" className="mb-3 text-sm font-semibold">
        {title}
      </Title>
      {!modelFocusActive && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-muted bg-transparent px-2 py-1 text-xs"
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as LogScope);
              setContainer('');
            }}
          >
            <option value="all">{t('adminNodes.logScopeAll', 'All containers')}</option>
            <option value="inference">{t('adminNodes.logScopeInference', 'Inference only')}</option>
            <option value="stack">{t('adminNodes.logScopeStack', 'Stack (agent/scanner)')}</option>
          </select>
          <select
            className="min-w-[12rem] rounded-md border border-muted bg-transparent px-2 py-1 text-xs"
            value={container}
            onChange={(e) => setContainer(e.target.value)}
          >
            <option value="">{t('adminNodes.selectContainer', 'Select container…')}</option>
            {containers.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void fetchContainerLogs()}
            disabled={loading}
          >
            {loading ? <Loader size="sm" /> : t('common.refresh')}
          </Button>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            {t('adminNodes.autoRefresh', 'Auto-refresh')}
          </label>
        </div>
      )}
      {modelFocusActive && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setModelFocusName(null);
              void fetchContainerLogs();
            }}
          >
            {t('adminNodes.containerLogs', 'Container logs')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => modelFocusName && void fetchModelLogs(modelFocusName)}
            disabled={loading}
          >
            {loading ? <Loader size="sm" /> : t('common.refresh')}
          </Button>
        </div>
      )}
      <pre className="max-h-64 overflow-auto rounded bg-gray-900 p-3 font-mono text-[10px] text-green-200">
        {lines.length ? lines.join('\n') : t('adminNodes.noLogs', 'No log lines')}
      </pre>
    </div>
  );
}
