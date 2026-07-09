// ============================================
// Assessment Question Flow Page
// Renders the current question via <QuestionCard/>, wires it up to the
// Zustand assessment-flow store, shows progress, and redirects to the
// result summary once the session is complete.
// ============================================

'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Text } from 'rizzui';
import QuestionCard from '@/app/shared/assessment/question-card';
import {
  useAssessmentFlowStore,
  useAssessmentProgressPercent,
} from '@/store/assessment-flow.store';

export default function AssessmentQuestionPage() {
  const router = useRouter();
  const params = useParams<{ sessionId: string }>();

  const sessionId = useAssessmentFlowStore((s) => s.sessionId);
  const ageBand = useAssessmentFlowStore((s) => s.ageBand);
  const questions = useAssessmentFlowStore((s) => s.questions);
  const currentIndex = useAssessmentFlowStore((s) => s.currentIndex);
  const answers = useAssessmentFlowStore((s) => s.answers);
  const status = useAssessmentFlowStore((s) => s.status);
  const answerCurrent = useAssessmentFlowStore((s) => s.answerCurrent);
  const goToPrevious = useAssessmentFlowStore((s) => s.goToPrevious);
  const goToNext = useAssessmentFlowStore((s) => s.goToNext);
  const completeAssessment = useAssessmentFlowStore((s) => s.completeAssessment);
  const progressPercent = useAssessmentProgressPercent();

  // Guard: if the store doesn't have a matching session (e.g. deep link or
  // page reload lost in-memory state before persisted rehydration), send the
  // user back to start a new one rather than showing a broken page.
  useEffect(() => {
    if (status === 'idle' && sessionId && sessionId !== params.sessionId) {
      router.replace('/career-guidance/assessments/start');
    }
  }, [status, sessionId, params.sessionId, router]);

  const question = questions[currentIndex];

  async function handleNext() {
    if (currentIndex === questions.length - 1) {
      const result = await completeAssessment();
      if (result) {
        router.push(`/career-guidance/assessments/${params.sessionId}/result`);
      }
      return;
    }
    goToNext();
  }

  if (!question || !ageBand) {
    return (
      <main className="mx-auto w-full max-w-2xl p-6 sm:p-8 lg:p-10">
        <Text className="text-sm text-gray-500">
          نشستی برای این آزمون پیدا نشد. برای شروع دوباره به صفحه شروع آزمون برو.
        </Text>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl p-6 sm:p-8 lg:p-10">
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            سوال {currentIndex + 1} از {questions.length}
          </span>
          <span>{progressPercent}%</span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <QuestionCard
        key={question.id}
        question={question}
        ageBand={ageBand}
        value={answers[question.id]}
        onAnswer={answerCurrent}
        onPrevious={goToPrevious}
        onNext={handleNext}
        canGoPrevious={currentIndex > 0}
        isLast={currentIndex === questions.length - 1}
      />
    </main>
  );
}
