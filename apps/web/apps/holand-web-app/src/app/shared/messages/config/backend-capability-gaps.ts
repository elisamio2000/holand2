// ============================================
// Messages — backend capability gaps for dev handoff panel
// Mail (Mailbox) vs Chat (People) vs Shared infrastructure
// ============================================

export type MessagesBackendGapPriority = 'P0' | 'P1' | 'P2';

export type MessagesApiLane = 'shared' | 'mailbox' | 'people';

export type MessagesUiSurface =
  | 'inbox'
  | 'compose'
  | 'people'
  | 'timeline'
  | 'attachments'
  | 'realtime'
  | 'calls'
  | 'directory'
  | 'architecture';

export type MessagesBenchmarkRef =
  | 'gmail'
  | 'outlook'
  | 'telegram'
  | 'whatsapp'
  | 'slack'
  | 'teams';

export type MessagesBeStatus = 'live' | 'partial' | 'missing';

export interface MessagesBackendCapabilityGap {
  id: string;
  capability: string;
  feWorkaround: string;
  requiredApi: string;
  feRequest: string;
  expectedResponse: string;
  acceptance: string;
  priority: MessagesBackendGapPriority;
  blockedFeatures: string[];
  uiSurface: MessagesUiSurface;
  lane: MessagesApiLane;
  benchmarkRef?: MessagesBenchmarkRef | MessagesBenchmarkRef[];
  beStatus?: MessagesBeStatus;
  resolved?: boolean;
  resolvedNote?: string;
}

export const MESSAGES_BACKEND_CAPABILITY_GAPS_RAW: MessagesBackendCapabilityGap[] = [
  // —— resolved infra (documented for history) ——
  {
    id: 'storage-500',
    capability: 'Messenger storage layer returns storage_500 on tool execute',
    feWorkaround: 'Mock layer via NEXT_PUBLIC_MESSAGES_MOCK=fallback',
    requiredApi: 'storage GET/POST /mail/* and /user-chat/* with split repositories',
    feRequest: `POST /tools/plugin_user_mail_list/execute
{ "args": { "folder": "inbox", "page": 1, "limit": 5 } }`,
    expectedResponse: `{ "ok": true, "result": { "ok": true, "data": { "items": [], "total": 0 } } }`,
    acceptance: 'List/get/send return 200 with ok:true — no storage_500 in envelope',
    priority: 'P0',
    blockedFeatures: ['All /messages REST via plugin'],
    uiSurface: 'inbox',
    lane: 'shared',
    resolved: true,
    resolvedNote: 'Verified 2026-07-06 — storage /mail and /user-chat routes healthy',
  },
  {
    id: 'replies-404',
    capability: 'plugin_user_chat_replies registered on tool-runner',
    feWorkaround: 'Empty chat timeline when replies tool missing',
    requiredApi: 'POST /tools/plugin_user_chat_replies/execute',
    feRequest: `{ "args": { "message_id": "<uuid>", "limit": 50 } }`,
    expectedResponse: `{ "ok": true, "result": { "ok": true, "data": { "items": [], "total": 0 } } }`,
    acceptance: 'Tool-runner serves replies; chat timeline loads thread',
    priority: 'P0',
    blockedFeatures: ['People view chat timeline'],
    uiSurface: 'timeline',
    lane: 'people',
    resolved: true,
    resolvedNote: 'Verified 2026-07-06 — tool execute returns 200',
  },
  {
    id: 'send-cc-bcc',
    capability: 'Cc/Bcc persisted on send',
    feWorkaround: 'Compose sends cc[]/bcc[] — was blocked in dev checklist',
    requiredApi: 'plugin_user_mail_send args cc, bcc',
    feRequest: `{ "args": { "to": "<uuid>", "cc": ["<uuid>"], "bcc": [], "subject": "Hi", "body": "<p>…</p>" } }`,
    expectedResponse: `{ "ok": true, "data": { "id": "<msg>", "cc": [...], "bcc": [] } }`,
    acceptance: 'Sent message returns cc/bcc arrays; detail view shows recipients',
    priority: 'P2',
    blockedFeatures: ['Email compose Cc/Bcc row'],
    uiSurface: 'compose',
    lane: 'mailbox',
    resolved: true,
    resolvedNote: 'BE schema includes cc/bcc in plugin_user_mail_send + storage POST /mail',
  },
  // —— shared / infra ——
  {
    id: 'list-since',
    capability: 'Incremental list sync via since cursor',
    feWorkaround: 'Full list refresh on WS event / polling',
    requiredApi: 'plugin_user_mail_list args.since',
    feRequest: `POST /tools/plugin_user_mail_list/execute
{ "args": { "folder": "inbox", "since": "2026-07-06T10:00:00Z", "page": 1, "limit": 30 } }`,
    expectedResponse: `{ "data": { "items": [...], "cursor": "ISO8601", "total": 42 } }`,
    acceptance: 'Only messages newer than since returned; cursor echoed for next poll',
    priority: 'P1',
    blockedFeatures: ['Efficient polling', 'messages-data-store listCursor'],
    uiSurface: 'inbox',
    lane: 'shared',
  },
  {
    id: 'attachments-table',
    capability: 'messenger_message_attachments table in Postgres',
    feWorkaround: 'Upload works; attachment join may fail on some DBs',
    requiredApi: 'init-scripts/08-user-messages-schema.sql migration',
    feRequest: 'N/A — schema migration',
    expectedResponse: 'Table messenger_message_attachments exists when artifacts table present',
    acceptance: 'Send with attachments persists join rows; get returns attachment metadata',
    priority: 'P1',
    blockedFeatures: ['Reliable attachment cards', 'thread files panel'],
    uiSurface: 'attachments',
    lane: 'shared',
  },
  {
    id: 'search-recipients',
    capability: 'Messenger-scoped recipient directory search',
    feWorkaround: 'GET /admin/users in compose and people picker',
    requiredApi: 'plugin_user_mail_search_recipients or directory tool',
    feRequest: `{ "args": { "q": "ali", "limit": 20 } }`,
    expectedResponse: `{ "data": { "items": [{ "id": "uuid", "name": "…", "email": "…" }] } }`,
    acceptance: 'Non-admin users can search recipients without admin:users permission',
    priority: 'P1',
    blockedFeatures: ['Compose recipient picker for standard users'],
    uiSurface: 'directory',
    lane: 'shared',
    benchmarkRef: 'outlook',
    beStatus: 'live',
    resolved: true,
    resolvedNote: 'plugin_user_mail_search_recipients shipped — FE still uses admin directory as fallback',
  },
  {
    id: 'plugin-split-mail-chat',
    capability: 'Split user_messenger into mail vs chat domains',
    feWorkaround: 'Resolved — user_mail + user_chat plugins',
    requiredApi: 'plugin_user_mail_* + plugin_user_chat_*',
    feRequest: 'Implemented in mail-user-chat-split',
    expectedResponse: 'Separate storage /mail/* and /user-chat/*',
    acceptance: 'Mailbox and People use separate plugins and RBAC',
    priority: 'P1',
    blockedFeatures: [],
    uiSurface: 'architecture',
    lane: 'shared',
    resolved: true,
    resolvedNote: 'user_mail + user_chat plugins; /mail/* and /user-chat/* storage',
  },
  // —— mailbox / mail ——
  {
    id: 'labels-tags',
    capability: 'User-defined labels on messages',
    feWorkaround: 'Local starred filter only',
    requiredApi: 'plugin_user_mail_labels (list/create/apply)',
    feRequest: `{ "args": { "action": "apply", "message_id": "<uuid>", "label_ids": ["<label-uuid>"] } }`,
    expectedResponse: `{ "data": { "id": "<uuid>", "labels": [{ "id": "…", "name": "work" }] } }`,
    acceptance: 'List filter by label; bulk label update',
    priority: 'P2',
    blockedFeatures: ['Gmail-style labels', 'Multi-filter mailbox'],
    uiSurface: 'inbox',
    lane: 'mailbox',
    beStatus: 'live',
    resolved: true,
    resolvedNote: 'v0.122.1 — plugin_user_mail_labels + storage /mail/labels routes',
  },
  {
    id: 'snooze-until',
    capability: 'Snooze message until datetime',
    feWorkaround: 'EmailHeader snooze action wired to mailService.snooze',
    requiredApi: 'plugin_user_mail_update snooze_until',
    feRequest: `{ "args": { "message_id": "<uuid>", "snooze_until": "2026-07-07T09:00:00Z" } }`,
    expectedResponse: `{ "data": { "snooze_until": "2026-07-07T09:00:00Z", "folder": "inbox" } }`,
    acceptance: 'Message hidden until snooze_until; reappears in inbox',
    priority: 'P2',
    blockedFeatures: [],
    uiSurface: 'inbox',
    lane: 'mailbox',
    benchmarkRef: 'gmail',
    beStatus: 'live',
    resolved: true,
    resolvedNote: 'BE snooze_until on PATCH /mail — FE wired v0.122.0',
  },
  {
    id: 'scheduled-send-job',
    capability: 'Scheduled send with background job',
    feWorkaround: 'Compose sends scheduled_at — BE mail_scheduled_job polls every 60s',
    requiredApi: 'POST send scheduled_at + scheduler worker',
    feRequest: `{ "args": { "to": "<uuid>", "body": "…", "scheduled_at": "2026-07-07T08:00:00Z", "draft": false } }`,
    expectedResponse: `{ "data": { "id": "<uuid>", "delivery_status": "pending", "scheduled_at": "…" } }`,
    acceptance: 'Message delivers at scheduled_at; visible in drafts/sent appropriately',
    priority: 'P2',
    blockedFeatures: [],
    uiSurface: 'compose',
    lane: 'mailbox',
    benchmarkRef: 'outlook',
    beStatus: 'partial',
    resolved: true,
    resolvedNote: 'FE schedule picker + BE job — delivery timing depends on worker',
  },
  {
    id: 'forward-tool',
    capability: 'Forward message to recipients',
    feWorkaround: 'ForwardModal uses mailService.forward',
    requiredApi: 'plugin_user_mail_forward',
    feRequest: `{ "args": { "message_id": "<uuid>", "to": ["<uuid>"], "body": "FYI" } }`,
    expectedResponse: `{ "data": { "ids": ["<new-msg-uuid>"] } }`,
    acceptance: 'Forward preserves attachments refs; appears in sent folder',
    priority: 'P2',
    blockedFeatures: [],
    uiSurface: 'compose',
    lane: 'mailbox',
    benchmarkRef: 'gmail',
    beStatus: 'live',
    resolved: true,
    resolvedNote: 'plugin_user_mail_forward + POST /mail/{id}/forward — FE wired v0.122.0',
  },
  {
    id: 'read-by-aggregate',
    capability: 'Read receipts list on message detail',
    feWorkaround: 'delivery_status only; MessageStatusIndicator partial',
    requiredApi: 'GET detail read_by[]',
    feRequest: `POST /tools/plugin_user_mail_get/execute
{ "args": { "message_id": "<uuid>" } }`,
    expectedResponse: `{ "data": { "read_by": [{ "user_id": "…", "read_at": "ISO8601" }] } }`,
    acceptance: 'Sender sees who read email-style messages',
    priority: 'P2',
    blockedFeatures: ['Teams-style read receipts in mailbox'],
    uiSurface: 'inbox',
    lane: 'mailbox',
    beStatus: 'live',
    resolved: true,
    resolvedNote: 'v0.122.1 — get_message returns read_by[] from mail_message_states',
  },
  {
    id: 'bulk-operations',
    capability: 'Bulk archive / trash / mark-read',
    feWorkaround: 'messages-hub uses mailService.bulkUpdate',
    requiredApi: 'plugin_user_mail_bulk_update',
    feRequest: `{ "args": { "message_ids": ["…"], "folder": "archived" } }`,
    expectedResponse: `{ "data": { "updated": 12, "failed": [] } }`,
    acceptance: 'Single request for multi-select in mailbox',
    priority: 'P2',
    blockedFeatures: [],
    uiSurface: 'inbox',
    lane: 'mailbox',
    benchmarkRef: 'gmail',
    beStatus: 'live',
    resolved: true,
    resolvedNote: 'plugin_user_mail_bulk_update — FE bulk toolbar wired v0.122.0',
  },
  {
    id: 'templates-signatures',
    capability: 'Email templates and signatures',
    feWorkaround: 'Snippets localStorage mock',
    requiredApi: 'plugin_user_mail_templates CRUD',
    feRequest: `GET /tools/plugin_user_mail_templates_list/execute`,
    expectedResponse: `{ "data": { "items": [{ "id": "…", "name": "Support reply", "body_html": "…" }] } }`,
    acceptance: 'Insert template in RichTextEditor compose',
    priority: 'P2',
    blockedFeatures: ['Template picker in compose'],
    uiSurface: 'compose',
    lane: 'mailbox',
  },
  // —— people / chat ——
  {
    id: 'conversations-grouped',
    capability: 'People view conversation list API',
    feWorkaround: 'use-messages.ts loads plugin_user_chat_conversations',
    requiredApi: 'plugin_user_chat_conversations',
    feRequest: `{ "args": { "page": 1, "limit": 30 } }`,
    expectedResponse: `{ "data": { "items": [{ "partner": {}, "last_message": {}, "unread_count": 2 }] } }`,
    acceptance: 'People sidebar loads without full inbox scan',
    priority: 'P1',
    blockedFeatures: [],
    uiSurface: 'people',
    lane: 'people',
    benchmarkRef: ['telegram', 'whatsapp'],
    beStatus: 'live',
    resolved: true,
    resolvedNote: 'plugin_user_chat_conversations live — People list uses API since v0.121.0',
  },
  {
    id: 'chat-search',
    capability: 'Search messages across chat conversations',
    feWorkaround: 'userChatService.search available — thread search still client-side',
    requiredApi: 'plugin_user_chat_search',
    feRequest: `{ "args": { "q": "hello", "page": 1, "limit": 30 } }`,
    expectedResponse: `{ "data": { "items": [...], "total": 5, "query": "hello" } }`,
    acceptance: 'Global People search uses BE search endpoint',
    priority: 'P1',
    blockedFeatures: ['Global chat search in hub toolbar'],
    uiSurface: 'people',
    lane: 'people',
    benchmarkRef: 'telegram',
    beStatus: 'live',
    resolved: true,
    resolvedNote: 'plugin_user_chat_search shipped — FE service wired v0.122.0',
  },
  {
    id: 'chat-update-conversation',
    capability: 'Mute or pin a conversation',
    feWorkaround: 'people-list uses updateConversation when conversation_id present',
    requiredApi: 'plugin_user_chat_update_conversation',
    feRequest: `{ "args": { "conversation_id": "<uuid>", "pinned": true, "muted": false } }`,
    expectedResponse: `{ "data": { "conversation_id": "<uuid>", "pinned": true } }`,
    acceptance: 'Pin/mute persists per user across devices',
    priority: 'P2',
    blockedFeatures: [],
    uiSurface: 'people',
    lane: 'people',
    benchmarkRef: ['telegram', 'whatsapp'],
    beStatus: 'live',
    resolved: true,
    resolvedNote: 'plugin_user_chat_update_conversation — FE wired v0.122.0',
  },
  {
    id: 'chat-delete-message',
    capability: 'Soft-delete chat message (for_me / for_everyone)',
    feWorkaround: 'chat-timeline delete uses userChat.deleteMessage',
    requiredApi: 'plugin_user_chat_delete',
    feRequest: `{ "args": { "message_id": "<uuid>", "for_everyone": false } }`,
    expectedResponse: `{ "data": { "id": "<uuid>", "deleted_at": "ISO8601" } }`,
    acceptance: 'Delete removes message from timeline; WS message_deleted event',
    priority: 'P2',
    blockedFeatures: [],
    uiSurface: 'timeline',
    lane: 'people',
    benchmarkRef: 'whatsapp',
    beStatus: 'live',
    resolved: true,
    resolvedNote: 'plugin_user_chat_delete — FE context menu wired v0.122.0',
  },
  {
    id: 'react-tool',
    capability: 'Emoji reactions on messages',
    feWorkaround: 'EmojiPicker + localStorage mock — schema 27-user-chat-reactions.sql exists',
    requiredApi: 'plugin_user_chat_react',
    feRequest: `{ "args": { "message_id": "<uuid>", "emoji": "👍", "action": "add" } }`,
    expectedResponse: `{ "data": { "reactions": [{ "emoji": "👍", "count": 2, "user_ids": [] }] } }`,
    acceptance: 'Reactions sync via WS new_message/message_updated',
    priority: 'P2',
    blockedFeatures: ['Chat timeline reactions API sync'],
    uiSurface: 'timeline',
    lane: 'people',
    benchmarkRef: ['telegram', 'whatsapp'],
    beStatus: 'live',
    resolved: true,
    resolvedNote: 'v0.122.1 — plugin_user_chat_react + use-message-reactions API path',
  },
  {
    id: 'thread-files',
    capability: 'List all attachments in a thread',
    feWorkaround: 'thread-files-panel aggregates from loaded replies',
    requiredApi: 'plugin_user_chat_thread_files',
    feRequest: `{ "args": { "thread_root_id": "<uuid>", "page": 1 } }`,
    expectedResponse: `{ "data": { "items": [{ "artifact_id": "…", "message_id": "…" }] } }`,
    acceptance: 'Right rail Files tab without loading full thread history',
    priority: 'P2',
    blockedFeatures: ['MessagesRightRail files tab at scale'],
    uiSurface: 'timeline',
    lane: 'people',
  },
  {
    id: 'typing-presence-rest',
    capability: 'REST fallback for typing and presence',
    feWorkaround: 'WS only; polling when WS down',
    requiredApi: 'plugin_user_chat_typing / plugin_user_chat_presence',
    feRequest: `{ "args": { "partner_id": "<uuid>", "is_typing": true } }`,
    expectedResponse: `{ "ok": true }`,
    acceptance: 'Typing indicator works when WebSocket blocked by proxy',
    priority: 'P1',
    blockedFeatures: ['Typing indicator behind strict firewalls'],
    uiSurface: 'realtime',
    lane: 'people',
  },
  {
    id: 'group-chat',
    capability: 'Group conversations create and invite',
    feWorkaround: 'DM-only via send to single to',
    requiredApi: 'plugin_user_chat_create_group',
    feRequest: `{ "args": { "member_ids": ["…"], "subject": "Team" } }`,
    expectedResponse: `{ "data": { "conversation_id": "<uuid>", "type": "group" } }`,
    acceptance: 'People view shows group avatar and member list',
    priority: 'P2',
    blockedFeatures: ['Group new chat'],
    uiSurface: 'people',
    lane: 'people',
    beStatus: 'partial',
    resolved: false,
    resolvedNote: 'v0.122.1 — create API + multi-select modal; member list UI still pending',
  },
  {
    id: 'call-webrtc',
    capability: 'Voice/video calls with WebRTC signaling',
    feWorkaround: 'UI mock call buttons — no real media',
    requiredApi: 'call_initiate, call_signal, call_end + TURN/STUN config',
    feRequest: `{ "args": { "partner_id": "<uuid>", "call_type": "video" } }`,
    expectedResponse: `{ "data": { "call_id": "…", "ice_servers": [...] } }`,
    acceptance: 'Peer connection established; call_log content_type persisted',
    priority: 'P2',
    blockedFeatures: ['Voice/video call buttons in People header'],
    uiSurface: 'calls',
    lane: 'people',
  },
  {
    id: 'edit-delete-for-everyone',
    capability: 'Edit window and delete-for-everyone in chat',
    feWorkaround: 'update body + deleteMessage(for_everyone) on BE',
    requiredApi: 'plugin_user_chat_update body + plugin_user_chat_delete for_everyone',
    feRequest: `{ "args": { "message_id": "<uuid>", "for_everyone": true } }`,
    expectedResponse: `{ "data": { "deleted_at": "ISO8601" } }`,
    acceptance: 'Recipient timeline removes message; WS message_deleted event',
    priority: 'P2',
    blockedFeatures: ['Delete-for-everyone context menu option'],
    uiSurface: 'timeline',
    lane: 'people',
    benchmarkRef: 'whatsapp',
    beStatus: 'partial',
    resolved: true,
    resolvedNote: 'BE supports for_everyone — FE delete wired; edit uses update body',
  },
];

/** Gaps with explicit resolution flags where verified. */
export const MESSAGES_BACKEND_CAPABILITY_GAPS: MessagesBackendCapabilityGap[] =
  MESSAGES_BACKEND_CAPABILITY_GAPS_RAW.map((gap) => ({
    ...gap,
    resolved: gap.resolved ?? false,
  }));

/** i18n key suffix under messages.devRequirements.gaps.{id} */
export function messagesGapI18nKey(id: string): string {
  return `messages.devRequirements.gaps.${id}`;
}

export function messagesGapsByLane(lane: MessagesApiLane): MessagesBackendCapabilityGap[] {
  return MESSAGES_BACKEND_CAPABILITY_GAPS.filter((g) => g.lane === lane);
}

export function messagesGapsByPriority(
  priority: MessagesBackendGapPriority
): MessagesBackendCapabilityGap[] {
  return MESSAGES_BACKEND_CAPABILITY_GAPS.filter((g) => g.priority === priority);
}

export function messagesGapsBySurface(
  surface: MessagesUiSurface
): MessagesBackendCapabilityGap[] {
  return MESSAGES_BACKEND_CAPABILITY_GAPS.filter((g) => g.uiSurface === surface);
}
