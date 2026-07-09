'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button, Input, Text } from 'rizzui';
import type { BoardRecord, BoardSnapshot } from '../lib/board-types';
import {
  createCheckpoint,
  deleteCheckpoint,
  listCheckpoints,
  type BoardCheckpointRecord,
} from '../lib/board-local-storage';

export interface BoardCheckpointsPanelProps {
  boardId: string;
  snapshot: BoardSnapshot;
  readOnly?: boolean;
  onRestore: (snapshot: BoardSnapshot) => void;
}

export function BoardCheckpointsPanel({
  boardId,
  snapshot,
  readOnly,
  onRestore,
}: BoardCheckpointsPanelProps) {
  const { t } = useTranslation();
  const [checkpoints, setCheckpoints] = useState<BoardCheckpointRecord[]>([]);
  const [label, setLabel] = useState('');

  const reload = useCallback(async () => {
    const items = await listCheckpoints(boardId);
    setCheckpoints(items);
  }, [boardId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = async () => {
    const name = label.trim() || t('boards.checkpoints.defaultLabel', 'Checkpoint');
    const ok = await createCheckpoint(boardId, name, snapshot);
    if (ok) {
      toast.success(t('boards.checkpoints.saved', 'Checkpoint saved'));
      setLabel('');
      void reload();
    }
  };

  const restore = (cp: BoardCheckpointRecord) => {
    if (!window.confirm(t('boards.checkpoints.confirmRestore', 'Restore this checkpoint?'))) return;
    onRestore(cp.snapshot);
    toast.success(t('boards.checkpoints.restored', 'Checkpoint restored'));
  };

  const remove = async (id: string) => {
    await deleteCheckpoint(id);
    void reload();
  };

  return (
    <div className="space-y-3 border-t border-muted pt-3">
      <Text className="text-xs font-medium text-gray-600">
        {t('boards.checkpoints.title', 'Checkpoints')}
      </Text>
      {!readOnly ? (
        <div className="flex gap-2">
          <Input
            size="sm"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('boards.checkpoints.placeholder', 'Label…')}
            className="flex-1"
          />
          <Button size="sm" variant="outline" onClick={() => void save()}>
            {t('boards.checkpoints.save', 'Save')}
          </Button>
        </div>
      ) : null}
      <ul className="max-h-40 space-y-1 overflow-y-auto">
        {checkpoints.length === 0 ? (
          <Text className="text-[10px] text-gray-400">{t('boards.checkpoints.empty', 'No checkpoints')}</Text>
        ) : (
          checkpoints.map((cp) => (
            <li key={cp.id} className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1">
              <div className="min-w-0">
                <Text className="truncate text-xs">{cp.label}</Text>
                <Text className="text-[9px] text-gray-400">{new Date(cp.createdAt).toLocaleString()}</Text>
              </div>
              <div className="flex shrink-0 gap-1">
                {!readOnly ? (
                  <button
                    type="button"
                    className="text-[10px] text-primary underline"
                    onClick={() => restore(cp)}
                  >
                    {t('boards.checkpoints.restore', 'Restore')}
                  </button>
                ) : null}
                {!readOnly ? (
                  <button
                    type="button"
                    className="text-[10px] text-red-500 underline"
                    onClick={() => void remove(cp.id)}
                  >
                    {t('boards.checkpoints.delete', 'Delete')}
                  </button>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
