// ============================================
// Messenger WebSocket â€” URL building & event parsing
// ============================================

import { getImportWsBaseUrl } from '@/lib/service-urls';

export interface MessengerRealtimeMessage {
  type: 'new_message' | 'message_updated' | 'message_deleted' | 'typing' | 'presence' | 'read_receipt';
  data: unknown;
}

export interface MessengerWsInfo {
  websocket_base?: string;
  paths?: {
    inbox?: string;
    mailbox?: string;
    partner?: string;
    thread?: string;
    /** Template with {partner_id} or {partnerId} */
    partner_chat?: string;
  };
  auth?: {
    header?: string;
    query?: string;
  };
  note?: string;
}

export type MessengerWsChannel = 'inbox' | 'partner';

function resolveWsBase(info: MessengerWsInfo | null): string {
  const explicit = info?.websocket_base?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  return getImportWsBaseUrl().replace(/\/$/, '');
}

function resolveWsPath(base: string, pathOrUrl: string): string {
  const trimmed = pathOrUrl.trim();
  if (/^wss?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return `${base}${trimmed}`;
  return trimmed;
}

/** Build authenticated WebSocket URL for messenger channels. */
export function buildMessengerWsUrl(
  info: MessengerWsInfo | null,
  channel: MessengerWsChannel,
  options: { partnerId?: string; accessToken: string }
): string {
  const base = resolveWsBase(info);
  const paths = info?.paths;
  let url: string;

  // Holand api-gateway: single endpoint /ws/messenger (subscribe via partnerId message)
  if (channel === 'inbox') {
    const inboxPath = paths?.inbox ?? paths?.mailbox;
    url = inboxPath ? resolveWsPath(base, inboxPath) : `${base}/ws/messenger`;
  } else {
    if (!options.partnerId) {
      throw new Error('partnerId required for partner messenger WebSocket');
    }
    const template =
      paths?.partner ??
      paths?.partner_chat ??
      paths?.thread ??
      '/ws/messenger';
    url = resolveWsPath(
      base,
      template
        .replace(/\{partner_id\}/gi, encodeURIComponent(options.partnerId))
        .replace(/\{partnerId\}/gi, encodeURIComponent(options.partnerId))
    );
  }

  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}access_token=${encodeURIComponent(options.accessToken)}`;
}

function pickPartnerId(payload: Record<string, unknown>): string | undefined {
  const id =
    payload.partnerId ??
    payload.partner_id ??
    payload.user_id ??
    payload.from_id;
  return typeof id === 'string' ? id : undefined;
}

/** Normalize server WS payloads (dot and snake_case variants). */
export function parseMessengerWsEvent(raw: string): MessengerRealtimeMessage | null {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const type = String(data.type ?? '');

    if (type === 'message.new' || type === 'new_message' || type === 'message_new') {
      return {
        type: 'new_message',
        data: data.payload ?? data.data ?? data.message ?? data,
      };
    }

    if (type === 'message.updated' || type === 'message_updated') {
      return {
        type: 'message_updated',
        data: data.payload ?? data.data ?? data.message ?? data,
      };
    }

    if (type === 'message.deleted' || type === 'message_deleted') {
      return {
        type: 'message_deleted',
        data: data.payload ?? data.data ?? data,
      };
    }

    if (type === 'typing.start' || type === 'typing_start') {
      const payload = (data.payload ?? data.data ?? data) as Record<string, unknown>;
      const partnerId = pickPartnerId(payload) ?? pickPartnerId(data);
      if (!partnerId) return null;
      return { type: 'typing', data: { partnerId, isTyping: true } };
    }

    if (type === 'typing.stop' || type === 'typing_stop') {
      const payload = (data.payload ?? data.data ?? data) as Record<string, unknown>;
      const partnerId = pickPartnerId(payload) ?? pickPartnerId(data);
      if (!partnerId) return null;
      return { type: 'typing', data: { partnerId, isTyping: false } };
    }

    if (type === 'typing') {
      const payload = (data.payload ?? data.data ?? data) as Record<string, unknown>;
      const partnerId = pickPartnerId(payload) ?? pickPartnerId(data);
      if (!partnerId) return null;
      const isTyping = payload.isTyping !== false && payload.is_typing !== false;
      return { type: 'typing', data: { partnerId, isTyping } };
    }

    if (type === 'presence' || type === 'presence.updated' || type === 'presence_updated') {
      return {
        type: 'presence',
        data: data.payload ?? data.data ?? data,
      };
    }

    if (type === 'read_receipt.updated' || type === 'read_receipt') {
      return {
        type: 'read_receipt',
        data: data.payload ?? data.data ?? data,
      };
    }

    // Polling fallback synthetic event
    if (type === 'poll') {
      return { type: 'new_message', data: { polling: true } };
    }

    return null;
  } catch {
    return null;
  }
}

export function getReconnectDelay(attempt: number, maxMs = 30000): number {
  return Math.min(1000 * 2 ** attempt, maxMs);
}

