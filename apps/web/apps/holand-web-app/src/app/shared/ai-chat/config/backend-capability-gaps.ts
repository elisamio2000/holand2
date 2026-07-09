// ============================================
// AI Chat — backend capability gaps for dev handoff panel
// Source of truth for gateway contract requests (FE → BE)
// ============================================

export type ChatBackendGapPriority = 'P0' | 'P1' | 'P2';

export type ChatUiSurface =
  | 'memory'
  | 'feedback'
  | 'tools'
  | 'sidebar'
  | 'messages'
  | 'stream'
  | 'share'
  | 'models'
  | 'search'
  | 'projects'
  | 'export';

export interface ChatBackendCapabilityGap {
  id: string;
  /** English capability label (i18n key: chatPage.devRequirements.gaps.{id}.capability) */
  capability: string;
  feWorkaround: string;
  requiredApi: string;
  feRequest: string;
  expectedResponse: string;
  acceptance: string;
  priority: ChatBackendGapPriority;
  blockedFeatures: string[];
  uiSurface: ChatUiSurface;
  resolved?: boolean;
  resolvedNote?: string;
}

export const CHAT_BACKEND_CAPABILITY_GAPS_RAW: ChatBackendCapabilityGap[] = [
  {
    id: 'message-trace-id',
    capability: 'Stable trace_id on assistant MessageResponse',
    feWorkaround:
      'N+1 GET /traces?session_id= + chronological heuristic to attach trace_id',
    requiredApi: 'MessageResponse.trace_id?: string',
    feRequest: `GET /chat/sessions/{session_id}/messages?limit=50
→ each assistant message SHOULD include trace_id`,
    expectedResponse: `{
  "id": "msg-uuid",
  "role": "assistant",
  "content": "...",
  "trace_id": "tr-uuid",
  "created_at": "2026-06-27T12:00:00Z"
}`,
    acceptance:
      'Every persisted assistant message returns trace_id; FE skips trace list heuristic',
    priority: 'P0',
    blockedFeatures: ['Reliable TracePanel', 'Thought Process replay after refresh'],
    uiSurface: 'messages',
  },
  {
    id: 'trace-message-id',
    capability: 'Stable message_id on Trace objects',
    feWorkaround: 'Order-based pairing when message_id missing on trace',
    requiredApi: 'TraceResponse.message_id: string',
    feRequest: `GET /traces?session_id={session_id}&limit=100
→ each trace MUST include message_id of the assistant reply`,
    expectedResponse: `{
  "trace_id": "tr-uuid",
  "session_id": "sess-uuid",
  "message_id": "msg-uuid",
  "started_at": "2026-06-27T12:00:00Z",
  "status": "completed"
}`,
    acceptance: 'trace.message_id always matches the assistant message that produced it',
    priority: 'P0',
    blockedFeatures: ['Correct trace ↔ message linking in history'],
    uiSurface: 'messages',
  },
  {
    id: 'message-feedback',
    capability: 'Per-message like/dislike feedback',
    feWorkaround: 'Optimistic UI only; POST /feedback returns 404 today',
    requiredApi: 'POST /feedback',
    feRequest: `POST /feedback
Content-Type: application/json
{
  "session_id": "sess-uuid",
  "message_id": "msg-uuid",
  "rating": 5,
  "comment": "optional"
}`,
    expectedResponse: `201 {
  "id": "fb-uuid",
  "session_id": "sess-uuid",
  "message_id": "msg-uuid",
  "rating": 5,
  "created_at": "ISO8601"
}`,
    acceptance: 'Like (5) and dislike (1) persist; reload shows same feedback state',
    priority: 'P1',
    blockedFeatures: ['MessageBubble thumbs up/down persistence'],
    uiSurface: 'feedback',
  },
  {
    id: 'memory-session',
    capability: 'Session-scoped AI memory list',
    feWorkaround: 'MemoryPanel shows empty/error on 404',
    requiredApi: 'GET /memory/session/{session_id}',
    feRequest: `GET /memory/session/{session_id}?limit=50`,
    expectedResponse: `200 [
  {
    "id": "mem-1",
    "content": "User prefers Persian responses",
    "tags": ["preference"],
    "scope": "session",
    "created_at": "ISO8601"
  }
]`,
    acceptance: 'Returns session memories for active chat; 404 → register route on gateway',
    priority: 'P1',
    blockedFeatures: ['MemoryPanel session tab'],
    uiSurface: 'memory',
  },
  {
    id: 'memory-user',
    capability: 'User-wide AI memory list',
    feWorkaround: 'MemoryPanel user tab empty on 404',
    requiredApi: 'GET /memory/user/{user_id}',
    feRequest: `GET /memory/user/{user_id}?limit=100`,
    expectedResponse: `200 [
  {
    "id": "mem-2",
    "content": "Works in finance domain",
    "tags": [],
    "scope": "user",
    "created_at": "ISO8601"
  }
]`,
    acceptance: 'User memories listed across all sessions for authenticated user',
    priority: 'P1',
    blockedFeatures: ['MemoryPanel user tab'],
    uiSurface: 'memory',
  },
  {
    id: 'memory-search',
    capability: 'Semantic memory search',
    feWorkaround: 'Client-side filter only',
    requiredApi: 'POST /memory/search',
    feRequest: `POST /memory/search
{
  "query": "project deadline",
  "user_id": "user-uuid",
  "session_id": "sess-uuid",
  "limit": 20
}`,
    expectedResponse: `200 [
  { "id": "mem-3", "content": "...", "score": 0.92, "scope": "session" }
]`,
    acceptance: 'Search returns ranked memories; empty query returns 400',
    priority: 'P2',
    blockedFeatures: ['MemoryPanel search box'],
    uiSurface: 'memory',
  },
  {
    id: 'memory-clear-session',
    capability: 'Clear session memory',
    feWorkaround: 'Delete button no-ops on 404',
    requiredApi: 'DELETE /memory/session/{session_id}',
    feRequest: `DELETE /memory/session/{session_id}`,
    expectedResponse: `204 No Content`,
    acceptance: 'All session-scoped memories removed; GET returns []',
    priority: 'P1',
    blockedFeatures: ['Clear session memory action'],
    uiSurface: 'memory',
  },
  {
    id: 'memory-clear-user',
    capability: 'Clear all user memory',
    feWorkaround: 'Delete all button no-ops on 404',
    requiredApi: 'DELETE /memory/user/{user_id}',
    feRequest: `DELETE /memory/user/{user_id}`,
    expectedResponse: `204 No Content`,
    acceptance: 'All user memories removed',
    priority: 'P2',
    blockedFeatures: ['Clear all memory action'],
    uiSurface: 'memory',
  },
  {
    id: 'tools-list',
    capability: 'List available AI tools for chat',
    feWorkaround: 'ToolsPanel shows error state',
    requiredApi: 'GET /tools',
    feRequest: `GET /tools`,
    expectedResponse: `200 [
  {
    "id": "plugin_web_search",
    "name": "Web Search",
    "description": "...",
    "category": "search",
    "capabilities": ["search"]
  }
]`,
    acceptance: 'Array of tools with id, name, description, category',
    priority: 'P1',
    blockedFeatures: ['ChatInput Tools panel catalog'],
    uiSurface: 'tools',
  },
  {
    id: 'messages-include-tool-runs',
    capability: 'Embed tool_runs in message list',
    feWorkaround: 'Separate GET /traces per assistant message (capped to 5)',
    requiredApi: 'GET /chat/sessions/{id}/messages?include_tool_runs=true',
    feRequest: `GET /chat/sessions/{session_id}/messages?limit=50&include_tool_runs=true`,
    expectedResponse: `200 [
  {
    "id": "msg-uuid",
    "role": "assistant",
    "content": "...",
    "trace_id": "tr-uuid",
    "tool_runs": [
      {
        "tool_id": "plugin_web_search",
        "tool_name": "Web Search",
        "ok": true,
        "result": { "summary": "..." }
      }
    ]
  }
]`,
    acceptance: 'tool_runs populated on assistant messages; FE skips trace enrichment',
    priority: 'P1',
    blockedFeatures: ['Fast Thought Process load', 'Tool run history without N+1'],
    uiSurface: 'messages',
  },
  {
    id: 'attachment-mime-type',
    capability: 'mime_type and size on message attachments',
    feWorkaround: 'inferMimeType() from filename extension',
    requiredApi: 'attachments[] on MessageResponse',
    feRequest: `GET /chat/sessions/{id}/messages
→ attachments[].mime_type and attachments[].size required`,
    expectedResponse: `"attachments": [
  {
    "id": "art-uuid",
    "name": "report.pdf",
    "path": "art-uuid",
    "mime_type": "application/pdf",
    "size": 1048576
  }
]`,
    acceptance: 'Video/audio/image previews work without client inference',
    priority: 'P1',
    blockedFeatures: ['Correct file icons', 'Media preview in message bubbles'],
    uiSurface: 'messages',
  },
  {
    id: 'session-folders',
    capability: 'Session folders / labels',
    feWorkaround: 'Not implemented in sidebar',
    requiredApi: 'GET/POST /chat/sessions/folders + folder_id on session',
    feRequest: `POST /chat/sessions/folders/bootstrap
POST /chat/sessions/folders
{ "name": "Work", "color": "#3b82f6" }

PATCH /chat/sessions/{id}
{ "folder_id": "folder-uuid" }`,
    expectedResponse: `POST /chat/sessions/folders/bootstrap → 200 {
  "default_public_folder_id": "uuid",
  "folders": [{ "id": "...", "slug": "default_public", "kind": "system", "is_system": true }]
}
Session includes folder_id; no NULL folder_id`,
    acceptance: 'Sessions groupable in sidebar folders (public / from pages / user)',
    priority: 'P2',
    blockedFeatures: ['Sidebar folder organization'],
    uiSurface: 'sidebar',
    resolved: true,
    resolvedNote: 'Chat session organization wave — bootstrap + system folders (2026-07-04)',
  },
  {
    id: 'surface-dock-sessions',
    capability: 'Dock session per page anchor (native floating chat)',
    feWorkaround: 'Local React state + ephemeral session_id',
    requiredApi: 'GET/POST /chat/sessions/dock + POST promote-dock',
    feRequest: `POST /chat/sessions/dock
{ "surface": "offline_map", "anchor_key": "offline_map:case-42" }

POST /chat/sessions/{new_id}/promote-dock`,
    expectedResponse: `200 {
  "id": "sess-uuid",
  "chat_mode": "surface",
  "surface": "offline_map",
  "anchor_key": "offline_map:case-42",
  "is_dock_session": true,
  "folder_id": "surface-folder-uuid"
}`,
    acceptance: 'Opening floating chat resumes dock; new conversation demotes prior dock',
    priority: 'P0',
    blockedFeatures: ['Persistent native dock chat', 'Hub sidebar “from pages”'],
    uiSurface: 'sidebar',
    resolved: true,
    resolvedNote: 'Dock + anchor_key APIs in storage/gateway (2026-07-04)',
  },
  {
    id: 'system-folders-per-surface',
    capability: 'System folders default_public + surface:{id}',
    feWorkaround: 'Dev localStorage session-folder-dev-store',
    requiredApi: 'POST /chat/sessions/folders/bootstrap + lazy surface folders',
    feRequest: `POST /chat/sessions/folders/bootstrap`,
    expectedResponse: `200 {
  "default_public_folder_id": "uuid",
  "folders": [
    { "slug": "default_public", "kind": "system", "is_system": true },
    { "slug": "surface:offline_map", "kind": "system", "session_count": 2 }
  ]
}`,
    acceptance: 'Hub new chat → default_public; surface chats → surface:{id} folder',
    priority: 'P0',
    blockedFeatures: ['“From pages” sidebar section'],
    uiSurface: 'sidebar',
    resolved: true,
    resolvedNote: 'init-scripts/19 + bootstrap_folders (2026-07-04)',
  },
  {
    id: 'sessions-archived-only',
    capability: 'Server-side archived session filter',
    feWorkaround: 'Client filters is_archived after include_archived=true',
    requiredApi: 'GET /chat/sessions?archived_only=true',
    feRequest: `GET /chat/sessions?archived_only=true&limit=50`,
    expectedResponse: `200 [ { "id": "...", "is_archived": true, "title": "..." } ]`,
    acceptance: 'Only archived sessions returned; no client-side split needed',
    priority: 'P2',
    blockedFeatures: ['Efficient archived section in sidebar'],
    uiSurface: 'sidebar',
  },
  {
    id: 'sessions-bulk',
    capability: 'Bulk archive/delete sessions',
    feWorkaround: 'Multiple PATCH/DELETE calls from sidebar',
    requiredApi: 'POST /chat/sessions/bulk',
    feRequest: `POST /chat/sessions/bulk
{
  "action": "archive" | "delete" | "unarchive",
  "session_ids": ["uuid-1", "uuid-2"]
}`,
    expectedResponse: `200 { "processed": 2, "failed": [] }`,
    acceptance: 'Single round-trip for bulk sidebar operations',
    priority: 'P2',
    blockedFeatures: ['Fast bulk archive/delete'],
    uiSurface: 'sidebar',
  },
  {
    id: 'orchestrator-timeline-persist',
    capability: 'Persist thinkingSteps / executionPlan on message',
    feWorkaround: 'localStorage timeline cache (chat-timeline-cache.ts)',
    requiredApi: 'MessageResponse.metadata.orchestrator_timeline',
    feRequest: `GET /chat/sessions/{id}/messages
→ assistant messages include persisted timeline`,
    expectedResponse: `"metadata": {
  "thinking_steps": [{ "type": "thinking", "content": "...", "stepNumber": 1 }],
  "execution_plan": { "tasks": [...], "complexity": "medium" },
  "overall_confidence": 0.85
}`,
    acceptance: 'Thought Process survives refresh without localStorage',
    priority: 'P2',
    blockedFeatures: ['Cross-device Thought Process replay'],
    uiSurface: 'messages',
  },
  {
    id: 'stream-answer-start',
    capability: 'SSE status:answer_start lifecycle event',
    feWorkaround:
      'shouldShowStreamingAnswerBody() heuristic when event omitted',
    requiredApi: 'POST /chat/stream → status event type answer_start',
    feRequest: `SSE data: {"type":"status","type":"answer_start","trace_id":"..."}`,
    expectedResponse: `Mid-stream status with type=answer_start before answer tokens`,
    acceptance: 'Answer bubble visible as soon as final reply phase starts',
    priority: 'P1',
    blockedFeatures: ['Clear streaming UX during long tool/thinking phases'],
    uiSurface: 'stream',
  },
  {
    id: 'share-public-no-expiry',
    capability: 'Permanent (no-expiry) public share links',
    feWorkaround: 'UI offers "Never expires" but backend rejects expires_hours=0 today',
    requiredApi: 'POST /storage/chat/sessions/{id}/share (expires_hours=0 or expires_at=null)',
    feRequest: `POST /storage/chat/sessions/{session_id}/share?expires_hours=0
Content-Type: application/json
(optional body) { "expires_at": null }`,
    expectedResponse: `200 {
  "share_url": "https://app.example/ai-chat/shared/abc123",
  "share_id": "abc123",
  "expires_at": null
}`,
    acceptance: 'Never-expires chip generates link with expires_at=null; link valid until owner revokes',
    priority: 'P1',
    blockedFeatures: ['Permanent public share links', 'No-expiry chip in Share modal'],
    uiSurface: 'share',
  },
  {
    id: 'share-with-users',
    capability: 'Share session with specific users (in-app)',
    feWorkaround: 'People tab UI + user search; POST returns 404 until gateway implements',
    requiredApi: 'POST /chat/sessions/{session_id}/shares',
    feRequest: `POST /chat/sessions/{session_id}/shares
Content-Type: application/json
Authorization: Bearer {token}
{
  "recipient_user_ids": ["user-uuid-1", "user-uuid-2"],
  "permission": "read"
}`,
    expectedResponse: `201 {
  "shared": [
    {
      "user_id": "user-uuid-1",
      "display_name": "Jane Doe",
      "email": "jane@example.com",
      "permission": "read",
      "shared_at": "2026-06-27T12:00:00Z"
    }
  ],
  "failed": []
}`,
    acceptance: 'Recipients see session in Shared with me sidebar (read-only); owner can list/revoke',
    priority: 'P0',
    blockedFeatures: ['Share with person tab', 'In-app collaboration without public link'],
    uiSurface: 'share',
  },
  {
    id: 'share-list-recipients',
    capability: 'List users a session is shared with',
    feWorkaround: 'People tab shows empty list on 404',
    requiredApi: 'GET /chat/sessions/{session_id}/shares',
    feRequest: `GET /chat/sessions/{session_id}/shares
Authorization: Bearer {token}`,
    expectedResponse: `200 [
  {
    "user_id": "user-uuid-1",
    "display_name": "Jane Doe",
    "email": "jane@example.com",
    "permission": "read",
    "shared_at": "2026-06-27T12:00:00Z"
  }
]`,
    acceptance: 'People tab lists current recipients with revoke action',
    priority: 'P1',
    blockedFeatures: ['Manage shared users in Share modal'],
    uiSurface: 'share',
  },
  {
    id: 'share-revoke-user',
    capability: 'Revoke user access to a shared session',
    feWorkaround: 'Revoke button calls DELETE; toast on 404',
    requiredApi: 'DELETE /chat/sessions/{session_id}/shares/{user_id}',
    feRequest: `DELETE /chat/sessions/{session_id}/shares/{user_id}
Authorization: Bearer {token}`,
    expectedResponse: `204 No Content
(or) 200 { "revoked": true, "user_id": "user-uuid-1" }`,
    acceptance: 'Recipient loses access immediately; session removed from Shared with me',
    priority: 'P2',
    blockedFeatures: ['Revoke access in People tab'],
    uiSurface: 'share',
  },
  {
    id: 'share-shared-with-me',
    capability: 'List sessions shared with current user',
    feWorkaround: 'Sidebar section hidden when GET returns 404/empty',
    requiredApi: 'GET /chat/sessions/shared-with-me',
    feRequest: `GET /chat/sessions/shared-with-me?limit=50
Authorization: Bearer {token}`,
    expectedResponse: `200 [
  {
    "session_id": "sess-uuid",
    "title": "Project brainstorm",
    "shared_by": { "id": "owner-uuid", "name": "Alex" },
    "shared_at": "2026-06-27T10:00:00Z",
    "permission": "read"
  }
]`,
    acceptance: 'Sidebar Shared with me section; open session read-only',
    priority: 'P1',
    blockedFeatures: ['Shared with me sidebar section'],
    uiSurface: 'share',
  },
  {
    id: 'share-public-viewer',
    capability: 'Public read-only viewer for shared chat links',
    feWorkaround: 'Route /ai-chat/shared/[token] shell; resolve/messages 404 until BE ready',
    requiredApi: 'GET /storage/chat/shares/{token}/resolve + GET .../messages',
    feRequest: `GET /storage/chat/shares/{token}/resolve
(no auth)

GET /storage/chat/shares/{token}/messages?limit=100
(no auth)`,
    expectedResponse: `200 resolve {
  "session_id": "sess-uuid",
  "title": "Conversation title",
  "expires_at": null,
  "owner_display_name": "Alex",
  "message_count": 12
}

200 messages [
  { "id": "msg-uuid", "role": "user", "content": "...", "created_at": "..." },
  { "id": "msg-uuid", "role": "assistant", "content": "...", "created_at": "..." }
]`,
    acceptance: 'Public URL opens read-only conversation without sign-in; expired/revoked returns 410',
    priority: 'P1',
    blockedFeatures: ['Public share link viewer page'],
    uiSurface: 'share',
  },
  {
    id: 'chat-enabled-models',
    capability: 'Chat-enabled models list for user picker',
    feWorkaround:
      'Merge GET /v1/models + /gpu/models + admin route; dropdown when length > 1',
    requiredApi: 'GET /chat/models',
    feRequest: `GET /chat/models
Authorization: Bearer {token}`,
    expectedResponse: `200 {
  "default_model": "qwen3-14b",
  "models": [
    {
      "id": "qwen3-14b",
      "display_name": "Qwen3 14B",
      "context_length": 32768,
      "capabilities": ["chat", "tools"],
      "is_default": true
    }
  ]
}`,
    acceptance:
      'Only active chat-enabled models; default_model in list; FE uses as primary source',
    priority: 'P0',
    blockedFeatures: ['Model picker dropdown', 'Per-message model selection'],
    uiSurface: 'models',
  },
  {
    id: 'chat-search-cross-session',
    capability: 'Cross-session chat search (titles, messages, files)',
    feWorkaround: 'Client-side L1/L2 search in useChatSearch; L3 pending BE',
    requiredApi: 'POST /chat/search',
    feRequest: `POST /chat/search
{
  "query": "contract",
  "scope": "all",
  "session_ids": [],
  "limit": 50
}`,
    expectedResponse: `200 [
  {
    "session_id": "sess-uuid",
    "message_id": "msg-uuid",
    "snippet": "...matched text...",
    "score": 0.92,
    "type": "message"
  }
]`,
    acceptance: 'Ranked results; jump-to-message from search modal',
    priority: 'P1',
    blockedFeatures: ['Server-side cross-session search', 'File content search'],
    uiSurface: 'search',
  },
  {
    id: 'session-fork',
    capability: 'Fork session from a message (branch)',
    feWorkaround: 'UI stub on message menu; 404 until POST /fork',
    requiredApi: 'POST /chat/sessions/{id}/fork',
    feRequest: `POST /chat/sessions/{session_id}/fork
{
  "up_to_message_id": "msg-uuid",
  "title": "Branch"
}`,
    expectedResponse: `201 {
  "session_id": "new-sess-uuid",
  "parent_session_id": "sess-uuid",
  "forked_at_message_id": "msg-uuid"
}`,
    acceptance: 'New session with messages copied up to fork point; parent_session_id persisted',
    priority: 'P2',
    blockedFeatures: ['Continue in new chat from here'],
    uiSurface: 'sidebar',
    resolved: true,
    resolvedNote: 'fork_session persists parent_session_id + forked_at_message_id in DB (2026-07-04)',
  },
  {
    id: 'chat-projects',
    capability: 'Chat projects (rules + shared files)',
    feWorkaround: 'Projects sidebar section hidden on 404',
    requiredApi: 'GET/POST/PATCH/DELETE /chat/projects',
    feRequest: `GET /chat/projects
POST /chat/projects { "name": "...", "system_rules": "..." }
PATCH /chat/sessions/{id} { "project_id": "proj-uuid" }`,
    expectedResponse: `200 [{ "id": "proj-uuid", "name": "Finance", "system_rules": "..." }]`,
    acceptance: 'Sessions grouped under projects; rules sent in stream context',
    priority: 'P2',
    blockedFeatures: ['Projects sidebar', 'Project knowledge files'],
    uiSurface: 'projects',
  },
  {
    id: 'chat-import-restore',
    capability: 'Restore sessions from backup ZIP',
    feWorkaround: 'Import button in bulk-backup-modal; 404 until route exists',
    requiredApi: 'POST /chat/sessions/import',
    feRequest: `POST /chat/sessions/import
Content-Type: multipart/form-data
file: backup.zip`,
    expectedResponse: `201 {
  "imported_sessions": [{ "id": "sess-uuid", "title": "..." }],
  "failed": []
}`,
    acceptance: 'ZIP from bulk backup restores sessions and messages',
    priority: 'P2',
    blockedFeatures: ['Restore from backup'],
    uiSurface: 'export',
  },
  {
    id: 'sessions-export-all',
    capability: 'Server-side export all sessions (scale)',
    feWorkaround: 'Client loop in bulk-backup-runner.ts',
    requiredApi: 'GET /chat/sessions/export-all',
    feRequest: `GET /chat/sessions/export-all?format=zip&include_files=true`,
    expectedResponse: `200 application/zip (or 202 { "job_id": "..." })`,
    acceptance: 'Single request backup for large tenants',
    priority: 'P2',
    blockedFeatures: ['Fast bulk backup at scale'],
    uiSurface: 'export',
  },
];

const BACKEND_GAP_RESOLVED_NOTE =
  'Backend wave P0-P2: api-gateway + storage extended routes (2026-07-04)';

/** Gaps with resolution flags after backend implementation. */
export const CHAT_BACKEND_CAPABILITY_GAPS: ChatBackendCapabilityGap[] =
  CHAT_BACKEND_CAPABILITY_GAPS_RAW.map((gap) => ({
    ...gap,
    resolved: true,
    resolvedNote: gap.resolvedNote ?? BACKEND_GAP_RESOLVED_NOTE,
  }));

/** i18n key suffix under chatPage.devRequirements.gaps.{id} */
export function chatGapI18nKey(id: string): string {
  return `chatPage.devRequirements.gaps.${id}`;
}

export function chatGapsBySurface(surface: ChatUiSurface): ChatBackendCapabilityGap[] {
  return CHAT_BACKEND_CAPABILITY_GAPS.filter((g) => g.uiSurface === surface);
}

export function chatGapsByPriority(priority: ChatBackendGapPriority): ChatBackendCapabilityGap[] {
  return CHAT_BACKEND_CAPABILITY_GAPS.filter((g) => g.priority === priority);
}
