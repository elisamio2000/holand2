'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Loader, Text } from 'rizzui';
import { PiCopyBold } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  adminRemoteNodesService,
  bootstrapTokenStatus,
  type BootstrapTokenStatus,
} from '@/services/admin-remote-nodes.service';

export default function BootstrapHelpPanel() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await adminRemoteNodesService.getNodesBootstrap();
        if (!cancelled) setBootstrap(data);
      } catch {
        if (!cancelled) setBootstrap(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const copyText = useCallback(
    (text: string) => {
      void navigator.clipboard.writeText(text);
      toast.success(t('adminNodes.copied', 'Copied'));
    },
    [t]
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-muted p-4">
        <Loader size="sm" />
        <Text className="text-sm text-gray-500">
          {t('adminNodes.bootstrapLoading', 'Loading bootstrap…')}
        </Text>
      </div>
    );
  }

  const tokenStatus: BootstrapTokenStatus = bootstrapTokenStatus(bootstrap);
  const command =
    (typeof bootstrap?.install_command === 'string' && bootstrap.install_command) ||
    (typeof bootstrap?.command === 'string' && bootstrap.command) ||
    (typeof bootstrap?.docker_run === 'string' && bootstrap.docker_run) ||
  '';

  const docsUrl =
    (typeof bootstrap?.docs_url === 'string' && bootstrap.docs_url) ||
    (typeof bootstrap?.documentation_url === 'string' && bootstrap.documentation_url) ||
    '';

  const tokenBadge =
    tokenStatus === 'configured' ? (
      <Badge variant="flat" color="success" size="sm">
        {t('adminNodes.tokenConfigured', 'Token configured')}
      </Badge>
    ) : tokenStatus === 'not_configured' ? (
      <Badge variant="flat" color="warning" size="sm">
        {t('adminNodes.tokenNotConfigured', 'Token not set on gateway')}
      </Badge>
    ) : null;

  return (
    <div className="rounded-lg border border-muted bg-gray-50/50 p-4 dark:bg-gray-100/10">
      <div className="flex flex-wrap items-center gap-2">
        <Text className="text-sm font-semibold">
          {t('adminNodes.bootstrapTitle', 'Agent bootstrap')}
        </Text>
        {tokenBadge}
      </div>
      <Text className="mt-1 text-xs text-gray-500">
        {t(
          'adminNodes.bootstrapHint',
          'Run the agent on a GPU host, then register it here with host/port and node ID.'
        )}
      </Text>
      {command ? (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-muted bg-white p-2 dark:bg-gray-0">
          <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap font-mono text-[11px]">
            {command}
          </pre>
          <Button size="sm" variant="outline" onClick={() => copyText(command)}>
            <PiCopyBold className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Text className="mt-2 text-xs text-gray-400">
          {t('adminNodes.bootstrapUnavailable', 'Bootstrap command not available from API.')}
        </Text>
      )}
      {docsUrl && (
        <a
          href={docsUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs text-primary hover:underline"
        >
          {t('adminNodes.bootstrapDocs', 'Documentation')}
        </a>
      )}
    </div>
  );
}
