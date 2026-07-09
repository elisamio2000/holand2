'use client';

import cn from '@core/utils/class-names';

const iconClass = 'size-4 shrink-0';

/** Word-style overlapping squares — highlighted layer in accent. */
export function IconLayerFront({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn(iconClass, className)} aria-hidden>
      <rect x="1" y="4" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect x="6" y="1" width="8" height="8" fill="var(--primary-default, #f59e0b)" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function IconLayerForward({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn(iconClass, className)} aria-hidden>
      <rect x="2" y="5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect x="5" y="2" width="7" height="7" fill="var(--primary-default, #f59e0b)" stroke="currentColor" strokeWidth="1.2" opacity="0.85" />
    </svg>
  );
}

export function IconLayerBack({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn(iconClass, className)} aria-hidden>
      <rect x="6" y="1" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect x="1" y="4" width="8" height="8" fill="var(--primary-default, #f59e0b)" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function IconLayerBackward({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn(iconClass, className)} aria-hidden>
      <rect x="5" y="2" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect x="2" y="5" width="7" height="7" fill="var(--primary-default, #f59e0b)" stroke="currentColor" strokeWidth="1.2" opacity="0.85" />
    </svg>
  );
}

/** XD-style boolean ops */
export function IconBooleanUnion({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn(iconClass, className)} aria-hidden>
      <path
        d="M2 9.5a3.5 3.5 0 0 1 0-7h3.5V2a3.5 3.5 0 0 1 7 0v3.5H16a3.5 3.5 0 0 1 0 7h-3.5V16a3.5 3.5 0 0 1-7 0v-3.5H2Z"
        fill="currentColor"
        opacity="0.25"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}

export function IconBooleanSubtract({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn(iconClass, className)} aria-hidden>
      <rect x="1" y="5" width="8" height="8" fill="currentColor" opacity="0.25" stroke="currentColor" strokeWidth="1" />
      <rect x="6" y="2" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function IconBooleanIntersect({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn(iconClass, className)} aria-hidden>
      <rect x="1" y="4" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
      <rect x="6" y="2" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
      <rect x="6" y="4" width="3" height="6" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

export function IconBooleanExclude({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn(iconClass, className)} aria-hidden>
      <rect x="1" y="4" width="8" height="8" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1" />
      <rect x="6" y="2" width="8" height="8" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1" />
      <rect x="6" y="4" width="3" height="6" fill="white" stroke="none" />
    </svg>
  );
}

/** Corner radius mode — uniform vs per-corner (XD-like). */
export function IconCornerUniform({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn(iconClass, className)} aria-hidden>
      <rect x="2" y="2" width="12" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function IconCornerIndividual({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn(iconClass, className)} aria-hidden>
      <path
        d="M5 2 H11 M14 5 V11 M11 14 H5 M2 11 V5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="2 1.5"
      />
      <path d="M2 5 Q2 2 5 2" fill="none" stroke="var(--primary-default,#3b82f6)" strokeWidth="1.4" />
      <path d="M11 2 Q14 2 14 5" fill="none" stroke="var(--primary-default,#3b82f6)" strokeWidth="1.4" />
      <path d="M14 11 Q14 14 11 14" fill="none" stroke="var(--primary-default,#3b82f6)" strokeWidth="1.4" />
      <path d="M5 14 Q2 14 2 11" fill="none" stroke="var(--primary-default,#3b82f6)" strokeWidth="1.4" />
    </svg>
  );
}

/** Connector line stroke styles */
export function IconStrokeSolid({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn(iconClass, className)} aria-hidden>
      <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconStrokeDashed({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn(iconClass, className)} aria-hidden>
      <line
        x1="2"
        y1="8"
        x2="14"
        y2="8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="3 2"
      />
    </svg>
  );
}

export function IconStrokeDotted({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn(iconClass, className)} aria-hidden>
      <line
        x1="2"
        y1="8"
        x2="14"
        y2="8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="1 2.5"
      />
    </svg>
  );
}

/** Connector route styles */
export function IconRouteCurved({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn(iconClass, className)} aria-hidden>
      <path
        d="M2 11 C6 4 10 4 14 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconRouteOrthogonal({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn(iconClass, className)} aria-hidden>
      <path
        d="M2 8 H8 V4 H14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconRouteStraight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn(iconClass, className)} aria-hidden>
      <line x1="2" y1="12" x2="14" y2="4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** Connector arrow directions */
export function IconArrowForward({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn(iconClass, className)} aria-hidden>
      <path d="M2 8 H10" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <path
        d="M8 5.5 L11.5 8 L8 10.5"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconArrowBackward({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn(iconClass, className)} aria-hidden>
      <path d="M14 8 H6" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <path
        d="M8 5.5 L4.5 8 L8 10.5"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconArrowBoth({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn(iconClass, className)} aria-hidden>
      <path d="M4 8 H12" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <path
        d="M6 5.5 L3.5 8 L6 10.5 M10 5.5 L12.5 8 L10 10.5"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconArrowNone({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn(iconClass, className)} aria-hidden>
      <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
