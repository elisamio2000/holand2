import type { ReactNode } from 'react';

export interface ChecklistItem {
  id: string;
  label: string;
}

export interface LabTab<T extends string = string> {
  id: T;
  label: string;
  content: ReactNode;
  /** Optional data-tour anchor for onboarding SDK */
  dataTourId?: string;
}

export interface LabAnchor<T extends string = string> {
  href: string;
  label: string;
  tab: T;
}

export interface LabShellProps<T extends string = string> {
  moduleId: string;
  tabs: LabTab<T>[];
  anchors?: LabAnchor<T>[];
  defaultTab: T;
  banner?: ReactNode;
  onUnmount?: () => void;
  headerExtra?: ReactNode;
}
