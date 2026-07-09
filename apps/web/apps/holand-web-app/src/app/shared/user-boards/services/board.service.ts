import { gatewayClient } from '@/lib/api-client';
import { BoardRecord, BoardRecordMeta } from '../lib/board-types';
import { normalizeBoardRecord, boardObjectCount } from '../lib/board-snapshot';


export type BoardApiStatus = 'live' | 'mock' | 'blocked' | 'optional';

export interface BoardRemoteRow {
  id: string;
  title: string;
  purpose?: BoardRecord['purpose'];
  caseId?: string;
  createdAt: string;
  updatedAt: string;
  snapshot: BoardRecord['snapshot'];
  snapshotVersion?: number;
}

function toMeta(row: BoardRecord | BoardRemoteRow): BoardRecordMeta {
  return {
    id: row.id,
    title: row.title,
    purpose: row.purpose,
    caseId: 'caseId' in row ? row.caseId : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    objectCount: boardObjectCount(row.snapshot),
  };
}

async function safeRequest<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export const boardService = {
  async listRemote(): Promise<BoardRecordMeta[]> {
    const data = await safeRequest(async () => {
      const res = await gatewayClient.get<{ items: BoardRemoteRow[] }>('/boards');
      return res.data.items ?? [];
    });
    return (data ?? []).map(toMeta);
  },

  async getRemote(id: string): Promise<BoardRecord | null> {
    const data = await safeRequest(async () => {
      const res = await gatewayClient.get<BoardRemoteRow>(`/boards/${encodeURIComponent(id)}`);
      return res.data;
    });
    if (!data) return null;
    return normalizeBoardRecord({
      ...data,
      snapshot: data.snapshot,
    });
  },

  async upsertRemote(row: {
    id: string;
    title: string;
    purpose?: BoardRecord['purpose'];
    caseId?: string;
    snapshot: BoardRecord['snapshot'];
  }): Promise<BoardRemoteRow | null> {
    return safeRequest(async () => {
      const res = await gatewayClient.put<BoardRemoteRow>(
        `/boards/${encodeURIComponent(row.id)}`,
        {
          title: row.title,
          purpose: row.purpose,
          case_id: row.caseId,
          snapshot: row.snapshot,
        }
      );
      return res.data;
    });
  },

  async createRemote(title: string, purpose?: BoardRecord['purpose']): Promise<BoardRemoteRow | null> {
    return safeRequest(async () => {
      const res = await gatewayClient.post<BoardRemoteRow>('/boards', { title, purpose });
      return res.data;
    });
  },

  async deleteRemote(id: string): Promise<boolean> {
    const ok = await safeRequest(async () => {
      await gatewayClient.delete(`/boards/${encodeURIComponent(id)}`);
      return true;
    });
    return Boolean(ok);
  },

  async shareRemote(
    id: string,
    body: { mode: 'read' | 'edit'; userIds?: string[]; groupIds?: string[] }
  ): Promise<{ publicLink?: string } | null> {
    return safeRequest(async () => {
      const res = await gatewayClient.post<{ publicLink?: string }>(
        `/boards/${encodeURIComponent(id)}/share`,
        body
      );
      return res.data;
    });
  },

  async listComments(id: string) {
    return safeRequest(async () => {
      const res = await gatewayClient.get(`/boards/${encodeURIComponent(id)}/comments`);
      return res.data;
    });
  },

  async postComment(
    id: string,
    body: { x: number; y: number; text: string; objectId?: string }
  ) {
    return safeRequest(async () => {
      const res = await gatewayClient.post(`/boards/${encodeURIComponent(id)}/comments`, body);
      return res.data;
    });
  },

  async patchComment(
    boardId: string,
    commentId: string,
    body: Partial<{ text: string; resolved: boolean; replies: unknown[] }>
  ) {
    return safeRequest(async () => {
      const res = await gatewayClient.patch(
        `/boards/${encodeURIComponent(boardId)}/comments/${encodeURIComponent(commentId)}`,
        body
      );
      return res.data;
    });
  },
};
