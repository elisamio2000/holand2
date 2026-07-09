import { chatService } from '@/services/chat.service';
import { traceService } from '@/services/trace.service';
import type { UIMessage } from '@/types/chat.types';

export interface SessionMemoryExport {
  sessionId: string;
  memories: unknown[];
}

export interface SessionTraceExport {
  messageId: string;
  traceId: string;
  trace: unknown;
}

export async function fetchSessionMemories(sessionId: string): Promise<unknown[]> {
  try {
    return await chatService.getSessionMemories(sessionId);
  } catch {
    return [];
  }
}

export async function fetchMessageTraces(
  messages: UIMessage[]
): Promise<SessionTraceExport[]> {
  const assistantMessages = messages.filter((m) => m.role === 'assistant' && m.trace_id);
  const traces: SessionTraceExport[] = [];

  await Promise.all(
    assistantMessages.map(async (msg) => {
      if (!msg.trace_id) return;
      try {
        const trace = await traceService.getTrace(msg.trace_id);
        traces.push({
          messageId: msg.id,
          traceId: msg.trace_id,
          trace,
        });
      } catch {
        // skip missing traces
      }
    })
  );

  return traces;
}

export async function fetchExportEnrichment(
  sessionId: string,
  messages: UIMessage[],
  opts: { includeMemory?: boolean; includeTraces?: boolean }
): Promise<{ memories?: unknown[]; traces?: SessionTraceExport[] }> {
  const [memories, traces] = await Promise.all([
    opts.includeMemory ? fetchSessionMemories(sessionId) : Promise.resolve(undefined),
    opts.includeTraces ? fetchMessageTraces(messages) : Promise.resolve(undefined),
  ]);
  return { memories, traces };
}
