'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Button, Text } from 'rizzui';
import { PiXBold, PiArrowRightBold } from 'react-icons/pi';
import { createTourStorage } from './tour-storage';
import type { OnboardingTourProps } from './types';

export function OnboardingTour({
  storageKey,
  steps,
  labels,
  onComplete,
  startSignal = 0,
  autoShowDelayMs = 600,
  maskId: maskIdProp,
}: OnboardingTourProps) {
  const reactId = useId().replace(/:/g, '');
  const maskId = maskIdProp ?? `onboarding-tour-mask-${reactId}`;
  const storage = useMemo(() => createTourStorage(storageKey), [storageKey]);

  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  const step = steps[stepIndex];
  const isLast = stepIndex >= steps.length - 1;

  const dismiss = useCallback(() => {
    storage.markSeen();
    setVisible(false);
    onComplete?.();
  }, [onComplete, storage]);

  const updateHighlight = useCallback(() => {
    if (!step?.targetSelector) {
      setHighlightRect(null);
      return;
    }
    const el = document.querySelector(step.targetSelector);
    setHighlightRect(el?.getBoundingClientRect() ?? null);
  }, [step]);

  useEffect(() => {
    if (startSignal > 0) {
      setStepIndex(0);
      setVisible(true);
      return;
    }
    if (storage.hasSeen()) return;
    const timer = window.setTimeout(() => setVisible(true), autoShowDelayMs);
    return () => window.clearTimeout(timer);
  }, [startSignal, autoShowDelayMs, storage]);

  useEffect(() => {
    if (!visible) return;
    updateHighlight();
    window.addEventListener('resize', updateHighlight);
    window.addEventListener('scroll', updateHighlight, true);
    return () => {
      window.removeEventListener('resize', updateHighlight);
      window.removeEventListener('scroll', updateHighlight, true);
    };
  }, [visible, stepIndex, updateHighlight]);

  const handleNext = () => {
    if (isLast) {
      dismiss();
      return;
    }
    setStepIndex((i) => i + 1);
  };

  if (!visible || !step) return null;

  const stepLabel = labels.step
    .replace('{{current}}', String(stepIndex + 1))
    .replace('{{total}}', String(steps.length));

  return (
    <div className="pointer-events-none fixed inset-0 z-[200]">
      <svg className="absolute inset-0 h-full w-full">
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {highlightRect && (
              <rect
                x={highlightRect.left - 6}
                y={highlightRect.top - 6}
                width={highlightRect.width + 12}
                height={highlightRect.height + 12}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.55)"
          mask={`url(#${maskId})`}
        />
      </svg>

      {highlightRect && (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-transparent"
          style={{
            left: highlightRect.left - 6,
            top: highlightRect.top - 6,
            width: highlightRect.width + 12,
            height: highlightRect.height + 12,
          }}
        />
      )}

      <div
        className="pointer-events-auto absolute bottom-6 left-1/2 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-muted bg-white p-4 shadow-2xl dark:bg-gray-50"
        role="dialog"
        aria-label={labels.title}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <Text className="text-[10px] font-semibold uppercase text-primary">{stepLabel}</Text>
            <Text className="text-sm font-semibold">{step.title}</Text>
          </div>
          <Button
            size="sm"
            variant="text"
            onClick={dismiss}
            aria-label={labels.closeAriaLabel ?? labels.skip}
          >
            <PiXBold className="h-4 w-4" />
          </Button>
        </div>
        <Text className="text-xs text-gray-600">{step.body}</Text>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button size="sm" variant="text" onClick={dismiss}>
            {labels.skip}
          </Button>
          <Button size="sm" onClick={handleNext}>
            {isLast ? labels.done : labels.next}
            {!isLast && <PiArrowRightBold className="ml-1 h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
