'use client';

import { usePathname } from 'next/navigation';
import FloatingNativeAiChat from '@/app/shared/native-ai-chat/floating-native-ai-chat';
import { surfaceFromPathname } from '@/app/shared/native-ai-chat/native-ai-chat-bridge';

/**
 * Global native AI dock for pages without a dedicated contextual surface.
 * Contextual pages mount their own FloatingNativeAiChat with richer buildContext.
 */
export default function GlobalNativeAiChatRoot() {
  const pathname = usePathname() ?? '/';
  const pageSurface = surfaceFromPathname(pathname);

  if (pageSurface) {
    return null;
  }

  return (
    <FloatingNativeAiChat
      surface="general"
      buildContext={() => ({
        module: 'general',
        pathname,
      })}
    />
  );
}
