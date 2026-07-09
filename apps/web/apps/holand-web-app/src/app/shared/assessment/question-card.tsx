// ============================================
// QuestionCard — the core building block of the assessment flow.
// Renders either a 5-point Likert scale (Holland) or a binary choice
// (MBTI) question, adapting tone/density/labels to the user's age band.
// ============================================

'use client';

import { Button, Text, Title } from 'rizzui';
import cn from '@/lib/cn';
import type { AssessmentQuestion, AgeBand } from '@/types/assessment.types';
import {
  getAgeBandTheme,
  LIKERT_LABELS_FULL,
  LIKERT_LABELS_SIMPLIFIED,
} from '@/config/age-bands';

interface QuestionCardProps {
  question: AssessmentQuestion;
  ageBand: AgeBand;
  value?: number | string;
  onAnswer: (value: number | string) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  canGoPrevious?: boolean;
  isLast?: boolean;
  className?: string;
}

export default function QuestionCard({
  question,
  ageBand,
  value,
  onAnswer,
  onPrevious,
  onNext,
  canGoPrevious,
  isLast,
  className,
}: QuestionCardProps) {
  const theme = getAgeBandTheme(ageBand);
  const prompt = question.promptByAgeBand?.[ageBand] ?? question.prompt;
  const isLikert = question.kind === 'likert5';
  const useSimplified = isLikert && theme.simplifiedLikertLabels;

  return (
    <div
      className={cn(
        'rounded-2xl border border-muted bg-white p-6 shadow-sm sm:p-8',
        className
      )}
    >
      <div className={cn('h-1.5 w-16 rounded-full bg-gradient-to-r', theme.accentClassName)} />

      <Title
        as="h2"
        className={cn(
          'mt-5 font-semibold text-gray-900',
          theme.fontScale === 'lg' ? 'text-2xl leading-9' : 'text-lg leading-8'
        )}
      >
        {prompt}
      </Title>

      <Text className="mt-2 text-sm text-gray-500">{theme.encouragement}</Text>

      <div className="mt-6">
        {isLikert ? (
          <LikertOptions
            options={question.options}
            value={value}
            useSimplified={useSimplified}
            fontScale={theme.fontScale}
            onSelect={onAnswer}
          />
        ) : (
          <BinaryOptions
            options={question.options}
            value={value}
            fontScale={theme.fontScale}
            onSelect={onAnswer}
          />
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button
          variant="text"
          onClick={onPrevious}
          disabled={!canGoPrevious}
          className="text-gray-600"
        >
          قبلی
        </Button>
        <Button onClick={onNext} disabled={value === undefined} className="min-w-[100px]">
          {isLast ? 'پایان آزمون' : 'بعدی'}
        </Button>
      </div>
    </div>
  );
}

function LikertOptions({
  options,
  value,
  useSimplified,
  fontScale,
  onSelect,
}: {
  options: AssessmentQuestion['options'];
  value?: number | string;
  useSimplified: boolean;
  fontScale: 'lg' | 'base';
  onSelect: (value: number | string) => void;
}) {
  // Map the 5 raw option values onto either the full 5-label scale or a
  // compressed 3-label scale for younger users, while still submitting the
  // original underlying value so backend scoring stays consistent.
  const labels = useSimplified ? LIKERT_LABELS_SIMPLIFIED : LIKERT_LABELS_FULL;
  const displayOptions = useSimplified
    ? [options[0], options[Math.floor(options.length / 2)], options[options.length - 1]]
    : options;

  return (
    <div
      className={cn(
        'grid gap-2',
        displayOptions.length <= 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-5'
      )}
    >
      {displayOptions.map((option, idx) => {
        const isSelected = value === option.value;
        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onSelect(option.value)}
            className={cn(
              'rounded-xl border px-3 py-3 text-center transition',
              fontScale === 'lg' ? 'text-base' : 'text-sm',
              isSelected
                ? 'border-emerald-600 bg-emerald-50 font-semibold text-emerald-800'
                : 'border-muted bg-white text-gray-700 hover:border-emerald-300 hover:bg-emerald-50/40'
            )}
          >
            {labels[idx] ?? option.label}
          </button>
        );
      })}
    </div>
  );
}

function BinaryOptions({
  options,
  value,
  fontScale,
  onSelect,
}: {
  options: AssessmentQuestion['options'];
  value?: number | string;
  fontScale: 'lg' | 'base';
  onSelect: (value: number | string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onSelect(option.value)}
            className={cn(
              'rounded-xl border px-4 py-4 text-center transition',
              fontScale === 'lg' ? 'text-base' : 'text-sm',
              isSelected
                ? 'border-indigo-600 bg-indigo-50 font-semibold text-indigo-800'
                : 'border-muted bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50/40'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
