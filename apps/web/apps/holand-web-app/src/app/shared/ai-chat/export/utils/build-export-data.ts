import type { UIMessage } from '@/types/chat.types';
import type { ConversationExportData } from '../export-types';

export function buildConversationExportData(
  sessionId: string,
  title: string,
  messages: UIMessage[]
): ConversationExportData {
  const exportMessages = messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      id: message.id,
      role: message.role as 'user' | 'assistant',
      content: message.isStreaming
        ? message.streamContent || message.content || ''
        : message.content || '',
      thinking:
        message.thinking ||
        message.streamThinking ||
        undefined,
      artifacts: message.artifacts?.map((artifact) => ({
        id: artifact.id || artifact.path,
        filename: artifact.name || artifact.path.split('/').pop() || 'file',
        mimeType: artifact.mime_type || 'application/octet-stream',
        url: artifact.localPreviewUrl || artifact.path,
      })),
      toolRuns: message.tool_runs?.map((toolRun) => ({
        id: toolRun.tool_id,
        name: toolRun.tool_id,
        status: toolRun.status || 'completed',
        input: toolRun.args,
        output: toolRun.result,
      })),
      timestamp: message.created_at || new Date().toISOString(),
      feedback: message.feedback ?? null,
      processingTime: message.processing_time ?? undefined,
      totalTokens: message.total_tokens ?? undefined,
    }))
    .filter((message) => message.content.trim().length > 0);

  return {
    sessionId,
    title: title || 'Untitled Conversation',
    messages: exportMessages,
    metadata: {
      exportedAt: new Date().toISOString(),
      totalMessages: exportMessages.length,
      model:
        messages.find((message) => message.model)?.model ||
        'Unknown',
    },
  };
}
