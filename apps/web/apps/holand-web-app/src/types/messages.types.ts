// ============================================
// User Messenger Types
// Plugin: user_messenger — POST /tools/plugin_user_messenger_*/execute
// ============================================

export type MessageFolder = 'inbox' | 'sent' | 'drafts' | 'archived' | 'trash';

export type MessagePriority = 'low' | 'normal' | 'high';

export type MessagesViewMode = 'mailbox' | 'people';

export type MessageContentType =
  | 'text'
  | 'html'
  | 'bug_report'
  | 'task_notification'
  | 'project_update'
  | 'calendar_invite'
  | 'image'
  | 'video'
  | 'audio'
  | 'voice'
  | 'file'
  | 'location'
  | 'call_log'
  | 'live_invite';

/** Cross-module entity link (projects, tasks, calendar, cases, files). */
export type EntityRefType =
  | 'project'
  | 'task'
  | 'calendar_event'
  | 'graph_node'
  | 'case'
  | 'file'
  | 'message';

export interface EntityRef {
  type: EntityRefType;
  id: string;
  label?: string;
  href?: string;
  meta?: Record<string, string | number | boolean | null>;
}

export type MessageDeliveryStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface ReactionSummary {
  emoji: string;
  count: number;
  user_ids: string[];
}

export interface CallMeta {
  call_id: string;
  type: 'voice' | 'video';
  status: 'missed' | 'completed' | 'declined' | 'ongoing';
  duration_sec?: number;
  started_at?: string;
}

/** User summary attached to from/to fields */
export interface UserSummary {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
}

/** Attachment metadata on a message */
export interface AttachmentInfo {
  id: string;
  name: string;
  size: number;
  mime_type: string;
  url?: string;
}

/** Row item from list / search */
export interface MessageItem {
  id: string;
  from: UserSummary;
  to: UserSummary;
  subject: string;
  preview: string;
  body?: string;
  read: boolean;
  priority: MessagePriority;
  folder: MessageFolder;
  attachments?: AttachmentInfo[];
  reply_count?: number;
  thread_root_id?: string;
  created_at: string;
  content_type?: MessageContentType;
  reply_to_id?: string;
  edited_at?: string;
  reactions?: ReactionSummary[];
  read_by?: string[];
  starred?: boolean;
  pinned?: boolean;
  forwarded_from?: string;
  call_meta?: CallMeta;
  voice_duration_ms?: number;
  delivery_status?: MessageDeliveryStatus;
  cc?: UserSummary[];
  bcc?: UserSummary[];
  /** Links to projects, tasks, calendar events, etc. */
  entity_refs?: EntityRef[];
  /** Client-generated id for optimistic send + idempotency */
  client_message_id?: string;
}

/** Full message detail from get */
export interface MessageDetail extends MessageItem {
  body: string;
}

/** Grouped conversation for People view */
export interface PeopleConversation {
  partner: UserSummary;
  lastMessage: MessageItem;
  unreadCount: number;
  messageIds: string[];
  threadRootId: string;
  conversationId?: string;
  muted?: boolean;
  pinned?: boolean;
}

/** Standard plugin tool envelope */
export interface MessengerToolResult<T = unknown> {
  ok: boolean;
  data?: T;
  channels?: Record<string, unknown>;
  error?: string;
}

export interface MessagesListData {
  items: MessageItem[];
  unread_count: number;
  total: number;
  page: number;
  limit: number;
}

export interface MessagesListResponse extends MessengerToolResult<MessagesListData> {}

export interface MessageDetailResponse extends MessengerToolResult<MessageDetail> {}

export interface SendMessageRequest {
  to: string;
  conversation_id?: string;
  cc?: string[];
  bcc?: string[];
  subject?: string;
  body: string;
  attachments?: string[];
  priority?: MessagePriority;
  draft?: boolean;
  client_message_id?: string;
  content_type?: MessageContentType;
  reply_to_id?: string;
  reply_all?: boolean;
  scheduled_at?: string;
  voice_duration_ms?: number;
  entity_refs?: EntityRef[];
}

export interface SendMessageData {
  id: string;
  created_at: string;
  duplicate?: boolean;
}

export interface SendResponse extends MessengerToolResult<SendMessageData> {}

export interface ReplyMessageRequest {
  message_id: string;
  body: string;
  attachments?: string[];
  client_message_id?: string;
  content_type?: MessageContentType;
  reply_to_id?: string;
  voice_duration_ms?: number;
}

export interface ReplyMessageData {
  id: string;
  created_at: string;
}

export interface ReplyResponse extends MessengerToolResult<ReplyMessageData> {}

export interface RepliesData {
  thread_root_id: string;
  items: MessageItem[];
  total: number;
}

export interface RepliesResponse extends MessengerToolResult<RepliesData> {}

export interface SearchData {
  items: MessageItem[];
  total: number;
  page: number;
  limit: number;
  query: string;
  folder?: MessageFolder | null;
}

export interface SearchResponse extends MessengerToolResult<SearchData> {}

export interface UpdateMessageRequest {
  message_id: string;
  read?: boolean;
  folder?: MessageFolder;
  body?: string;
  starred?: boolean;
  pinned?: boolean;
  muted?: boolean;
  snooze_until?: string;
}

export interface BulkUpdateMailRequest {
  message_ids: string[];
  read?: boolean;
  folder?: MessageFolder;
  starred?: boolean;
  pinned?: boolean;
  muted?: boolean;
}

export interface ForwardMailRequest {
  message_id: string;
  to: string;
  cc?: string[];
  bcc?: string[];
  body?: string;
}

export interface UpdateConversationRequest {
  conversation_id: string;
  muted?: boolean;
  pinned?: boolean;
}

export interface UpdateResponse extends MessengerToolResult<{ id: string }> {}

export interface DeleteResponse extends MessengerToolResult<{ id: string }> {}

export interface AttachLibraryRequest {
  artifact_id: string;
}

export interface AttachLibraryData {
  artifact_id: string;
  name?: string;
  mime_type?: string;
  size?: number;
}

export interface AttachLibraryResponse extends MessengerToolResult<AttachLibraryData> {}

/** Local attachment pending upload */
export interface PendingAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  artifactId?: string;
  dataUrl?: string;
  uploading?: boolean;
  progress?: number;
}
