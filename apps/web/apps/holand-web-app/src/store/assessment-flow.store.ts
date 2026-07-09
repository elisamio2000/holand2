// ============================================
// Assessment Flow Store (Zustand)
// Drives the question-by-question wizard: session bootstrap, current
// question, answer capture, progress, and completion.
//
// Persisted to localStorage (per sessionId) so a refresh or accidental
// tab-close doesn't lose progress — important for the 13-17 age band which
// is the most likely to abandon a long test.
// ============================================

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { assessmentService } from '@/services/assessment.service';
import { useAssessmentHistoryStore } from '@/store/assessment-history.store';
import type {
  AgeBand,
  AssessmentQuestion,
  AssessmentResult,
  TestType,
} from '@/types/assessment.types';

export type AssessmentFlowStatus =
  | 'idle'
  | 'starting'
  | 'in_progress'
  | 'submitting'
  | 'completed'
  | 'error';

interface AssessmentFlowState {
  sessionId: string | null;
  testType: TestType | null;
  ageBand: AgeBand | null;
  questions: AssessmentQuestion[];
  currentIndex: number;
  answers: Record<string, number | string>;
  status: AssessmentFlowStatus;
  result: AssessmentResult | null;
  error: string | null;

  startAssessment: (testType: TestType, ageBand: AgeBand) => Promise<string | null>;
  answerCurrent: (value: number | string) => Promise<void>;
  goToPrevious: () => void;
  goToNext: () => void;
  completeAssessment: () => Promise<AssessmentResult | null>;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  testType: null,
  ageBand: null,
  questions: [] as AssessmentQuestion[],
  currentIndex: 0,
  answers: {} as Record<string, number | string>,
  status: 'idle' as AssessmentFlowStatus,
  result: null as AssessmentResult | null,
  error: null as string | null,
};

export const useAssessmentFlowStore = create<AssessmentFlowState>()(
  persist(
    (set, get) => ({
      ...initialState,

      async startAssessment(testType, ageBand) {
        set({ status: 'starting', error: null });
        try {
          const session = await assessmentService.startSession({ testType, ageBand });
          set({
            sessionId: session.sessionId,
            testType: session.testType,
            ageBand: session.ageBand,
            questions: session.questions,
            currentIndex: 0,
            answers: {},
            status: 'in_progress',
            result: null,
          });
          useAssessmentHistoryStore.getState().upsertEntry({
            sessionId: session.sessionId,
            testType: session.testType,
            ageBand: session.ageBand,
            status: 'in_progress',
            progressPercent: Math.round((1 / Math.max(1, session.questions.length)) * 100),
            startedAt: session.createdAt,
          });
          return session.sessionId;
        } catch (error: unknown) {
          console.error('[AssessmentFlowStore] Failed to start session:', error);
          set({ status: 'error', error: 'شروع آزمون با خطا مواجه شد. دوباره تلاش کن.' });
          return null;
        }
      },

      async answerCurrent(value) {
        const { sessionId, questions, currentIndex, answers } = get();
        const question = questions[currentIndex];
        if (!sessionId || !question) return;

        set({ answers: { ...answers, [question.id]: value } });

        try {
          await assessmentService.submitAnswer({
            sessionId,
            questionId: question.id,
            value,
          });
        } catch (error: unknown) {
          // Answer is already stored locally/persisted; surfacing a hard
          // error here would break the flow for a non-critical sync issue.
          console.warn('[AssessmentFlowStore] Failed to sync answer (kept locally):', error);
        }

        const { testType, ageBand } = get();
        if (testType && ageBand) {
          const existing = useAssessmentHistoryStore
            .getState()
            .entries.find((e) => e.sessionId === sessionId);
          useAssessmentHistoryStore.getState().upsertEntry({
            sessionId,
            testType,
            ageBand,
            status: 'in_progress',
            progressPercent: Math.round(((currentIndex + 1) / questions.length) * 100),
            startedAt: existing?.startedAt ?? new Date().toISOString(),
          });
        }
      },

      goToPrevious() {
        set((state) => ({ currentIndex: Math.max(0, state.currentIndex - 1) }));
      },

      goToNext() {
        set((state) => ({
          currentIndex: Math.min(state.questions.length - 1, state.currentIndex + 1),
        }));
      },

      async completeAssessment() {
        const { sessionId, testType, ageBand } = get();
        if (!sessionId) return null;
        set({ status: 'submitting', error: null });
        try {
          const result = await assessmentService.completeSession(sessionId);
          set({ status: 'completed', result });
          if (testType && ageBand) {
            const existing = useAssessmentHistoryStore
              .getState()
              .entries.find((e) => e.sessionId === sessionId);
            useAssessmentHistoryStore.getState().upsertEntry({
              sessionId,
              testType,
              ageBand,
              status: 'completed',
              progressPercent: 100,
              topCode: result.holland?.top3Code ?? result.mbti?.typeCode,
              startedAt: existing?.startedAt ?? new Date().toISOString(),
              completedAt: result.completedAt,
            });
          }
          return result;
        } catch (error: unknown) {
          console.error('[AssessmentFlowStore] Failed to complete session:', error);
          set({ status: 'error', error: 'ثبت نتیجه آزمون با خطا مواجه شد.' });
          return null;
        }
      },

      reset() {
        set({ ...initialState });
      },
    }),
    {
      name: 'holand-assessment-flow',
      partialize: (state) => ({
        sessionId: state.sessionId,
        testType: state.testType,
        ageBand: state.ageBand,
        questions: state.questions,
        currentIndex: state.currentIndex,
        answers: state.answers,
        status: state.status,
        result: state.result,
      }),
    }
  )
);

/** Derived progress percentage (0-100), handy for progress bars. */
export function useAssessmentProgressPercent(): number {
  const questions = useAssessmentFlowStore((s) => s.questions);
  const currentIndex = useAssessmentFlowStore((s) => s.currentIndex);
  if (!questions.length) return 0;
  return Math.round(((currentIndex + 1) / questions.length) * 100);
}
