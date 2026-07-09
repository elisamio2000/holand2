'use client';

import { useCallback, useState } from 'react';
import { chatService } from '@/services/chat.service';
import type {
  ChatFeatureHealthMap,
  ChatFeatureKey,
} from '@/app/shared/ai-chat/adapters/chat-feature-adapter';

const INITIAL_FEATURES: ChatFeatureHealthMap = {
  folders: 'unknown',
  projects: 'unknown',
  search: 'unknown',
  import: 'unknown',
  exportAll: 'unknown',
};

export function useChatFeatureHealth() {
  const [features, setFeatures] = useState<ChatFeatureHealthMap>(INITIAL_FEATURES);
  const [isProbing, setIsProbing] = useState(false);

  const probe = useCallback(async () => {
    setIsProbing(true);
    try {
      const result = await chatService.probeFeatureHealth();
      setFeatures(result);
    } catch (error: unknown) {
      console.error('[useChatFeatureHealth] Probe failed:', error);
      setFeatures((prev) => ({
        folders: prev.folders === 'unknown' ? 'unavailable' : prev.folders,
        projects: prev.projects === 'unknown' ? 'unavailable' : prev.projects,
        search: prev.search === 'unknown' ? 'unavailable' : prev.search,
        import: prev.import === 'unknown' ? 'unavailable' : prev.import,
        exportAll: prev.exportAll === 'unknown' ? 'unavailable' : prev.exportAll,
      }));
    } finally {
      setIsProbing(false);
    }
  }, []);

  const isAvailable = useCallback(
    (key: ChatFeatureKey) => features[key] === 'available',
    [features]
  );

  return { features, isProbing, probe, isAvailable };
}
