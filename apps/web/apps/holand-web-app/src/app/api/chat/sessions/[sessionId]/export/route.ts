// ============================================
// Chat Export API — Get conversation data for export
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { getGatewayUrl } from '@/lib/service-urls';
import type { ChatMessage, ChatSession, MessageFeedback } from '@/types/chat.types';

type BackendChatMessage = ChatMessage & {
  timestamp?: string;
  feedback?: MessageFeedback | null;
};

type BackendSessionResponse = Omit<ChatSession, 'messages'> & {
  messages?: BackendChatMessage[];
};

/**
 * GET /api/chat/sessions/[sessionId]/export
 *
 * Fetch conversation data for export via API Gateway.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionId = params.sessionId;
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const accessToken = session.user.accessToken;
    if (!accessToken) {
      return NextResponse.json({ error: 'Missing access token' }, { status: 401 });
    }

    const gatewayUrl = getGatewayUrl();
    const backendResponse = await fetch(`${gatewayUrl}/chat/sessions/${sessionId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch conversation from backend' },
        { status: backendResponse.status }
      );
    }

    const backendData = (await backendResponse.json()) as BackendSessionResponse;

    const exportData = {
      sessionId: backendData.id,
      title: backendData.title || 'Untitled Conversation',
      messages: (backendData.messages || []).map((msg: BackendChatMessage) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        thinking: msg.thinking,
        artifacts: msg.artifacts,
        toolRuns: msg.tool_runs,
        timestamp: msg.created_at || msg.timestamp,
        feedback: msg.feedback,
        processingTime: msg.processing_time,
        totalTokens: msg.total_tokens,
      })),
      metadata: {
        exportedAt: new Date().toISOString(),
        totalMessages: backendData.messages?.length || 0,
        model: backendData.model || 'Unknown',
        userId: session.user.id,
      },
    };

    return NextResponse.json(exportData);
  } catch (error) {
    console.error('[Export API] Error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
