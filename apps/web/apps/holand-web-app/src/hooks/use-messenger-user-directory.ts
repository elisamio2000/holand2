'use client';

import { adminService } from '@/services/admin.service';
import { dedupeAsync } from '@/utils/async-dedup';
import type { BatchResolveUserInfo } from '@/types/auth.types';
import type { MessageItem, UserSummary } from '@/types/messages.types';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const globalDirectoryCache = new Map<string, UserSummary>();
const RESOLVE_DEBOUNCE_MS = 200;
const directoryListeners = new Set<() => void>();

export function isUuidLike(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function truncateUuidDisplay(id: string): string {
  const trimmed = id.trim();
  if (!isUuidLike(trimmed)) return trimmed;
  return `${trimmed.slice(0, 8)}…`;
}

export function userNeedsNameHydration(user: UserSummary): boolean {
  const name = user.name?.trim() ?? '';
  if (!name) return true;
  if (name === user.id) return true;
  return isUuidLike(name);
}

export function displayNameFromResolveInfo(id: string, info: BatchResolveUserInfo | string): string {
  if (typeof info === 'string') {
    if (info && info !== id && !isUuidLike(info)) return info;
    return truncateUuidDisplay(id);
  }
  if (info.display_name?.trim()) return info.display_name.trim();
  const parts = [info.first_name, info.last_name].filter(Boolean).join(' ').trim();
  if (parts) return parts;
  if (info.username && !isUuidLike(info.username)) return info.username;
  if (info.email) return info.email.split('@')[0] ?? info.email;
  return truncateUuidDisplay(id);
}

export function hydrateUserSummary(
  user: UserSummary,
  directory: Map<string, UserSummary>
): UserSummary {
  if (!userNeedsNameHydration(user)) return user;
  const resolved = directory.get(user.id);
  if (resolved && !userNeedsNameHydration(resolved)) {
    return {
      ...user,
      name: resolved.name,
      email: resolved.email ?? user.email,
      avatar: resolved.avatar ?? user.avatar,
    };
  }
  if (user.email && !isUuidLike(user.email)) {
    return { ...user, name: user.email.split('@')[0] ?? user.email };
  }
  if (userNeedsNameHydration(user)) {
    return { ...user, name: truncateUuidDisplay(user.name || user.id) };
  }
  return user;
}

export function hydrateMessageItem<T extends MessageItem>(
  message: T,
  directory: Map<string, UserSummary>
): T {
  return {
    ...message,
    from: hydrateUserSummary(message.from, directory),
    to: hydrateUserSummary(message.to, directory),
  };
}

export function collectUnresolvedUserIds(
  messages: MessageItem[],
  currentUserId?: string,
  extraPartnerIds?: string[]
): string[] {
  const ids = new Set<string>();
  for (const msg of messages) {
    if (userNeedsNameHydration(msg.from)) ids.add(msg.from.id);
    if (userNeedsNameHydration(msg.to)) ids.add(msg.to.id);
  }
  for (const id of extraPartnerIds ?? []) {
    if (id) ids.add(id);
  }
  if (currentUserId) ids.delete(currentUserId);
  return Array.from(ids).filter((id) => {
    const cached = globalDirectoryCache.get(id);
    return !cached || userNeedsNameHydration(cached);
  });
}

/** Seed the shared directory cache (e.g. from resolveDirectoryUser). */
export function seedMessengerDirectoryUser(user: UserSummary): void {
  if (!user.id) return;
  const rawName = user.name?.trim() ?? '';
  const name = userNeedsNameHydration(user)
    ? user.email && !isUuidLike(user.email)
      ? (user.email.split('@')[0] ?? user.email)
      : truncateUuidDisplay(rawName || user.id)
    : rawName;
  globalDirectoryCache.set(user.id, {
    id: user.id,
    name,
    email: user.email,
    avatar: user.avatar,
  });
  directoryListeners.forEach((fn) => fn());
}

export function getMessengerDirectorySnapshot(): Map<string, UserSummary> {
  return new Map(globalDirectoryCache);
}

export function subscribeMessengerDirectoryUpdates(listener: () => void): () => void {
  directoryListeners.add(listener);
  return () => {
    directoryListeners.delete(listener);
  };
}

const pendingGlobalIds = new Set<string>();
let globalResolveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleGlobalResolve(): void {
  if (globalResolveTimer) clearTimeout(globalResolveTimer);
  globalResolveTimer = setTimeout(() => {
    globalResolveTimer = null;
    const pending = [...pendingGlobalIds].filter((id) => {
      const cached = globalDirectoryCache.get(id);
      return !cached || userNeedsNameHydration(cached);
    });
    pendingGlobalIds.clear();
    if (pending.length === 0) return;
    const dedupeKey = `resolve-users:${pending.sort().join(',')}`;
    void dedupeAsync(dedupeKey, () => adminService.resolveUsers(pending)).then((map) => {
      for (const [id, info] of Object.entries(map)) {
        globalDirectoryCache.set(id, {
          id,
          name: displayNameFromResolveInfo(id, info),
          email: typeof info === 'object' ? info.email : undefined,
        });
      }
      for (const id of pending) {
        const cached = globalDirectoryCache.get(id);
        if (!cached || userNeedsNameHydration(cached)) {
          globalDirectoryCache.set(id, { id, name: truncateUuidDisplay(id) });
        }
      }
      directoryListeners.forEach((fn) => fn());
    });
  }, RESOLVE_DEBOUNCE_MS);
}

export function registerDirectoryUserIds(ids: string[]): void {
  for (const id of ids) {
    if (id) pendingGlobalIds.add(id);
  }
  scheduleGlobalResolve();
}

export {
  MessengerDirectoryProvider,
  useMessengerUserDirectory,
  useRegisterDirectoryUserIds,
} from './messenger-directory-provider';

export function resolveDisplayName(
  user: UserSummary,
  directory: Map<string, UserSummary>
): string {
  return hydrateUserSummary(user, directory).name;
}
