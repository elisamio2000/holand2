/**
 * Shared messaging helpers — upload, WebSocket discovery, user directory.
 */
import { gatewayClient } from '@/lib/api-client';
import { withGateway429Retry } from '@/lib/gateway-retry';
import { dedupeAsync } from '@/utils/async-dedup';
import { messengerQueue } from '@/utils/request-queue';
import { adminService } from '@/services/admin.service';
import { pluginsService } from '@/services/plugins.service';
import { formatMessengerApiError } from '@/utils/messenger-errors';
import {
  resolveMessengerRecipientId,
  isMessengerUserUuid,
} from '@/app/shared/bug-reporter/config/support-config';
import type { UserSummary } from '@/types/messages.types';
import type { UploadResponse } from '@/types/storage.types';
import { unwrapMessengerData } from '@/utils/messages-normalize';
import {
  getMessagesMockMode,
  isMockMessagesActive,
  setMockMessagesActive,
} from '@/app/shared/messages/mock/messages-mock-bridge';

export type MessagingUploadContext = 'mail' | 'user_chat';

let wsInfoUnavailable = false;
let wsInfoCache: Record<string, unknown> | null = null;

export async function messagingGateway<T>(label: string, fn: () => Promise<T>): Promise<T> {
  return messengerQueue.enqueue(label, () => withGateway429Retry(fn, label));
}

export async function executeMessagingTool<T>(
  toolId: string,
  args: Record<string, unknown>
): Promise<T> {
  const result = await messagingGateway(`messaging-tool:${toolId}`, () =>
    pluginsService.executeTool(toolId, args)
  );
  return result as T;
}

export async function withMessagingApi<T>(
  apiCall: () => Promise<T>,
  mockCall: () => T
): Promise<T> {
  const mode = getMessagesMockMode();
  if (mode === 'only') {
    setMockMessagesActive(true);
    return mockCall();
  }
  try {
    const result = await apiCall();
    setMockMessagesActive(false);
    return result;
  } catch (error) {
    if (mode === 'fallback') {
      console.warn('[MessagingShared] Gateway failed — mock fallback.', error);
      setMockMessagesActive(true);
      return mockCall();
    }
    throw formatMessengerApiError(error);
  }
}

export function isMessagesUsingMockData(): boolean {
  return isMockMessagesActive();
}

/**
 * Normalize compose/search tokens to a directory user id before send.
 * Resolves username/email slugs via admin directory when needed.
 */
export async function ensureMessagingRecipientId(token: string): Promise<string> {
  const trimmed = resolveMessengerRecipientId(token);
  if (!trimmed) {
    throw new Error('Messenger: recipient is required');
  }
  if (isMessengerUserUuid(trimmed)) {
    return trimmed;
  }
  const resolved = await resolveDirectoryUser(trimmed);
  if (resolved?.id && isMessengerUserUuid(resolved.id)) {
    return resolved.id;
  }
  throw new Error(
    'Messenger: invalid recipient — pick a user from directory search (UUID required)'
  );
}

export async function uploadMessagingAttachment(
  file: File,
  context: MessagingUploadContext,
  onProgress?: (pct: number) => void
): Promise<{ artifactId: string; name: string; mime_type: string; size: number }> {
  const formData = new FormData();
  formData.append('files', file);
  formData.append('context', context);

  const res = await gatewayClient.post<UploadResponse>('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 5 * 60 * 1000,
    onUploadProgress: (e) => {
      if (e.total && onProgress) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  });

  const payload = res.data;
  let artifactId = '';
  let name = file.name;
  let mime_type = file.type;
  let size = file.size;

  const uploaded = payload?.uploaded?.[0];
  if (uploaded) {
    artifactId = uploaded.id;
    name = uploaded.filename ?? file.name;
    mime_type = uploaded.mime_type ?? file.type;
    size = uploaded.file_size ?? file.size;
  }

  if (!artifactId) {
    throw new Error('Upload succeeded but no artifact id returned');
  }

  return { artifactId, name, mime_type, size };
}

export async function getUserChatWsInfo(): Promise<Record<string, unknown>> {
  if (wsInfoUnavailable) {
    throw new Error('User chat ws-info unavailable (cached failure)');
  }
  if (wsInfoCache) return wsInfoCache;

  return dedupeAsync('user-chat:ws-info', async () => {
    try {
      const res = await messagingGateway('user-chat:ws-info', () =>
        gatewayClient.get<Record<string, unknown>>('/user-chat/ws-info')
      );
      wsInfoCache = res.data;
      return res.data;
    } catch (err) {
      wsInfoUnavailable = true;
      wsInfoCache = null;
      throw err;
    }
  });
}

export function resetWsInfoUnavailable(): void {
  wsInfoUnavailable = false;
  wsInfoCache = null;
}

export function isWsInfoUnavailable(): boolean {
  return wsInfoUnavailable;
}

export async function searchDirectoryUsers(query: string, limit = 8): Promise<UserSummary[]> {
  const users = await adminService.searchUsers(query, limit);
  return users
    .filter((u) => u.is_active !== false)
    .map((u) => mapAdminUserToSummary(u));
}

export async function resolveDirectoryUser(userId: string): Promise<UserSummary | null> {
  const trimmed = resolveMessengerRecipientId(userId);
  if (!trimmed) return null;

  if (isMessengerUserUuid(trimmed)) {
    try {
      const user = await adminService.getUserById(trimmed);
      if (user.is_active === false) return null;
      return mapAdminUserToSummary(user);
    } catch {
      /* fall through */
    }
  }

  try {
    const users = await adminService.searchUsers(trimmed, 8);
    const matches = users
      .filter((u) => u.is_active !== false)
      .map((u) => mapAdminUserToSummary(u));
    return (
      matches.find(
        (u) =>
          u.id === trimmed ||
          u.name?.toLowerCase() === trimmed.toLowerCase() ||
          u.email?.toLowerCase() === trimmed.toLowerCase()
      ) ??
      matches[0] ??
      { id: trimmed, name: trimmed }
    );
  } catch {
    return { id: trimmed, name: trimmed };
  }
}

export { unwrapMessengerData };

function mapAdminUserToSummary(u: {
  id: string;
  username: string;
  email?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}): UserSummary {
  return {
    id: u.id,
    name: u.display_name?.trim() || u.username,
    email: u.email ?? undefined,
    avatar: u.avatar_url ?? undefined,
  };
}
