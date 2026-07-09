import type { ChatApiEndpointStatus } from '@/hooks/use-chat-api-health';
import type { LiveApiRequirement } from '@/platform/dev-panels';

export type ChatApiRequirementStatus = 'live' | 'partial' | 'missing';

export type ChatApiGroup =
  | 'core'
  | 'messages'
  | 'stream'
  | 'organization'
  | 'surface'
  | 'share'
  | 'storage'
  | 'memory'
  | 'tools'
  | 'traces'
  | 'models'
  | 'export';

export interface ChatApiRequirement extends LiveApiRequirement {
  status: ChatApiRequirementStatus;
  group: ChatApiGroup;
  /** When set, merged with live probe from useChatApiHealth */
  healthKey?: 'memory' | 'tools' | 'feedback';
}

/** Display order for grouped live API sections in dev panel. */
export const CHAT_API_GROUP_ORDER: ChatApiGroup[] = [
  'core',
  'stream',
  'messages',
  'organization',
  'surface',
  'share',
  'storage',
  'memory',
  'tools',
  'traces',
  'models',
  'export',
];

/** APIs actively used by AI Chat — for dev panel "APIs in use" section. */
export const CHAT_API_REQUIREMENTS: ChatApiRequirement[] = [
  // —— core ——
  {
    id: 'sessions-list',
    group: 'core',
    endpoint: 'GET /chat/sessions?folder_id=&chat_mode=&surface=&anchor_key=',
    status: 'live',
    consumer: 'use-chat.ts',
  },
  {
    id: 'sessions-list-filters',
    group: 'core',
    endpoint: 'GET /chat/sessions?folder_id=&chat_mode=&surface=',
    status: 'live',
    consumer: 'use-chat.ts',
  },
  {
    id: 'sessions-create',
    group: 'core',
    endpoint: 'POST /chat/sessions (chat_mode, surface, anchor_key, is_dock_session)',
    status: 'live',
    consumer: 'use-chat.ts',
  },
  {
    id: 'sessions-create-scoped',
    group: 'core',
    endpoint: 'POST /chat/sessions body: chat_mode,surface,anchor_key',
    status: 'live',
    consumer: 'use-chat-dock.ts',
  },
  {
    id: 'session-get',
    group: 'core',
    endpoint: 'GET /chat/sessions/{session_id}',
    status: 'live',
    consumer: 'use-chat.ts',
  },
  {
    id: 'session-patch',
    group: 'core',
    endpoint: 'PATCH /chat/sessions/{session_id} (title, pin, archive, folder_id, project_id)',
    status: 'live',
    consumer: 'use-chat.ts',
  },
  {
    id: 'session-delete',
    group: 'core',
    endpoint: 'DELETE /chat/sessions/{session_id}',
    status: 'live',
    consumer: 'use-chat.ts',
  },
  {
    id: 'session-fork',
    group: 'core',
    endpoint: 'POST /chat/sessions/{session_id}/fork',
    status: 'live',
    consumer: 'use-chat.ts',
  },
  // —— stream ——
  {
    id: 'stream',
    group: 'stream',
    endpoint: 'POST /chat/stream (SSE)',
    status: 'live',
    consumer: 'use-chat.ts',
  },
  {
    id: 'native-chat-stream',
    group: 'stream',
    endpoint: 'POST /chat/stream (floating native dock)',
    status: 'live',
    consumer: 'floating-native-ai-chat.tsx',
  },
  {
    id: 'chat-model-override',
    group: 'stream',
    endpoint: 'POST /chat/stream body.model',
    status: 'live',
    consumer: 'use-chat.ts',
  },
  // —— messages ——
  {
    id: 'messages',
    group: 'messages',
    endpoint: 'GET /chat/sessions/{session_id}/messages?include_tool_runs=',
    status: 'live',
    consumer: 'use-chat.ts',
  },
  {
    id: 'messages-clear',
    group: 'messages',
    endpoint: 'DELETE /chat/sessions/{session_id}/messages',
    status: 'live',
    consumer: 'use-chat.ts',
  },
  {
    id: 'message-patch',
    group: 'messages',
    endpoint: 'PATCH /chat/messages/{message_id} (timeline metadata)',
    status: 'live',
    consumer: 'use-chat.ts',
  },
  // —— organization ——
  {
    id: 'session-folders',
    group: 'organization',
    endpoint: 'GET/POST/PATCH/DELETE /chat/sessions/folders',
    status: 'live',
    consumer: 'use-session-folders.ts',
  },
  {
    id: 'folders-bootstrap',
    group: 'organization',
    endpoint: 'POST /chat/sessions/folders/bootstrap',
    status: 'live',
    consumer: 'use-session-folders.ts',
  },
  {
    id: 'chat-projects',
    group: 'organization',
    endpoint: 'GET/POST/PATCH/DELETE /chat/projects',
    status: 'live',
    consumer: 'use-chat-projects.ts',
  },
  // —— surface / dock ——
  {
    id: 'sessions-dock-get',
    group: 'surface',
    endpoint: 'GET /chat/sessions/dock?surface=&anchor_key=',
    status: 'live',
    consumer: 'use-chat-dock.ts (getDockSession)',
  },
  {
    id: 'sessions-dock-create',
    group: 'surface',
    endpoint: 'POST /chat/sessions/dock',
    status: 'live',
    consumer: 'use-chat-dock.ts (getOrCreateDockSession)',
  },
  {
    id: 'sessions-promote-dock',
    group: 'surface',
    endpoint: 'POST /chat/sessions/{id}/promote-dock',
    status: 'live',
    consumer: 'use-chat-dock.ts',
  },
  {
    id: 'sessions-branches',
    group: 'surface',
    endpoint: 'GET /chat/sessions/{session_id}/branches',
    status: 'live',
    consumer: 'chat.service.ts (listSessionBranches)',
  },
  {
    id: 'chat-surfaces-registry',
    group: 'surface',
    endpoint: 'GET /chat/surfaces',
    status: 'live',
    consumer: 'use-chat-feature-health.ts (probeFeatureHealth)',
  },
  // —— share ——
  {
    id: 'share-public',
    group: 'share',
    endpoint: 'POST /storage/chat/sessions/{session_id}/share',
    status: 'live',
    consumer: 'share-session-modal.tsx',
  },
  {
    id: 'share-users',
    group: 'share',
    endpoint: 'POST/GET/DELETE /chat/sessions/{session_id}/shares',
    status: 'live',
    consumer: 'share-session-modal.tsx',
  },
  {
    id: 'share-shared-with-me',
    group: 'share',
    endpoint: 'GET /chat/sessions/shared-with-me',
    status: 'live',
    consumer: 'use-shared-with-me-sessions.ts',
  },
  {
    id: 'share-public-viewer',
    group: 'share',
    endpoint: 'GET /storage/chat/shares/{token}/resolve + /messages',
    status: 'live',
    consumer: 'shared-chat-viewer.tsx',
  },
  // —— storage ——
  {
    id: 'upload-simple',
    group: 'storage',
    endpoint: 'POST /upload',
    status: 'live',
    consumer: 'chat.service.ts',
  },
  {
    id: 'upload-chunked-init',
    group: 'storage',
    endpoint: 'POST /storage/upload/init',
    status: 'live',
    consumer: 'chat.service.ts',
  },
  {
    id: 'upload-chunked-part',
    group: 'storage',
    endpoint: 'PUT /storage/upload/{upload_id}/chunk/{chunk_index}',
    status: 'live',
    consumer: 'chat.service.ts',
  },
  {
    id: 'upload-chunked-complete',
    group: 'storage',
    endpoint: 'POST /storage/upload/{upload_id}/complete',
    status: 'live',
    consumer: 'chat.service.ts',
  },
  {
    id: 'upload-chunked-cancel',
    group: 'storage',
    endpoint: 'DELETE /storage/upload/{upload_id}',
    status: 'live',
    consumer: 'chat.service.ts',
  },
  {
    id: 'artifacts-list',
    group: 'storage',
    endpoint: 'GET /storage/artifacts?session_id=',
    status: 'live',
    consumer: 'artifacts-panel.tsx',
  },
  {
    id: 'artifacts-delete',
    group: 'storage',
    endpoint: 'DELETE /storage/artifacts/{artifact_id}',
    status: 'live',
    consumer: 'artifacts-panel.tsx',
  },
  {
    id: 'artifacts-download',
    group: 'storage',
    endpoint: 'GET /storage/artifacts/{artifact_id}/download',
    status: 'live',
    consumer: 'file-preview-inline.tsx',
  },
  {
    id: 'files-thumbnail',
    group: 'storage',
    endpoint: 'GET /storage/files/{artifact_id}/thumbnail',
    status: 'live',
    consumer: 'chat.service.ts',
  },
  {
    id: 'files-presigned',
    group: 'storage',
    endpoint: 'GET /storage/files/{artifact_id}/presigned-url',
    status: 'live',
    consumer: 'resolve-storage-playback-url.ts',
  },
  // —— memory ——
  {
    id: 'memory-session',
    group: 'memory',
    endpoint: 'GET /memory/session/{session_id}',
    status: 'live',
    healthKey: 'memory',
    consumer: 'memory-panel.tsx',
  },
  {
    id: 'memory-user',
    group: 'memory',
    endpoint: 'GET /memory/user/{user_id}',
    status: 'live',
    healthKey: 'memory',
    consumer: 'memory-panel.tsx',
  },
  {
    id: 'memory-search',
    group: 'memory',
    endpoint: 'POST /memory/search',
    status: 'live',
    healthKey: 'memory',
    consumer: 'memory-panel.tsx',
  },
  {
    id: 'memory-clear-session',
    group: 'memory',
    endpoint: 'DELETE /memory/session/{session_id}',
    status: 'live',
    healthKey: 'memory',
    consumer: 'memory-panel.tsx',
  },
  {
    id: 'memory-clear-user',
    group: 'memory',
    endpoint: 'DELETE /memory/user/{user_id}',
    status: 'live',
    healthKey: 'memory',
    consumer: 'memory-panel.tsx',
  },
  // —— tools ——
  {
    id: 'tools',
    group: 'tools',
    endpoint: 'GET /tools',
    status: 'live',
    healthKey: 'tools',
    consumer: 'tools-panel.tsx',
  },
  // —— traces ——
  {
    id: 'traces-list',
    group: 'traces',
    endpoint: 'GET /traces?session_id=',
    status: 'live',
    consumer: 'use-chat.ts',
  },
  {
    id: 'traces-detail',
    group: 'traces',
    endpoint: 'GET /traces/{trace_id}',
    status: 'live',
    consumer: 'trace-panel.tsx',
  },
  {
    id: 'feedback',
    group: 'traces',
    endpoint: 'POST /feedback',
    status: 'live',
    healthKey: 'feedback',
    consumer: 'use-chat.ts',
  },
  // —— models ——
  {
    id: 'chat-models',
    group: 'models',
    endpoint: 'GET /chat/models',
    status: 'live',
    consumer: 'use-chat.ts',
  },
  {
    id: 'chat-models-fallback-admin',
    group: 'models',
    endpoint: 'GET /admin/llm/routes, /admin/llm/models (fallback)',
    status: 'partial',
    consumer: 'chat.service.ts loadChatModels',
  },
  {
    id: 'chat-models-fallback-openai',
    group: 'models',
    endpoint: 'GET /v1/models, /gpu/models (fallback)',
    status: 'partial',
    consumer: 'chat.service.ts loadChatModels',
  },
  // —— export ——
  {
    id: 'chat-search',
    group: 'export',
    endpoint: 'POST /chat/search',
    status: 'live',
    consumer: 'use-chat-search.ts',
  },
  {
    id: 'sessions-export-all',
    group: 'export',
    endpoint: 'GET /chat/sessions/export-all',
    status: 'live',
    consumer: 'bulk-backup-runner.ts',
  },
  {
    id: 'sessions-import',
    group: 'export',
    endpoint: 'POST /chat/sessions/import',
    status: 'live',
    consumer: 'bulk-backup-modal.tsx',
  },
];

export function resolveLiveApiStatus(
  req: ChatApiRequirement,
  health: {
    memory: ChatApiEndpointStatus;
    tools: ChatApiEndpointStatus;
    feedback: ChatApiEndpointStatus;
  }
): ChatApiEndpointStatus | ChatApiRequirementStatus {
  if (req.status === 'live') return 'live';
  if (!req.healthKey) return req.status;
  const probed = health[req.healthKey];
  if (probed === 'unknown') return req.status;
  return probed;
}

/** Groups requirements by domain for dev panel sections. */
export function groupChatApiRequirements(
  requirements: ChatApiRequirement[] = CHAT_API_REQUIREMENTS
): Map<ChatApiGroup, ChatApiRequirement[]> {
  const map = new Map<ChatApiGroup, ChatApiRequirement[]>();
  for (const req of requirements) {
    const list = map.get(req.group) ?? [];
    list.push(req);
    map.set(req.group, list);
  }
  return map;
}
