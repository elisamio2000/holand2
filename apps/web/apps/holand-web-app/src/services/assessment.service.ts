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
  AgeBand,
  AssessmentHistoryItem,
  AssessmentQuestion,
  AssessmentResult,
  AssessmentSession,
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
const sessionMeta = new Map<
  string,
  {
    testType: TestType;
    ageBand: AgeBand;
    optionLookup: Map<string, Map<string, string>>;
  }
>();

type ApiAssessmentType = 'holland' | 'mbti';

interface ApiQuestionOption {
  id: string;
  label: string;
  value: number;
  pole: string;
  order_index: number;
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
  assessment_type: ApiAssessmentType;
  started_at: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  questions: ApiQuestion[];
}

interface ApiSessionSummaryOut {
  session_id: string;
  assessment_type: ApiAssessmentType;
  started_at: string;
  status: 'in_progress' | 'completed' | 'abandoned';
}

interface ApiSessionResultOut {
  session_id: string;
  assessment_type: ApiAssessmentType;
  code: string;
  certainty: Record<string, number> | null;
  normalized_scores: Record<string, number>;
  computed_at: string;
}

function toAssessmentQuestion(
  question: ApiQuestion,
  testType: TestType,
  optionLookup: Map<string, Map<string, string>>
): AssessmentQuestion {
  const lookupByValue = new Map<string, string>();
  const options = question.options.map((option) => {
    const displayValue =
      question.kind === 'likert'
        ? option.value
        : `${question.dimension}:${option.pole}`;
    lookupByValue.set(String(displayValue), option.id);
    return { value: displayValue, label: option.label };
  });
  optionLookup.set(question.id, lookupByValue);
  return {
    id: question.id,
    order: question.order_index + 1,
    testType,
    dimension: question.dimension as AssessmentQuestion['dimension'],
    kind: question.kind === 'likert' ? 'likert5' : 'binary_choice',
    prompt: question.text,
    options,
  };
}

function toAssessmentResult(
  api: ApiSessionResultOut,
  testType: TestType,
  ageBand: AgeBand
): AssessmentResult {
  const result: AssessmentResult = {
    sessionId: api.session_id,
    testType,
    ageBand,
    completedAt: api.computed_at,
  };
  if (api.assessment_type === 'holland') {
    result.holland = {
      top3Code: api.code,
      dimensions: Object.entries(api.normalized_scores).map(([dimension, normalizedScore]) => ({
        dimension,
        label: dimension,
        rawScore: normalizedScore,
        normalizedScore,
      })),
    };
  } else {
    const certainty = api.certainty ?? {};
    result.mbti = {
      typeCode: api.code,
      dimensions: Object.entries(certainty).map(([dimension, normalizedScore]) => ({
        dimension,
        label: dimension,
        rawScore: normalizedScore,
        normalizedScore,
      })),
    };
  }
  return result;
}

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
    if (data.testType === 'combined') {
      const sessionId = generateMockSessionId();
      const session = buildMockSession(sessionId, data.testType, data.ageBand);
      mockSessions.set(sessionId, session);
      return session;
    }
    try {
      const res = await gatewayClient.post<ApiStartSessionOut>('/sessions/start', {
        assessment_type: data.testType,
      });
      const optionLookup = new Map<string, Map<string, string>>();
      const questions = res.data.questions.map((question) =>
        toAssessmentQuestion(question, data.testType, optionLookup)
      );
      const session: AssessmentSession = {
        sessionId: res.data.session_id,
        testType: data.testType,
        ageBand: data.ageBand,
        status: res.data.status,
        totalQuestions: questions.length,
        questions,
        createdAt: res.data.started_at,
      };
      sessionMeta.set(session.sessionId, {
        testType: session.testType,
        ageBand: session.ageBand,
        optionLookup,
      });
      return session;
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
      const [summary, questionsRes] = await Promise.all([
        gatewayClient.get<ApiSessionSummaryOut>(`/sessions/${sessionId}`),
        gatewayClient.get<ApiQuestion[]>(`/sessions/${sessionId}/questions`),
      ]);
      const meta = sessionMeta.get(sessionId);
      const testType = (summary.data.assessment_type as TestType) ?? meta?.testType ?? 'holland';
      const ageBand = meta?.ageBand ?? '18-24';
      const optionLookup = new Map<string, Map<string, string>>();
      const questions = questionsRes.data.map((question) =>
        toAssessmentQuestion(question, testType, optionLookup)
      );
      sessionMeta.set(sessionId, { testType, ageBand, optionLookup });
      return {
        sessionId: summary.data.session_id,
        testType,
        ageBand,
        status: summary.data.status,
        totalQuestions: questions.length,
        questions,
        createdAt: summary.data.started_at,
      };
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
      const meta = sessionMeta.get(payload.sessionId);
      const optionId =
        meta?.optionLookup.get(payload.questionId)?.get(String(payload.value)) ??
        (typeof payload.value === 'string' ? payload.value : null);
      if (!optionId) {
        throw new Error(`Could not resolve option id for question ${payload.questionId}`);
      }
      await gatewayClient.post(`/sessions/${payload.sessionId}/answers`, {
        answers: [{ question_id: payload.questionId, option_id: optionId }],
      });
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
      const res = await gatewayClient.post<ApiSessionResultOut>(`/sessions/${sessionId}/complete`);
      const meta = sessionMeta.get(sessionId);
      return toAssessmentResult(res.data, meta?.testType ?? (res.data.assessment_type as TestType), meta?.ageBand ?? '18-24');
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
      const res = await gatewayClient.get<ApiSessionResultOut>(`/sessions/${sessionId}/result`);
      const meta = sessionMeta.get(sessionId);
      return toAssessmentResult(res.data, meta?.testType ?? (res.data.assessment_type as TestType), meta?.ageBand ?? '18-24');
    } catch (error: unknown) {
      if (!isBackendUnavailable(error)) throw error;
      const cached = mockSessions.get(sessionId);
      console.warn('[AssessmentService] Backend unavailable — returning mock result.', error);
      return buildMockResult(sessionId, cached?.testType ?? 'combined', cached?.ageBand ?? '18-24');
    }
  },

  /**
   * List the current user's assessment sessions (in-progress + completed),
   * used by the "My Assessments" history page.
   *
   * @endpoint GET /assessments/sessions/mine
   */
  async listMySessions(): Promise<AssessmentHistoryItem[]> {
    console.info('[AssessmentService] Fetching my assessment history...');
    try {
      const res = await gatewayClient.get<AssessmentHistoryItem[]>('/assessments/sessions/mine');
      return res.data;
    } catch (error: unknown) {
      if (!isBackendUnavailable(error)) throw error;
      console.warn(
        '[AssessmentService] Backend unavailable — returning local/demo history.',
        error
      );
      const local = useAssessmentHistoryStore.getState().entries;
      return local.length ? local : buildMockHistory();
    }
  },
};
