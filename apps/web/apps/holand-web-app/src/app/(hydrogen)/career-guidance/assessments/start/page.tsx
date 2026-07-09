// ============================================
// Assessment Start Page
// Lets the user pick a test type (Holland / MBTI / Combined) and confirm
// their age band, then kicks off a new assessment session via the Zustand
// assessment-flow store and redirects into the question flow.
// ============================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Text, Title } from 'rizzui';
import cn from '@/lib/cn';
import { AGE_BANDS, getAgeBandTheme } from '@/config/age-bands';
import { useAssessmentFlowStore } from '@/store/assessment-flow.store';
import type { AgeBand, TestType } from '@/types/assessment.types';

const TEST_TYPE_OPTIONS: { value: TestType; title: string; description: string }[] = [
  {
    value: 'holland',
    title: 'آزمون هالند (RIASEC)',
    description: 'شناسایی علایق شغلی در ۶ بعد اصلی',
  },
  {
    value: 'mbti',
    title: 'آزمون MBTI',
    description: 'شناخت سبک شخصیتی در ۴ بُعد دوقطبی',
  },
  {
    value: 'combined',
    title: 'آزمون ترکیبی (پیشنهادی)',
    description: 'ترکیب علاقه شغلی و سبک شخصیتی برای گزارش کامل‌تر',
  },
];

export default function AssessmentStartPage() {
  const router = useRouter();
  const startAssessment = useAssessmentFlowStore((s) => s.startAssessment);
  const status = useAssessmentFlowStore((s) => s.status);
  const error = useAssessmentFlowStore((s) => s.error);

  const [testType, setTestType] = useState<TestType>('combined');
  const [ageBand, setAgeBand] = useState<AgeBand>('18-24');

  const isStarting = status === 'starting';

  async function handleStart() {
    const sessionId = await startAssessment(testType, ageBand);
    if (sessionId) {
      router.push(`/career-guidance/assessments/${sessionId}`);
    }
  }

  const theme = getAgeBandTheme(ageBand);

  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8 lg:p-10">
      <Title as="h1" className="text-2xl font-bold text-gray-900 sm:text-3xl">
        شروع آزمون
      </Title>
      <Text className="mt-3 text-sm leading-7 text-gray-600">{theme.intro}</Text>

      <section className="mt-8">
        <Title as="h2" className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          نوع آزمون را انتخاب کن
        </Title>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {TEST_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTestType(option.value)}
              className={cn(
                'rounded-xl border p-4 text-right transition',
                testType === option.value
                  ? 'border-emerald-600 bg-emerald-50'
                  : 'border-muted bg-white hover:border-emerald-300'
              )}
            >
              <Text className="font-semibold text-gray-900">{option.title}</Text>
              <Text className="mt-1 text-xs leading-5 text-gray-500">{option.description}</Text>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <Title as="h2" className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          گروه سنی
        </Title>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {AGE_BANDS.map((band) => {
            const bandTheme = getAgeBandTheme(band);
            return (
              <button
                key={band}
                type="button"
                onClick={() => setAgeBand(band)}
                className={cn(
                  'rounded-xl border p-4 text-right transition',
                  ageBand === band
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-muted bg-white hover:border-indigo-300'
                )}
              >
                <Text className="font-semibold text-gray-900">{bandTheme.label}</Text>
              </button>
            );
          })}
        </div>
      </section>

      {error && (
        <Text className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</Text>
      )}

      <div className="mt-10 flex justify-end">
        <Button size="lg" onClick={handleStart} isLoading={isStarting} className="min-w-[160px]">
          شروع آزمون
        </Button>
      </div>
    </main>
  );
}
