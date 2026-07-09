'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChatFeatureHealthMap } from '@/app/shared/ai-chat/adapters/chat-feature-adapter';
import {
  canUseDevFallback,
  createFolderAdapter,
  deleteFolderAdapter,
  isChatDevFallbackEnabled,
  listFoldersAdapter,
  moveSessionToFolderAdapter,
  updateFolderAdapter,
} from '@/app/shared/ai-chat/adapters/chat-feature-adapter';
import { sessionFolderDevStore } from '@/app/shared/ai-chat/adapters/dev-stores/session-folder-dev-store';
import { chatService } from '@/services/chat.service';
import type { ChatSessionFolder } from '@/types/chat.types';

const DEFAULT_PUBLIC_SLUG = 'default_public';

export function useSessionFolders(featureHealth: ChatFeatureHealthMap) {
  const [folders, setFolders] = useState<ChatSessionFolder[]>([]);
  const [defaultPublicFolderId, setDefaultPublicFolderId] = useState<string | null>(null);
  const [sessionFolderMap, setSessionFolderMap] = useState<Record<string, string | null>>({});
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      let list: ChatSessionFolder[] = [];
      if (featureHealth.folders === 'available') {
        try {
          const boot = await chatService.bootstrapFolders();
          list = boot.folders ?? [];
          setDefaultPublicFolderId(boot.default_public_folder_id ?? null);
        } catch (error: unknown) {
          console.warn('[useSessionFolders] bootstrap failed, falling back to list', error);
          list = await chatService.listSessionFolders();
        }
      } else {
        list = await listFoldersAdapter(featureHealth);
      }
      setFolders(list);
      setIsAvailable(
        featureHealth.folders === 'available' ||
          (isChatDevFallbackEnabled() &&
            (list.length > 0 || canUseDevFallback('folders', featureHealth)))
      );
      if (
        process.env.NODE_ENV === 'development' &&
        featureHealth.folders !== 'available'
      ) {
        setSessionFolderMap(sessionFolderDevStore.all());
      }
    } catch (error) {
      console.error('[useSessionFolders]', error);
      setFolders([]);
      setIsAvailable(false);
    } finally {
      setIsLoading(false);
    }
  }, [featureHealth]);

  const publicFolder = useMemo(
    () =>
      folders.find(
        (f) => f.slug === DEFAULT_PUBLIC_SLUG || (f.is_system && f.kind === 'system' && !f.slug?.startsWith('surface:'))
      ) ?? null,
    [folders]
  );

  const surfaceFolders = useMemo(
    () =>
      folders.filter(
        (f) =>
          f.is_system &&
          (f.slug?.startsWith('surface:') || (f.kind === 'system' && f.slug && f.slug !== DEFAULT_PUBLIC_SLUG))
      ),
    [folders]
  );

  const surfaceFoldersWithSessions = useMemo(
    () => surfaceFolders.filter((f) => (f.session_count ?? 0) > 0),
    [surfaceFolders]
  );

  const userFolders = useMemo(
    () => folders.filter((f) => !f.is_system && f.kind !== 'system'),
    [folders]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createFolder = useCallback(
    async (body: { name: string; color?: string }) => {
      const folder = await createFolderAdapter(featureHealth, body);
      await refresh();
      return folder;
    },
    [featureHealth, refresh]
  );

  const updateFolder = useCallback(
    async (id: string, patch: { name?: string; color?: string }) => {
      const folder = await updateFolderAdapter(featureHealth, id, patch);
      await refresh();
      return folder;
    },
    [featureHealth, refresh]
  );

  const deleteFolder = useCallback(
    async (id: string) => {
      await deleteFolderAdapter(featureHealth, id);
      if (activeFolderId === id) setActiveFolderId(null);
      await refresh();
    },
    [featureHealth, activeFolderId, refresh]
  );

  const moveSessionToFolder = useCallback(
    async (sessionId: string, folderId: string | null) => {
      const target =
        folderId ?? defaultPublicFolderId ?? publicFolder?.id ?? null;
      if (!target) {
        throw new Error('No folder available for session assignment');
      }
      await moveSessionToFolderAdapter(featureHealth, sessionId, target);
      if (
        process.env.NODE_ENV === 'development' &&
        featureHealth.folders !== 'available'
      ) {
        setSessionFolderMap(sessionFolderDevStore.all());
      }
    },
    [featureHealth, defaultPublicFolderId, publicFolder?.id]
  );

  const getSessionFolderId = useCallback(
    (sessionId: string, apiFolderId?: string | null) => {
      if (apiFolderId != null) return apiFolderId;
      return sessionFolderMap[sessionId] ?? null;
    },
    [sessionFolderMap]
  );

  return {
    folders,
    publicFolder,
    surfaceFolders,
    surfaceFoldersWithSessions,
    userFolders,
    defaultPublicFolderId,
    activeFolderId,
    setActiveFolderId,
    isLoading,
    isAvailable,
    refresh,
    createFolder,
    updateFolder,
    deleteFolder,
    moveSessionToFolder,
    getSessionFolderId,
  };
}
