// ============================================
// ShareModal — Generate / revoke a public share token for an artifact.
// Uses plugin.file_manager.share (action=create / revoke). v0.41.0
// ============================================

'use client';

import { useState, useCallback } from 'react';
import { Text, Title, Button, ActionIcon, Loader } from 'rizzui';
import { useTranslation } from 'react-i18next';
import {
  PiXBold,
  PiCopyBold,
  PiCheckBold,
  PiShareNetworkBold,
  PiTrashBold,
  PiLinkSimpleBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { storageService } from '@/services/storage.service';
import { gatewayClient } from '@/lib/api-client';
import type { FileManagerShareResult } from '@/types/storage.types';
import toast from 'react-hot-toast';

// ==========================================
// Props
// ==========================================

interface ShareModalProps {
  /** Artifact UUID to create the share for. */
  artifactId: string;
  /** Filename — shown in the header for context. */
  filename: string;
  /** Called when the modal is dismissed. */
  onClose: () => void;
}

/** Available expiry presets (label → seconds). */
const EXPIRY_PRESETS: { label: string; value: number }[] = [
  { label: '15m', value: 15 * 60 },
  { label: '1h', value: 60 * 60 },
  { label: '24h', value: 24 * 60 * 60 },
  { label: '7d', value: 7 * 24 * 60 * 60 },
];

// ==========================================
// Component
// ==========================================

/**
 * ShareModal — Modal dialog that creates an anonymous-download token
 * for a single artifact and lets the user copy the URL or revoke it.
 *
 * - Calls `storageService.createShareToken(artifactId, expiresSec)`
 * - Builds the public URL using the gateway baseURL +
 *   `result.gateway_download_path` returned by the plugin.
 * - "Revoke" calls `storageService.revokeShareToken(token)` and clears state.
 *
 * @example
 * ```tsx
 * <ShareModal artifactId="abc" filename="file.pdf" onClose={() => setOpen(false)} />
 * ```
 */
export default function ShareModal({ artifactId, filename, onClose }: ShareModalProps) {
  const { t } = useTranslation();
  const tx = useCallback((key: string) => t(`fileExplorer.${key}`), [t]);
  const [expiresSec, setExpiresSec] = useState<number>(EXPIRY_PRESETS[1].value);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [share, setShare] = useState<FileManagerShareResult | null>(null);
  const [copied, setCopied] = useState(false);

  /** Build the absolute public URL from the gateway base + plugin path. */
  const buildShareUrl = useCallback((data: FileManagerShareResult): string => {
    const base = gatewayClient.defaults.baseURL ?? '';
    if (data.gateway_download_path) {
      // gateway_download_path is already an absolute path (e.g. /storage/shares/<token>/download)
      return `${base.replace(/\/$/, '')}${data.gateway_download_path}`;
    }
    if (data.token) {
      return `${base.replace(/\/$/, '')}/storage/shares/${data.token}/download`;
    }
    return '';
  }, []);

  const handleCreate = useCallback(async () => {
    console.info('[ShareModal] Creating share token:', { artifactId, expiresSec });
    setCreating(true);
    try {
      const data = await storageService.createShareToken(artifactId, expiresSec);
      setShare(data);
      console.info('[ShareModal] Share created:', { token: data.token });
      toast.success(tx('shareCreated'));
    } catch (error) {
      console.error('[ShareModal] Create failed:', { artifactId, error });
      toast.error(tx('shareCreateFailed'));
    } finally {
      setCreating(false);
    }
  }, [artifactId, expiresSec, tx]);

  const handleRevoke = useCallback(async () => {
    if (!share?.token) return;
    console.info('[ShareModal] Revoking share token:', { token: share.token });
    setRevoking(true);
    try {
      await storageService.revokeShareToken(share.token);
      console.info('[ShareModal] Share revoked');
      toast.success(tx('shareRevoked'));
      setShare(null);
    } catch (error) {
      console.error('[ShareModal] Revoke failed:', error);
      toast.error(tx('shareRevokeFailed'));
    } finally {
      setRevoking(false);
    }
  }, [share?.token, tx]);

  const handleCopy = useCallback(async () => {
    if (!share) return;
    const url = buildShareUrl(share);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t('common.copied'));
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.warn('[ShareModal] Clipboard write failed:', error);
      toast.error(tx('copyFailed'));
    }
  }, [share, buildShareUrl, t, tx]);

  const shareUrl = share ? buildShareUrl(share) : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-muted bg-gray-0 p-5 shadow-2xl dark:bg-gray-50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PiShareNetworkBold className="h-5 w-5 text-primary" />
            <Title as="h4" className="text-base font-semibold">
              {tx('shareFile')}
            </Title>
          </div>
          <ActionIcon variant="text" size="sm" onClick={onClose}>
            <PiXBold className="h-4 w-4" />
          </ActionIcon>
        </div>

        <Text className="mb-4 truncate text-xs text-gray-500" title={filename}>
          {filename}
        </Text>

        {/* Body */}
        {!share ? (
          <>
            <Text className="mb-2 text-xs font-semibold uppercase text-gray-500">
              {tx('expiresIn')}
            </Text>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {EXPIRY_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setExpiresSec(preset.value)}
                  className={cn(
                    'rounded-md border px-3 py-2 text-xs font-medium transition-colors',
                    expiresSec === preset.value
                      ? 'border-primary bg-primary text-white'
                      : 'border-muted bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-100 dark:text-gray-300'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <Button
              className="w-full gap-2"
              onClick={handleCreate}
              isLoading={creating}
              disabled={creating}
            >
              <PiLinkSimpleBold className="h-4 w-4" />
              {tx('createLink')}
            </Button>
          </>
        ) : (
          <>
            {/* URL display */}
            <Text className="mb-2 text-xs font-semibold uppercase text-gray-500">
              {tx('shareLink')}
            </Text>
            <div className="mb-3 flex items-center gap-2 rounded-md border border-muted bg-gray-50 p-2 dark:bg-gray-100">
              <code className="flex-1 truncate text-xs text-gray-700 dark:text-gray-300" title={shareUrl}>
                {shareUrl}
              </code>
              <ActionIcon size="sm" variant="outline" onClick={handleCopy}>
                {copied ? (
                  <PiCheckBold className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <PiCopyBold className="h-3.5 w-3.5" />
                )}
              </ActionIcon>
            </div>

            {share.expires_at && (
              <Text className="mb-4 text-xs text-gray-500">
                {tx('expiresAt')}: {new Date(share.expires_at).toLocaleString()}
              </Text>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-1.5 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                onClick={handleRevoke}
                isLoading={revoking}
              >
                <PiTrashBold className="h-3.5 w-3.5" />
                {tx('revokeLink')}
              </Button>
              <Button className="flex-1" onClick={onClose}>
                {t('common.close')}
              </Button>
            </div>
          </>
        )}

        {creating && !share && (
          <div className="mt-3 flex justify-center">
            <Loader size="sm" />
          </div>
        )}
      </div>
    </div>
  );
}
