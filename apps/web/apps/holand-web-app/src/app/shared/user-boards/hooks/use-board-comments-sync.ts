import { useCallback, useEffect, useRef } from 'react';
import type { BoardCommentPin } from '../lib/board-types';
import { boardService } from '../services/board.service';

const OFFLINE_QUEUE_KEY = 'board-comments-offline-queue';

interface QueuedComment {
  boardId: string;
  body: { x: number; y: number; text: string; objectId?: string };
}

function readQueue(): QueuedComment[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedComment[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedComment[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items));
}

export function useBoardCommentsSync(
  boardId: string,
  comments: BoardCommentPin[],
  onRemoteComments: (comments: BoardCommentPin[]) => void
) {
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!boardId || loadedRef.current) return;
    loadedRef.current = true;
    void (async () => {
      const remote = await boardService.listComments(boardId);
      if (remote && Array.isArray(remote) && remote.length) {
        onRemoteComments(remote as BoardCommentPin[]);
      }
      const queue = readQueue().filter((q) => q.boardId === boardId);
      if (!queue.length) return;
      for (const item of queue) {
        await boardService.postComment(boardId, item.body);
      }
      writeQueue(readQueue().filter((q) => q.boardId !== boardId));
    })();
  }, [boardId, onRemoteComments]);

  const enqueueOffline = useCallback(
    (body: QueuedComment['body']) => {
      const queue = readQueue();
      queue.push({ boardId, body });
      writeQueue(queue);
    },
    [boardId]
  );

  const syncComment = useCallback(
    async (body: QueuedComment['body']) => {
      const ok = await boardService.postComment(boardId, body);
      if (!ok) enqueueOffline(body);
    },
    [boardId, enqueueOffline]
  );

  return { syncComment, commentCount: comments.length };
}
