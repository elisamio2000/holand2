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
import { useAssessmentHistoryStore } from '@/store/assessment-history.store';
const sessionMeta = new Map<
  string,
  {
    testType: TestType;
    ageBand: AssessmentSession['ageBand'];
    optionLookup: Map<string, Map<string, string>>;
  }
>();

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
  assessment_type: 'holland' | 'mbti' | 'combined';
  status: 'in_progress' | 'completed' | 'abandoned';
  started_at: string;
  questions: ApiQuestion[];
}

interface ApiSessionResultOut {
  session_id: string;
  assessment_type: 'holland' | 'mbti' | 'combined';
  raw_scores: Record<string, number>;
  normalized_scores: Record<string, unknown>;
  code: string;
  certainty: Record<string, unknown> | null;
  holland?: {
    code: string;
    normalized_scores: Record<string, number>;
  } | null;
  mbti?: {
    code: string;
    normalized_scores: Record<string, number>;
    certainty?: Record<string, number> | null;
  } | null;
  computed_at: string;
}

function mapApiQuestionToUi(question: ApiQuestion, testType: TestType, order: number): AssessmentQuestion {
  const resolvedType =
    testType === 'combined' ? (question.kind === 'likert' ? 'holland' : 'mbti') : testType;
  return {
    id: question.id,
    order,
    testType: resolvedType,
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
  if (result.assessment_type === 'combined') {
    const hollandPayload =
      result.holland ??
      ((result.normalized_scores.holland as Record<string, number> | undefined)
        ? {
            code: result.code.split('-', 1)[0] ?? '',
            normalized_scores: result.normalized_scores.holland as Record<string, number>,
          }
        : null);
    const mbtiPayload =
      result.mbti ??
      ((result.normalized_scores.mbti as Record<string, number> | undefined)
        ? {
            code: result.code.includes('-') ? result.code.split('-')[1] : '',
            normalized_scores: result.normalized_scores.mbti as Record<string, number>,
            certainty: (result.certainty?.mbti as Record<string, number> | undefined) ?? null,
          }
        : null);

    return {
      sessionId: result.session_id,
      testType,
      ageBand,
      completedAt: result.computed_at,
      holland: hollandPayload
        ? {
            dimensions: toDimensions(hollandPayload.normalized_scores),
            top3Code: hollandPayload.code,
          }
        : undefined,
      mbti: mbtiPayload
        ? {
            dimensions: toDimensions(mbtiPayload.normalized_scores),
            typeCode: mbtiPayload.code,
          }
        : undefined,
    };
  }

  if (result.assessment_type === 'holland') {
    return {
      sessionId: result.session_id,
      testType,
      ageBand,
      completedAt: result.computed_at,
      holland: {
        dimensions: toDimensions(result.normalized_scores as Record<string, number>),
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
      dimensions: toDimensions(result.normalized_scores as Record<string, number>),
      typeCode: result.code,
    },
  };
}

export const assessmentService = {
  resolveOptionId(sessionId: string, questionId: string, value: number | string): string {
    const meta = sessionMeta.get(sessionId);
    const optionId =
      meta?.optionLookup.get(questionId)?.get(String(value)) ??
      (typeof value === 'string' ? value : null);
    if (!optionId) {
      throw new Error(`Could not resolve option id for question ${questionId}`);
    }
    return optionId;
  },

  async startSession(data: StartAssessmentRequest): Promise<AssessmentSession> {
    const res = await gatewayClient.post<ApiStartSessionOut>('/sessions/start', {
      assessment_type: data.testType,
      user_id: undefined,
    });
    const api = res.data;
    const mapped: AssessmentSession = {
      sessionId: api.session_id,
      testType: api.assessment_type,
      ageBand: data.ageBand,
      status: api.status,
      totalQuestions: api.questions.length,
      questions: api.questions.map((q, index) => mapApiQuestionToUi(q, api.assessment_type, index + 1)),
      createdAt: api.started_at,
      runCode: api.run_code ?? null,
      participantCode: api.participant_code ?? null,
    };
    const optionLookup = new Map<string, Map<string, string>>();
    for (const question of api.questions) {
      const lookupByValue = new Map<string, string>();
      for (const option of question.options) {
        lookupByValue.set(String(option.id), option.id);
        lookupByValue.set(String(option.value), option.id);
      }
      optionLookup.set(question.id, lookupByValue);
    }
    sessionMeta.set(mapped.sessionId, {
      testType: mapped.testType,
      ageBand: mapped.ageBand,
      optionLookup,
    });
    return mapped;
  },

  async resume(sessionId: string): Promise<import('@/services/assessment.service').ResumeSessionOut | null> {
    try {
      const res = await gatewayClient.get<any>(`/sessions/${sessionId}/resume`);
      return res.data;
    } catch (error) {
      console.warn('[assessmentService] resume failed, falling back to local state:', error);
      return null;
    }
  },

  async getSession(sessionId: string): Promise<AssessmentSession> {
    const meta = sessionMeta.get(sessionId);
    if (!meta) {
      throw new Error('Session metadata not available for this client');
    }

    const questionsRes = await gatewayClient.get<ApiQuestion[]>(`/sessions/${sessionId}/questions`);
    const summaryRes = await gatewayClient.get<{ status: AssessmentSession['status']; started_at: string }>(
      `/sessions/${sessionId}`
    );
    const optionLookup = new Map<string, Map<string, string>>();
    for (const question of questionsRes.data) {
      const lookupByValue = new Map<string, string>();
      for (const option of question.options) {
        lookupByValue.set(String(option.id), option.id);
        lookupByValue.set(String(option.value), option.id);
      }
      optionLookup.set(question.id, lookupByValue);
    }
    sessionMeta.set(sessionId, {
      testType: meta.testType,
      ageBand: meta.ageBand,
      optionLookup,
    });

    return {
      sessionId,
      testType: meta.testType,
      ageBand: meta.ageBand,
      status: summaryRes.data.status,
      totalQuestions: questionsRes.data.length,
      questions: questionsRes.data.map((q, index) => mapApiQuestionToUi(q, meta.testType, index + 1)),
      createdAt: summaryRes.data.started_at,
    };
  },

  async submitAnswer(payload: SubmitAnswerRequest): Promise<{ accepted: true }> {
    const optionId = this.resolveOptionId(payload.sessionId, payload.questionId, payload.value);
    await gatewayClient.post(`/sessions/${payload.sessionId}/answers`, {
      answers: [{ question_id: payload.questionId, option_id: optionId }],
    });
    return { accepted: true };
  },

  async submitAnswers(
    sessionId: string,
    answers: Array<{ questionId: string; value: number | string }>
  ): Promise<{ accepted: true; sent: number }> {
    if (!answers.length) {
      return { accepted: true, sent: 0 };
    }

    const payload = answers.map((answer) => ({
      question_id: answer.questionId,
      option_id: this.resolveOptionId(sessionId, answer.questionId, answer.value),
    }));

    await gatewayClient.post(`/sessions/${sessionId}/answers`, { answers: payload });
    return { accepted: true, sent: payload.length };
  },

  async submitEvents(sessionId: string, events: Array<any>): Promise<{ accepted: boolean } | null> {
    try {
      const payload = { events };
      const res = await gatewayClient.post(`/sessions/${sessionId}/events`, payload);
      return res.data;
    } catch (error) {
      console.warn('[assessmentService] submitEvents failed (feature-flag or network):', error);
      return null;
    }
  },

  async completeSession(sessionId: string): Promise<AssessmentResult> {
    const meta = sessionMeta.get(sessionId);
    if (!meta) {
      throw new Error('Session metadata not available for completion');
    }

    const res = await gatewayClient.post<ApiSessionResultOut>(`/sessions/${sessionId}/complete`);
    return mapApiResultToUi(res.data, meta.testType, meta.ageBand);
  },

  async getResult(sessionId: string): Promise<AssessmentResult> {
    const meta = sessionMeta.get(sessionId);
    if (!meta) {
      throw new Error('Session metadata not available for result lookup');
    }

    const res = await gatewayClient.get<ApiSessionResultOut>(`/sessions/${sessionId}/result`);
    return mapApiResultToUi(res.data, meta.testType, meta.ageBand);
  },

  async listMySessions(): Promise<AssessmentHistoryItem[]> {
    try {
      const res = await gatewayClient.get<{
        sessions: Array<{
          session_id: string;
          assessment_type: 'holland' | 'mbti' | 'combined';
          status: 'in_progress' | 'completed' | 'abandoned';
          top_code: string | null;
          started_at: string;
          completed_at: string | null;
          answered_count: number;
        }>;
        total: number;
        page: number;
        limit: number;
      }>('/sessions/my', { params: { limit: 100 } });

      // API is source of truth for status/top_code/dates. Use local cache only
      // for fields backend does not provide (ageBand, progressPercent) as hints.
      const localEntries = useAssessmentHistoryStore.getState().entries;
      const localMap = new Map(localEntries.map((e) => [e.sessionId, e]));

      const merged = res.data.sessions.map((s) => {
        const local = localMap.get(s.session_id);
        return {
          sessionId: s.session_id,
          testType: s.assessment_type,
          ageBand: local?.ageBand ?? '18-24',
          status: s.status,
          progressPercent:
            s.status === 'completed' ? 100 : local?.progressPercent ?? (s.answered_count > 0 ? 50 : 0),
          topCode: s.top_code ?? local?.topCode,
          startedAt: s.started_at,
          completedAt: s.completed_at ?? local?.completedAt,
        };
      });

      // Update local cache to reflect server truth (prune unknown ids)
      useAssessmentHistoryStore.getState().pruneToIds(new Set(merged.map((m) => m.sessionId)));
      for (const entry of merged) {
        useAssessmentHistoryStore.getState().upsertEntry(entry);
      }

      return merged;
    } catch (error) {
      console.warn('[assessmentService] listMySessions failed, returning local cache:', error);
      return useAssessmentHistoryStore.getState().entries;
    }
  },
};
