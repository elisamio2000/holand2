export interface TourStep {
  id: string;
  title: string;
  body: string;
  targetSelector?: string;
}

export interface TourLabels {
  title: string;
  step: string;
  skip: string;
  next: string;
  done: string;
  closeAriaLabel?: string;
}

export interface OnboardingTourProps {
  storageKey: string;
  steps: TourStep[];
  labels: TourLabels;
  onComplete?: () => void;
  /** Increment to manually (re)start the tour. */
  startSignal?: number;
  autoShowDelayMs?: number;
  maskId?: string;
}
