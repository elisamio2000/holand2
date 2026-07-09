import { chatService } from '@/services/chat.service';
import type {
  ChatImportResult,
  ChatProject,
  ChatSearchHit,
  ChatSearchRequest,
  ChatSessionFolder,
} from '@/types/chat.types';
import { foldersDevStore } from './dev-stores/folders-dev-store';
import { projectsDevStore } from './dev-stores/projects-dev-store';
import { isRouteMissing } from './chat-feature-probe';

export type ChatFeatureKey =
  | 'folders'
  | 'projects'
  | 'search'
  | 'import'
  | 'exportAll';

export type ChatFeatureAvailability = 'unknown' | 'available' | 'unavailable';

export type ChatFeatureHealthMap = Record<ChatFeatureKey, ChatFeatureAvailability>;

export function isChatDevFallbackEnabled(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function canUseDevFallback(
  feature: ChatFeatureKey,
  health: ChatFeatureHealthMap
): boolean {
  return isChatDevFallbackEnabled() && health[feature] === 'unavailable';
}

// ——— Folders ———

export async function listFoldersAdapter(
  health: ChatFeatureHealthMap
): Promise<ChatSessionFolder[]> {
  if (health.folders === 'available') {
    const list = await chatService.listSessionFolders();
    if (list.length > 0) return list;
  }
  if (canUseDevFallback('folders', health)) return foldersDevStore.list();
  return [];
}

export async function createFolderAdapter(
  health: ChatFeatureHealthMap,
  body: { name: string; color?: string }
): Promise<ChatSessionFolder> {
  if (health.folders === 'available') {
    try {
      return await chatService.createSessionFolder(body);
    } catch (error: unknown) {
      if (!isChatDevFallbackEnabled() || !isRouteMissing(error)) throw error;
    }
  }
  if (canUseDevFallback('folders', health) || isChatDevFallbackEnabled()) {
    return foldersDevStore.create(body);
  }
  throw new Error('Folders API unavailable');
}

export async function updateFolderAdapter(
  health: ChatFeatureHealthMap,
  id: string,
  patch: { name?: string; color?: string }
): Promise<ChatSessionFolder> {
  if (health.folders === 'available') {
    try {
      return await chatService.updateSessionFolder(id, patch);
    } catch (error: unknown) {
      if (!isChatDevFallbackEnabled() || !isRouteMissing(error)) throw error;
    }
  }
  if (canUseDevFallback('folders', health) || isChatDevFallbackEnabled()) {
    return foldersDevStore.update(id, patch);
  }
  throw new Error('Folders API unavailable');
}

export async function deleteFolderAdapter(
  health: ChatFeatureHealthMap,
  id: string
): Promise<void> {
  if (health.folders === 'available') {
    try {
      await chatService.deleteSessionFolder(id);
      return;
    } catch (error: unknown) {
      if (!isChatDevFallbackEnabled() || !isRouteMissing(error)) throw error;
    }
  }
  if (canUseDevFallback('folders', health) || isChatDevFallbackEnabled()) {
    foldersDevStore.delete(id);
    return;
  }
  throw new Error('Folders API unavailable');
}

export async function moveSessionToFolderAdapter(
  health: ChatFeatureHealthMap,
  sessionId: string,
  folderId: string | null
): Promise<void> {
  if (health.folders === 'available') {
    try {
      await chatService.moveSessionToFolder(sessionId, folderId);
      return;
    } catch (error: unknown) {
      if (!isChatDevFallbackEnabled() || !isRouteMissing(error)) throw error;
    }
  }
  if (canUseDevFallback('folders', health)) {
    const { sessionFolderDevStore } = await import('./dev-stores/session-folder-dev-store');
    sessionFolderDevStore.assign(sessionId, folderId);
    return;
  }
  throw new Error('Folders API unavailable');
}

// ——— Projects ———

export async function listProjectsAdapter(
  health: ChatFeatureHealthMap
): Promise<ChatProject[]> {
  if (health.projects === 'available') {
    const list = await chatService.listChatProjects();
    if (list.length > 0) return list;
  }
  if (canUseDevFallback('projects', health)) return projectsDevStore.list();
  return [];
}

export async function createProjectAdapter(
  health: ChatFeatureHealthMap,
  body: Partial<ChatProject> & { name: string }
): Promise<ChatProject> {
  if (health.projects === 'available') {
    try {
      return await chatService.createChatProject(body);
    } catch (error: unknown) {
      if (!isChatDevFallbackEnabled() || !isRouteMissing(error)) throw error;
    }
  }
  if (canUseDevFallback('projects', health)) return projectsDevStore.create(body);
  throw new Error('Projects API unavailable');
}

export async function updateProjectAdapter(
  health: ChatFeatureHealthMap,
  id: string,
  patch: Partial<ChatProject>
): Promise<ChatProject> {
  if (health.projects === 'available') {
    try {
      return await chatService.updateChatProject(id, patch);
    } catch (error: unknown) {
      if (!isChatDevFallbackEnabled() || !isRouteMissing(error)) throw error;
    }
  }
  if (canUseDevFallback('projects', health)) return projectsDevStore.update(id, patch);
  throw new Error('Projects API unavailable');
}

export async function deleteProjectAdapter(
  health: ChatFeatureHealthMap,
  id: string
): Promise<void> {
  if (health.projects === 'available') {
    try {
      await chatService.deleteChatProject(id);
      return;
    } catch (error: unknown) {
      if (!isChatDevFallbackEnabled() || !isRouteMissing(error)) throw error;
    }
  }
  if (canUseDevFallback('projects', health)) {
    projectsDevStore.delete(id);
    return;
  }
  throw new Error('Projects API unavailable');
}

export async function assignSessionToProjectAdapter(
  health: ChatFeatureHealthMap,
  sessionId: string,
  projectId: string | null
): Promise<void> {
  if (health.projects === 'available') {
    try {
      await chatService.assignSessionToProject(sessionId, projectId);
      return;
    } catch (error: unknown) {
      if (!isChatDevFallbackEnabled() || !isRouteMissing(error)) throw error;
    }
  }
  if (canUseDevFallback('projects', health)) {
    projectsDevStore.assignSession(sessionId, projectId);
    return;
  }
  throw new Error('Projects API unavailable');
}

// ——— Search ———

export async function searchChatAdapter(
  health: ChatFeatureHealthMap,
  body: ChatSearchRequest
): Promise<ChatSearchHit[]> {
  if (health.search === 'available') {
    const hits = await chatService.searchChat(body);
    if (hits.length > 0) return hits;
  }
  return [];
}

// ——— Import ———

export async function importBackupAdapter(
  health: ChatFeatureHealthMap,
  file: File
): Promise<ChatImportResult> {
  if (health.import === 'available') {
    return chatService.importSessionsBackup(file);
  }
  if (canUseDevFallback('import', health)) {
    const { parseAndImportBackupZip } = await import('./dev-stores/import-dev-parser');
    return parseAndImportBackupZip(file);
  }
  throw new Error('Import API unavailable');
}

// ——— Export all ———

export async function exportAllSessionsAdapter(
  health: ChatFeatureHealthMap,
  params?: { format?: string; include_files?: boolean }
): Promise<Blob | null> {
  if (health.exportAll !== 'available') return null;
  try {
    return await chatService.exportAllSessions(params);
  } catch {
    return null;
  }
}
