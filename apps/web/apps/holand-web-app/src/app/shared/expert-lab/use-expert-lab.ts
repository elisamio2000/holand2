// ============================================
// useExpertLab — state + actions for the Expert Lab draft/review/publish workflow
// ============================================

'use client';

import { useCallback, useEffect, useState } from 'react';
import { expertLabService } from '@/services/expert-lab.service';
import type {
  ContentDraft,
  ContentDraftCreateInput,
  ContentVersionCreateInput,
  ReviewDecisionInput,
} from '@/types/expert-lab.types';

interface UseExpertLabResult {
  drafts: ContentDraft[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createDraft: (input: ContentDraftCreateInput) => Promise<ContentDraft>;
  addRevision: (draftId: string, input: ContentVersionCreateInput) => Promise<void>;
  submitForReview: (draftId: string) => Promise<void>;
  approve: (draftId: string, decision: ReviewDecisionInput) => Promise<void>;
  reject: (draftId: string, decision: ReviewDecisionInput) => Promise<void>;
  publish: (draftId: string) => Promise<void>;
}

function toErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: { detail?: string } } }).response;
    if (response?.data?.detail) return response.data.detail;
  }
  return err instanceof Error ? err.message : 'Unknown error';
}

export function useExpertLab(): UseExpertLabResult {
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await expertLabService.listDrafts();
      setDrafts(result);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createDraft = useCallback(
    async (input: ContentDraftCreateInput) => {
      const draft = await expertLabService.createDraft(input);
      await refresh();
      return draft;
    },
    [refresh]
  );

  const addRevision = useCallback(
    async (draftId: string, input: ContentVersionCreateInput) => {
      await expertLabService.addRevision(draftId, input);
      await refresh();
    },
    [refresh]
  );

  const submitForReview = useCallback(
    async (draftId: string) => {
      await expertLabService.submitForReview(draftId);
      await refresh();
    },
    [refresh]
  );

  const approve = useCallback(
    async (draftId: string, decision: ReviewDecisionInput) => {
      await expertLabService.approve(draftId, decision);
      await refresh();
    },
    [refresh]
  );

  const reject = useCallback(
    async (draftId: string, decision: ReviewDecisionInput) => {
      await expertLabService.reject(draftId, decision);
      await refresh();
    },
    [refresh]
  );

  const publish = useCallback(
    async (draftId: string) => {
      await expertLabService.publish(draftId);
      await refresh();
    },
    [refresh]
  );

  return { drafts, isLoading, error, refresh, createDraft, addRevision, submitForReview, approve, reject, publish };
}
