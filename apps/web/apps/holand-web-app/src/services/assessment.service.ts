// ============================================
// Holand Assessment Service
// Handles the assessment session lifecycle: start -> answer -> complete -> result.
// All requests go through the API Gateway (see @/lib/api-client).
//
// The Assessment Engine backend (Phase 2-3) is being built in parallel. If a
// call fails (network error / 404 while the backend isn't deployed yet), we
// fall back to deterministic local mock data so the Phase 6 flow stays fully
// usable for development, design review and demos. Once the real endpoints
// are stable, the fallbacks can be removed.
// ============================================

import { gatewayClient } from '@/lib/api-client';
import type {
  AssessmentResult,
  AssessmentSession,
  StartAssessmentRequest,
  SubmitAnswerRequest,
} from '@/types/assessment.types';
import {
  buildMockResult,
  buildMockSession,
  generateMockSessionId,
} from './assessment-mock-data';

const mockSessions = new Map<string, AssessmentSession>();

function isBackendUnavailable(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  // No response at all (network error) or route not implemented yet.
  return status === undefined || status === 404 || status === 501;
}

export const assessmentService = {
  /**
   * Start a new assessment session.
   *
   * @endpoint POST /assessments/sessions
   */
  async startSession(data: StartAssessmentRequest): Promise<AssessmentSession> {
    console.info('[AssessmentService] Starting session:', data);
    try {
      const res = await gatewayClient.post<AssessmentSession>('/assessments/sessions', data);
      return res.data;
    } catch (error: unknown) {
      if (!isBackendUnavailable(error)) throw error;
      console.warn(
        '[AssessmentService] Backend unavailable — falling back to mock session.',
        error
      );
      const sessionId = generateMockSessionId();
      const session = buildMockSession(sessionId, data.testType, data.ageBand);
      mockSessions.set(sessionId, session);
      return session;
    }
  },

  /**
   * Fetch an existing session (questions + progress).
   *
   * @endpoint GET /assessments/sessions/{sessionId}
   */
  async getSession(sessionId: string): Promise<AssessmentSession> {
    try {
      const res = await gatewayClient.get<AssessmentSession>(
        `/assessments/sessions/${sessionId}`
      );
      return res.data;
    } catch (error: unknown) {
      if (!isBackendUnavailable(error)) throw error;
      const cached = mockSessions.get(sessionId);
      if (cached) return cached;
      console.warn(
        '[AssessmentService] Backend unavailable and no cached mock session — regenerating.',
        error
      );
      const session = buildMockSession(sessionId, 'combined', '18-24');
      mockSessions.set(sessionId, session);
      return session;
    }
  },

  /**
   * Submit a single answer. Called after every question so progress is
   * never lost (important for the 13-17 age band which drops off easily).
   *
   * @endpoint POST /assessments/sessions/{sessionId}/answers
   */
  async submitAnswer(payload: SubmitAnswerRequest): Promise<{ accepted: true }> {
    try {
      await gatewayClient.post(
        `/assessments/sessions/${payload.sessionId}/answers`,
        payload
      );
      return { accepted: true };
    } catch (error: unknown) {
      if (!isBackendUnavailable(error)) throw error;
      console.warn('[AssessmentService] Backend unavailable — answer kept client-side only.', error);
      return { accepted: true };
    }
  },

  /**
   * Mark the session complete and trigger scoring.
   *
   * @endpoint POST /assessments/sessions/{sessionId}/complete
   */
  async completeSession(sessionId: string): Promise<AssessmentResult> {
    try {
      const res = await gatewayClient.post<AssessmentResult>(
        `/assessments/sessions/${sessionId}/complete`
      );
      return res.data;
    } catch (error: unknown) {
      if (!isBackendUnavailable(error)) throw error;
      const cached = mockSessions.get(sessionId);
      const result = buildMockResult(
        sessionId,
        cached?.testType ?? 'combined',
        cached?.ageBand ?? '18-24'
      );
      console.warn('[AssessmentService] Backend unavailable — returning mock result.', error);
      return result;
    }
  },

  /**
   * Fetch the scored result for a completed session (used by the result
   * summary page on refresh/direct navigation).
   *
   * @endpoint GET /assessments/sessions/{sessionId}/result
   */
  async getResult(sessionId: string): Promise<AssessmentResult> {
    try {
      const res = await gatewayClient.get<AssessmentResult>(
        `/assessments/sessions/${sessionId}/result`
      );
      return res.data;
    } catch (error: unknown) {
      if (!isBackendUnavailable(error)) throw error;
      const cached = mockSessions.get(sessionId);
      console.warn('[AssessmentService] Backend unavailable — returning mock result.', error);
      return buildMockResult(sessionId, cached?.testType ?? 'combined', cached?.ageBand ?? '18-24');
    }
  },
};
