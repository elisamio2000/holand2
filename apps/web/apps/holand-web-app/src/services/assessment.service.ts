// ============================================
// Holand Assessment Service
// Canonical runtime integration aligned to backend /sessions endpoints.
// ============================================

import { gatewayClient } from '@/lib/api-client';
import type {
  AssessmentHistoryItem,
  AssessmentQuestion,
  AssessmentResult,
  AssessmentSession,
  DimensionScore,
  StartAssessmentRequest,
  SubmitAnswerRequest,
  TestType,
} from '@/types/assessment.types';
import {
  buildMockHistory,
  buildMockResult,
  buildMockSession,
  generateMockSessionId,
} from './assessment-mock-data';
import { useAssessmentHistoryStore } from '@/store/assessment-history.store';

const mockSessions = new Map<string, AssessmentSession>();
const sessionMeta = new Map<string, { testType: TestType; ageBand: AssessmentSession['ageBand'] }>();

interface ApiQuestionOption {
  id: string;
  label: string;
  value: number;
}

interface ApiQuestion {
  id: string;
  kind: 'likert' | 'forced_choice';
  dimension: string;
  text: string;
  order_index: number;
  options: ApiQuestionOption[];
}

interface ApiStartSessionOut {
  session_id: string;
  assessment_type: 'holland' | 'mbti';
  status: 'in_progress' | 'completed' | 'abandoned';
  started_at: string;
  questions: ApiQuestion[];
}

interface ApiSessionResultOut {
  session_id: string;
  assessment_type: 'holland' | 'mbti';
  raw_scores: Record<string, number>;
  normalized_scores: Record<string, number>;
  code: string;
  certainty: Record<string, number> | null;
  computed_at: string;
}

function isBackendUnavailable(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === undefined || status === 404 || status === 501;
}

function isUnsupportedCombined(testType: TestType): boolean {
  return testType === 'combined';
}

function mapApiQuestionToUi(question: ApiQuestion, testType: TestType): AssessmentQuestion {
  return {
    id: question.id,
    order: question.order_index + 1,
    testType,
    dimension: question.dimension as AssessmentQuestion['dimension'],
    kind: question.kind === 'likert' ? 'likert5' : 'binary_choice',
    prompt: question.text,
    options: question.options.map((option) => ({
      value: option.id,
      label: option.label,
    })),
  };
}

function toDimensions(scores: Record<string, number>): DimensionScore[] {
  return Object.entries(scores).map(([dimension, value]) => ({
    dimension,
    label: dimension,
    rawScore: value,
    normalizedScore: value,
  }));
}

function mapApiResultToUi(
  result: ApiSessionResultOut,
  testType: TestType,
  ageBand: AssessmentSession['ageBand']
): AssessmentResult {
  if (result.assessment_type === 'holland') {
    return {
      sessionId: result.session_id,
      testType,
      ageBand,
      completedAt: result.computed_at,
      holland: {
        dimensions: toDimensions(result.normalized_scores),
        top3Code: result.code,
      },
    };
  }
  return {
    sessionId: result.session_id,
    testType,
    ageBand,
    completedAt: result.computed_at,
    mbti: {
      dimensions: toDimensions(result.normalized_scores),
      typeCode: result.code,
    },
  };
}

export const assessmentService = {
  async startSession(data: StartAssessmentRequest): Promise<AssessmentSession> {
    if (isUnsupportedCombined(data.testType)) {
      const sessionId = generateMockSessionId();
      const session = buildMockSession(sessionId, data.testType, data.ageBand);
      mockSessions.set(sessionId, session);
      sessionMeta.set(sessionId, { testType: data.testType, ageBand: data.ageBand });
      return session;
    }

    try {
      const res = await gatewayClient.post<ApiStartSessionOut>('/sessions/start', {
        assessment_type: data.testType,
      });
      const api = res.data;
      const mapped: AssessmentSession = {
        sessionId: api.session_id,
        testType: api.assessment_type,
        ageBand: data.ageBand,
        status: api.status,
        totalQuestions: api.questions.length,
        questions: api.questions.map((q) => mapApiQuestionToUi(q, api.assessment_type)),
        createdAt: api.started_at,
      };
      sessionMeta.set(mapped.sessionId, { testType: mapped.testType, ageBand: mapped.ageBand });
      return mapped;
    } catch (error: unknown) {
      if (!isBackendUnavailable(error)) throw error;
      const sessionId = generateMockSessionId();
      const session = buildMockSession(sessionId, data.testType, data.ageBand);
      mockSessions.set(sessionId, session);
      sessionMeta.set(sessionId, { testType: data.testType, ageBand: data.ageBand });
      return session;
    }
  },

  async getSession(sessionId: string): Promise<AssessmentSession> {
    const cached = mockSessions.get(sessionId);
    if (cached) return cached;

    const meta = sessionMeta.get(sessionId);
    if (!meta) {
      throw new Error('Session metadata not available for this client');
    }

    const questionsRes = await gatewayClient.get<ApiQuestion[]>(`/sessions/${sessionId}/questions`);
    const summaryRes = await gatewayClient.get<{ status: AssessmentSession['status']; started_at: string }>(
      `/sessions/${sessionId}`
    );

    return {
      sessionId,
      testType: meta.testType,
      ageBand: meta.ageBand,
      status: summaryRes.data.status,
      totalQuestions: questionsRes.data.length,
      questions: questionsRes.data.map((q) => mapApiQuestionToUi(q, meta.testType)),
      createdAt: summaryRes.data.started_at,
    };
  },

  async submitAnswer(payload: SubmitAnswerRequest): Promise<{ accepted: true }> {
    try {
      await gatewayClient.post(`/sessions/${payload.sessionId}/answers`, {
        answers: [{ question_id: payload.questionId, option_id: String(payload.value) }],
      });
      return { accepted: true };
    } catch (error: unknown) {
      if (!isBackendUnavailable(error)) throw error;
      return { accepted: true };
    }
  },

  async completeSession(sessionId: string): Promise<AssessmentResult> {
    const meta = sessionMeta.get(sessionId);
    if (!meta) {
      const cached = mockSessions.get(sessionId);
      return buildMockResult(sessionId, cached?.testType ?? 'combined', cached?.ageBand ?? '18-24');
    }

    if (isUnsupportedCombined(meta.testType)) {
      return buildMockResult(sessionId, meta.testType, meta.ageBand);
    }

    try {
      const res = await gatewayClient.post<ApiSessionResultOut>(`/sessions/${sessionId}/complete`);
      return mapApiResultToUi(res.data, meta.testType, meta.ageBand);
    } catch (error: unknown) {
      if (!isBackendUnavailable(error)) throw error;
      return buildMockResult(sessionId, meta.testType, meta.ageBand);
    }
  },

  async getResult(sessionId: string): Promise<AssessmentResult> {
    const meta = sessionMeta.get(sessionId);
    if (!meta) {
      const cached = mockSessions.get(sessionId);
      return buildMockResult(sessionId, cached?.testType ?? 'combined', cached?.ageBand ?? '18-24');
    }

    if (isUnsupportedCombined(meta.testType)) {
      return buildMockResult(sessionId, meta.testType, meta.ageBand);
    }

    try {
      const res = await gatewayClient.get<ApiSessionResultOut>(`/sessions/${sessionId}/result`);
      return mapApiResultToUi(res.data, meta.testType, meta.ageBand);
    } catch (error: unknown) {
      if (!isBackendUnavailable(error)) throw error;
      return buildMockResult(sessionId, meta.testType, meta.ageBand);
    }
  },

  async listMySessions(): Promise<AssessmentHistoryItem[]> {
    const local = useAssessmentHistoryStore.getState().entries;
    return local.length ? local : buildMockHistory();
  },
};
