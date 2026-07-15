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

const syncDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingQuestionSync = new Map<string, Set<string>>();

function enqueueAnswerSync(sessionId: string, questionId: string): void {
  const pending = pendingQuestionSync.get(sessionId) ?? new Set<string>();
  pending.add(questionId);
  pendingQuestionSync.set(sessionId, pending);
}

function scheduleAnswerSync(sessionId: string, flush: () => Promise<void>): void {
  const timer = syncDebounceTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
  }
  syncDebounceTimers.set(
    sessionId,
    setTimeout(() => {
      void flush();
    }, 300)
  );
}

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

        const nextAnswers = { ...answers, [question.id]: value };
        set({ answers: nextAnswers });
        enqueueAnswerSync(sessionId, question.id);
        scheduleAnswerSync(sessionId, async () => {
          const pending = pendingQuestionSync.get(sessionId);
          if (!pending || pending.size === 0) return;

          const snapshot = get();
          const batch = Array.from(pending).map((qid) => ({
            questionId: qid,
            value: snapshot.answers[qid],
          }));
          pendingQuestionSync.set(sessionId, new Set<string>());

          try {
            await assessmentService.submitAnswers(
              sessionId,
              batch.filter((item) => item.value !== undefined) as Array<{
                questionId: string;
                value: number | string;
              }>
            );
          } catch (error: unknown) {
            // Keep answers local and re-queue for the final completion sync.
            console.warn('[AssessmentFlowStore] Batched sync failed (kept locally):', error);
            const retrySet = pendingQuestionSync.get(sessionId) ?? new Set<string>();
            for (const item of batch) {
              retrySet.add(item.questionId);
            }
            pendingQuestionSync.set(sessionId, retrySet);
          }
        });

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
          const pending = pendingQuestionSync.get(sessionId) ?? new Set<string>();
          const stateSnapshot = get();
          const allQuestionIds = stateSnapshot.questions.map((q) => q.id);
          for (const qid of allQuestionIds) {
            if (stateSnapshot.answers[qid] !== undefined) {
              pending.add(qid);
            }
          }
          pendingQuestionSync.set(sessionId, pending);

          const flushBatch = Array.from(pending)
            .map((qid) => ({ questionId: qid, value: stateSnapshot.answers[qid] }))
            .filter((item): item is { questionId: string; value: number | string } => item.value !== undefined);

          if (flushBatch.length > 0) {
            await assessmentService.submitAnswers(sessionId, flushBatch);
            pendingQuestionSync.set(sessionId, new Set<string>());
          }

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
        const { sessionId } = get();
        if (sessionId) {
          const timer = syncDebounceTimers.get(sessionId);
          if (timer) {
            clearTimeout(timer);
            syncDebounceTimers.delete(sessionId);
          }
          pendingQuestionSync.delete(sessionId);
        }
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
      // On rehydrate, treat backend as canonical: fetch session questions and resume snapshot
      onRehydrateStorage: () => (persistedState) => {
        if (!persistedState || !persistedState.sessionId) return;
        const sessionId = persistedState.sessionId as string;
        // Defer so rehydration completes first
        setTimeout(() => {
          (async () => {
            try {
              const serverSession = await assessmentService.getSession(sessionId);
              const resume = await assessmentService.resume(sessionId);
              // Build answers map from resume (option_id keyed)
              const answers: Record<string, string> = {};
              if (resume?.answers) {
                for (const a of resume.answers) {
                  answers[a.question_id] = a.option_id;
                }
              }
              // Compute next index: first unanswered after last answered
              let lastAnswered = -1;
              for (let i = 0; i < serverSession.questions.length; i++) {
                if (answers[serverSession.questions[i].id] !== undefined) lastAnswered = i;
              }
              const nextIndex = Math.min(Math.max(0, lastAnswered + 1), Math.max(0, serverSession.questions.length - 1));

              set({
                sessionId: serverSession.sessionId,
                testType: serverSession.testType,
                ageBand: serverSession.ageBand,
                questions: serverSession.questions,
                currentIndex: nextIndex,
                answers,
                status: resume?.status === 'in_progress' ? 'in_progress' : (resume?.status ?? 'in_progress'),
                result: null,
              });
            } catch (err) {
              console.warn('[AssessmentFlowStore] resume initialization failed', err);
            }
          })();
        }, 0);
      },
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
