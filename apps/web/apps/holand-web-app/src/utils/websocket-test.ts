// ============================================
// WebSocket test helpers — manual debugging in browser console
// Usage (dev): import('@/utils/websocket-test').then(m => m.testImportQueueWebSocket())
// ============================================

import { getSession } from 'next-auth/react';
import { gatewayClient } from '@/lib/api-client';
import {
  buildImportWsUrl,
  parseCaseProgressMessage,
  parseQueueStatusMessage,
  type ImportWsInfo,
} from '@/utils/import-websocket';

export interface WebSocketTestResult {
  ok: boolean;
  wsInfo?: ImportWsInfo;
  queueUrl?: string;
  messages: string[];
  error?: string;
}

/** Fetch GET /import/ws-info via gateway. */
export async function fetchImportWsInfo(): Promise<ImportWsInfo> {
  const res = await gatewayClient.get<ImportWsInfo>('/import/ws-info');
  return res.data;
}

/** Connect to queue WebSocket and collect messages for a short window. */
export async function testImportQueueWebSocket(
  listenMs = 5000
): Promise<WebSocketTestResult> {
  const messages: string[] = [];
  try {
    const wsInfo = await fetchImportWsInfo();
    const session = await getSession();
    const token = session?.user?.accessToken as string | undefined;
    if (!token) {
      return { ok: false, wsInfo, messages, error: 'No access token in session' };
    }

    const queueUrl = buildImportWsUrl('queue', { accessToken: token });

    return await new Promise<WebSocketTestResult>((resolve) => {
      const ws = new WebSocket(queueUrl);
      let settled = false;

      const finish = (result: WebSocketTestResult) => {
        if (settled) return;
        settled = true;
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        resolve(result);
      };

      ws.onopen = () => {
        messages.push('[open] connected');
      };

      ws.onmessage = (ev) => {
        const raw = String(ev.data);
        messages.push(raw);
        const queue = parseQueueStatusMessage(raw);
        if (queue) {
          messages.push(
            `[parsed queue] active=${queue.active_count} queued=${queue.queue_size}`
          );
        }
      };

      ws.onerror = () => {
        finish({
          ok: false,
          wsInfo,
          queueUrl,
          messages,
          error: 'WebSocket error event',
        });
      };

      ws.onclose = (ev) => {
        messages.push(`[close] code=${ev.code} reason=${ev.reason || 'none'}`);
        if (!settled) {
          finish({
            ok: ev.code === 1000 || messages.some((m) => m.startsWith('[open]')),
            wsInfo,
            queueUrl,
            messages,
          });
        }
      };

      setTimeout(() => {
        finish({ ok: true, wsInfo, queueUrl, messages });
      }, listenMs);
    });
  } catch (err: unknown) {
    return {
      ok: false,
      messages,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Connect to case progress WebSocket for one case id. */
export async function testCaseProgressWebSocket(
  caseId: string,
  listenMs = 5000
): Promise<WebSocketTestResult> {
  const messages: string[] = [];
  try {
    const wsInfo = await fetchImportWsInfo();
    const session = await getSession();
    const token = session?.user?.accessToken as string | undefined;
    if (!token) {
      return { ok: false, wsInfo, messages, error: 'No access token in session' };
    }

    const caseUrl = buildImportWsUrl('case', { id: caseId, accessToken: token });

    return await new Promise<WebSocketTestResult>((resolve) => {
      const ws = new WebSocket(caseUrl);
      let settled = false;

      const finish = (result: WebSocketTestResult) => {
        if (settled) return;
        settled = true;
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        resolve(result);
      };

      ws.onopen = () => messages.push('[open] connected');

      ws.onmessage = (ev) => {
        const raw = String(ev.data);
        messages.push(raw);
        const progress = parseCaseProgressMessage(raw, caseId);
        if (progress) {
          messages.push(
            `[parsed progress] phase=${progress.phase} overall=${progress.overall}`
          );
        }
      };

      ws.onerror = () => {
        finish({
          ok: false,
          wsInfo,
          queueUrl: caseUrl,
          messages,
          error: 'WebSocket error event',
        });
      };

      setTimeout(() => finish({ ok: true, wsInfo, queueUrl: caseUrl, messages }), listenMs);
    });
  } catch (err: unknown) {
    return {
      ok: false,
      messages,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__importWsTest = {
    fetchImportWsInfo,
    testImportQueueWebSocket,
    testCaseProgressWebSocket,
  };
}
