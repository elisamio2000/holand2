// ============================================
// Holand Trace Service
// API calls for Agent Tracing & Planning (Gateway :8000)
// Endpoints: /traces, /traces/{id}, /traces/{id}/steps, etc.
// ============================================

import { gatewayClient } from '@/lib/api-client';
import type {
  TraceSummary,
  TraceDetail,
  TraceStep,
  TraceToolExecution,
  TraceEvent,
  TraceFeedbackRequest,
  TraceFeedbackResponse,
} from '@/types/chat.types';

/**
 * traceService â€” Agent Tracing & Planning API.
 *
 * Provides access to the Planning Agent's execution traces:
 * - List/filter traces by session, status
 * - Get full trace details with steps, tools, events
 * - Get latest trace for a session
 *
 * All endpoints require JWT authentication via API Gateway (port 8000).
 *
 * @requires gatewayClient â€” authenticated axios instance for API Gateway
 */
export const traceService = {
  // ==========================================
  // Traces (GET /traces)
  // ==========================================

  /**
   * List traces with optional filters.
   *
   * @endpoint GET /traces
   * @param params.session_id - Filter by session ID
   * @param params.status - Filter by status: running, completed, failed
   * @param params.limit - Max results (default 50)
   * @param params.offset - Pagination offset
   * @returns Array of trace summaries
   * @throws {AxiosError} 401 if not authenticated
   */
  async listTraces(params?: {
    session_id?: string;
    status?: 'running' | 'completed' | 'failed';
    limit?: number;
    offset?: number;
  }): Promise<TraceSummary[]> {
    console.info('[TraceService] Listing traces:', { params });
    try {
      const res = await gatewayClient.get<TraceSummary[]>('/traces', { params });
      const traces = Array.isArray(res.data) ? res.data : [];
      console.info('[TraceService] Traces listed:', { count: traces.length });
      return traces;
    } catch (error: unknown) {
      console.error('[TraceService] Failed to list traces:', { params, error });
      throw error;
    }
  },

  /**
   * Get full details of a specific trace.
   *
   * @endpoint GET /traces/{trace_id}?full=true
   * @param traceId - Trace ID
   * @param full - Include steps, tools, events (default true)
   * @returns Full trace detail with steps, tools, events
   * @throws {AxiosError} 404 if trace not found
   */
  async getTrace(traceId: string, full = true): Promise<TraceDetail> {
    console.info('[TraceService] Getting trace detail:', { traceId, full });
    try {
      const res = await gatewayClient.get<TraceDetail>(`/traces/${traceId}`, {
        params: { full },
      });
      console.info('[TraceService] Trace detail fetched:', {
        traceId,
        status: res.data.status,
        totalSteps: res.data.total_steps,
        totalToolCalls: res.data.total_tool_calls,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[TraceService] Failed to get trace:', { traceId, error });
      throw error;
    }
  },

  /**
   * Get processing steps for a trace.
   *
   * Steps represent the agent pipeline stages:
   * assess_complexity â†’ planner â†’ executor â†’ critic â†’ synthesizer
   *
   * @endpoint GET /traces/{trace_id}/steps
   * @param traceId - Trace ID
   * @returns Array of processing steps ordered by step_number
   * @throws {AxiosError} 404 if trace not found
   */
  async getTraceSteps(traceId: string): Promise<TraceStep[]> {
    console.info('[TraceService] Getting trace steps:', { traceId });
    try {
      const res = await gatewayClient.get<TraceStep[]>(`/traces/${traceId}/steps`);
      const steps = Array.isArray(res.data) ? res.data : [];
      console.info('[TraceService] Steps fetched:', { traceId, count: steps.length });
      return steps;
    } catch (error: unknown) {
      console.error('[TraceService] Failed to get trace steps:', { traceId, error });
      throw error;
    }
  },

  /**
   * Get tool executions for a trace.
   *
   * Includes both raw result and result_sent_to_llm (formatted text
   * that was actually sent to the language model).
   *
   * @endpoint GET /traces/{trace_id}/tools
   * @param traceId - Trace ID
   * @returns Array of tool executions with arguments and results
   * @throws {AxiosError} 404 if trace not found
   */
  async getTraceTools(traceId: string): Promise<TraceToolExecution[]> {
    console.info('[TraceService] Getting trace tools:', { traceId });
    try {
      const res = await gatewayClient.get<TraceToolExecution[]>(
        `/traces/${traceId}/tools`
      );
      const tools = Array.isArray(res.data) ? res.data : [];
      console.info('[TraceService] Tools fetched:', {
        traceId,
        count: tools.length,
        toolNames: tools.map((t) => t.tool_name),
      });
      return tools;
    } catch (error: unknown) {
      console.error('[TraceService] Failed to get trace tools:', { traceId, error });
      throw error;
    }
  },

  /**
   * Get stream events for a trace (for replay functionality).
   *
   * Events include: step_started, step_completed, thinking,
   * tool_started, tool_completed, token, error.
   *
   * @endpoint GET /traces/{trace_id}/events
   * @param traceId - Trace ID
   * @returns Array of events ordered by sequence_number
   * @throws {AxiosError} 404 if trace not found
   */
  async getTraceEvents(traceId: string): Promise<TraceEvent[]> {
    console.info('[TraceService] Getting trace events:', { traceId });
    try {
      const res = await gatewayClient.get<TraceEvent[]>(
        `/traces/${traceId}/events`
      );
      const events = Array.isArray(res.data) ? res.data : [];
      console.info('[TraceService] Events fetched:', { traceId, count: events.length });
      return events;
    } catch (error: unknown) {
      console.error('[TraceService] Failed to get trace events:', { traceId, error });
      throw error;
    }
  },

  /**
   * Get the latest trace for a session.
   * Useful for showing trace status of the most recent message.
   *
   * @endpoint GET /traces/session/{session_id}/latest
   * @param sessionId - Session ID
   * @returns Latest trace summary for the session
   * @throws {AxiosError} 404 if no traces found for session
   */
  async getLatestTrace(sessionId: string): Promise<TraceSummary> {
    console.info('[TraceService] Getting latest trace:', { sessionId });
    try {
      const res = await gatewayClient.get<TraceSummary>(
        `/traces/session/${sessionId}/latest`
      );
      console.info('[TraceService] Latest trace fetched:', {
        sessionId,
        traceId: res.data.trace_id,
        status: res.data.status,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[TraceService] Failed to get latest trace:', { sessionId, error });
      throw error;
    }
  },

  // ==========================================
  // Trace Feedback (PUT/GET /traces/{id}/feedback)
  // ==========================================

  /**
   * Submit or update feedback for a trace.
   *
   * Allows thumbs up/down rating and optional comment on the agent's response.
   * Rating values: 1 (thumbs up), -1 (thumbs down), 0 (neutral/reset).
   * Idempotent â€” calling again updates the existing feedback.
   *
   * @endpoint PUT /traces/{trace_id}/feedback
   * @param traceId - Trace ID to submit feedback for
   * @param feedback - Rating (-1|0|1) and optional comment (max 2000 chars)
   * @returns Updated feedback record with user_feedback_rating, comment, timestamp
   * @throws {AxiosError} 404 if trace not found
   */
  async submitFeedback(
    traceId: string,
    feedback: TraceFeedbackRequest
  ): Promise<TraceFeedbackResponse> {
    console.info('[TraceService] Submitting trace feedback:', { traceId, rating: feedback.rating });
    try {
      const res = await gatewayClient.put<TraceFeedbackResponse>(
        `/traces/${traceId}/feedback`,
        feedback
      );
      console.info('[TraceService] Feedback submitted:', {
        traceId,
        rating: res.data.user_feedback_rating,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[TraceService] Failed to submit feedback:', { traceId, error });
      throw error;
    }
  },

  /**
   * Get existing feedback for a trace.
   *
   * @endpoint GET /traces/{trace_id}/feedback
   * @param traceId - Trace ID
   * @returns Feedback record if exists, null if no feedback yet
   * @throws {AxiosError} 404 if trace not found
   */
  async getFeedback(traceId: string): Promise<TraceFeedbackResponse | null> {
    console.info('[TraceService] Getting trace feedback:', { traceId });
    try {
      const res = await gatewayClient.get<TraceFeedbackResponse>(
        `/traces/${traceId}/feedback`
      );
      console.info('[TraceService] Feedback fetched:', {
        traceId,
        rating: res.data.user_feedback_rating,
      });
      return res.data;
    } catch (error: unknown) {
      // 404 = no feedback yet, not an error
      const axiosErr = error as { response?: { status?: number } };
      if (axiosErr.response?.status === 404) {
        console.info('[TraceService] No feedback found for trace:', { traceId });
        return null;
      }
      console.error('[TraceService] Failed to get feedback:', { traceId, error });
      throw error;
    }
  },
};

