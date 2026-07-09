// ============================================
// Expert Lab service — draft/review/publish workflow client
// ============================================

import { holandApiClient } from './holand-api-client';
import type {
  ContentDraft,
  ContentDraftCreateInput,
  ContentVersion,
  ContentVersionCreateInput,
  DraftStatus,
  ReviewDecisionInput,
} from '@/types/expert-lab.types';

export const expertLabService = {
  async listDrafts(status?: DraftStatus): Promise<ContentDraft[]> {
    const { data } = await holandApiClient.get<ContentDraft[]>('/expert-lab/drafts', {
      params: status ? { status } : undefined,
    });
    return data;
  },

  async getDraft(draftId: string): Promise<ContentDraft> {
    const { data } = await holandApiClient.get<ContentDraft>(`/expert-lab/drafts/${draftId}`);
    return data;
  },

  async createDraft(payload: ContentDraftCreateInput): Promise<ContentDraft> {
    const { data } = await holandApiClient.post<ContentDraft>('/expert-lab/drafts', payload);
    return data;
  },

  async addRevision(
    draftId: string,
    payload: ContentVersionCreateInput
  ): Promise<ContentVersion> {
    const { data } = await holandApiClient.post<ContentVersion>(
      `/expert-lab/drafts/${draftId}/revisions`,
      payload
    );
    return data;
  },

  async submitForReview(draftId: string): Promise<ContentVersion> {
    const { data } = await holandApiClient.post<ContentVersion>(
      `/expert-lab/drafts/${draftId}/submit`
    );
    return data;
  },

  async approve(draftId: string, decision: ReviewDecisionInput): Promise<ContentVersion> {
    const { data } = await holandApiClient.post<ContentVersion>(
      `/expert-lab/drafts/${draftId}/approve`,
      decision
    );
    return data;
  },

  async reject(draftId: string, decision: ReviewDecisionInput): Promise<ContentVersion> {
    const { data } = await holandApiClient.post<ContentVersion>(
      `/expert-lab/drafts/${draftId}/reject`,
      decision
    );
    return data;
  },

  async publish(draftId: string): Promise<ContentVersion> {
    const { data } = await holandApiClient.post<ContentVersion>(
      `/expert-lab/drafts/${draftId}/publish`
    );
    return data;
  },
};
