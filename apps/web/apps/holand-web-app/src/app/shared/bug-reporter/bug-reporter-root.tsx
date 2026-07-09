'use client';

import type { ReactNode } from 'react';
import { BugReporterProvider } from './context/bug-reporter-context';
import GlobalNativeAiChatRoot from '@/app/shared/native-ai-chat/global-native-ai-chat-root';

export default function BugReporterRoot({ children }: { children: ReactNode }) {
  return (
    <BugReporterProvider>
      {children}
      <GlobalNativeAiChatRoot />
    </BugReporterProvider>
  );
}
