'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Button, Input, Text, Title } from 'rizzui';
import { PiPlus, PiTrash, PiCopy } from 'react-icons/pi';
import { routes } from '@/config/routes';
import {
  createBoardRecord,
  boardObjectCount,
} from './lib/board-snapshot';
import { parseBoardImportFile } from './lib/board-import';
import {
  listBoards,
  upsertBoard,
  deleteBoard,
  duplicateBoard,
} from './lib/board-local-storage';
import { boardService } from './services/board.service';
import type { BoardRecord, BoardPurpose } from './lib/board-types';
import { BoardApiFootprint } from './components/board-api-footprint';
import { applyEvidenceWallTemplate } from './templates/evidence-wall-template';
import { useOnWorkspaceChanged } from '@/hooks/use-workspace-scope';
import WorkspaceScopeBanner from '@/app/shared/workspace/components/workspace-scope-banner';

const PURPOSES: BoardPurpose[] = ['free', 'analysis', 'mindmap', 'collab', 'evidence'];

export default function BoardsHub() {
  const { t } = useTranslation();
  const router = useRouter();
  const [boards, setBoards] = useState<BoardRecord[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncMode, setSyncMode] = useState<'cloud' | 'local'>('local');

  const reload = useCallback(async () => {
    setLoading(true);
    const local = await listBoards();
    const remoteMeta = await boardService.listRemote();
    if (remoteMeta.length > 0) {
      setSyncMode('cloud');
      for (const meta of remoteMeta) {
        const full = await boardService.getRemote(meta.id);
        if (full) await upsertBoard(full);
      }
      setBoards(await listBoards());
    } else {
      setSyncMode('local');
      setBoards(local);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useOnWorkspaceChanged(() => {
    void reload();
  });

  const filtered = boards.filter(
    (b) =>
      b.title.toLowerCase().includes(query.toLowerCase()) ||
      b.id.toLowerCase().includes(query.toLowerCase())
  );

  const createBoard = async (purpose?: BoardPurpose) => {
    const title = t('boards.untitled', 'Untitled board');
    const remote = await boardService.createRemote(title, purpose);
    if (remote) {
      let record = createBoardRecord(remote.title ?? title, remote.purpose ?? purpose);
      record = {
        ...record,
        id: remote.id,
        createdAt: remote.createdAt,
        updatedAt: remote.updatedAt,
        snapshot: remote.snapshot,
        caseId: remote.caseId,
      };
      if (purpose === 'evidence') {
        record.snapshot = applyEvidenceWallTemplate();
      }
      await upsertBoard(record);
      router.push(routes.userBoards.detail(record.id));
      return;
    }
    const record = createBoardRecord(title, purpose);
    if (purpose === 'evidence') {
      record.snapshot = applyEvidenceWallTemplate();
    }
    await upsertBoard(record);
    router.push(routes.userBoards.detail(record.id));
  };

  const handleDelete = async (id: string) => {
    await deleteBoard(id);
    void reload();
  };

  const handleDuplicate = async (board: BoardRecord) => {
    await duplicateBoard(board, `${board.title} (copy)`);
    void reload();
  };

  const hubImportRef = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const imported = parseBoardImportFile(text);
      if (!imported) return;
      const record = createBoardRecord(imported.title ?? t('boards.untitled', 'Untitled board'));
      record.snapshot = imported.snapshot;
      await upsertBoard(record);
      router.push(routes.userBoards.detail(record.id));
    };
    input.click();
  }, [router, t]);

  return (
    <div className="space-y-6">
      <WorkspaceScopeBanner />
      {syncMode === 'local' && (
        <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/80 px-4 py-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
          {t(
            'boards.hub.localOnly',
            'Local only — boards are saved in this browser. Cloud sync activates when GET /boards is available.'
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Title as="h5">{t('boards.hub.title', 'My boards')}</Title>
          <Text className="text-sm text-gray-500">
            {t('boards.hub.subtitle', 'Personal visual workspaces for analysis, mind maps, and collaboration')}
          </Text>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={hubImportRef}>
            {t('boards.import.hubLabel', 'Import board…')}
          </Button>
          {PURPOSES.map((p) => (
            <Button key={p} size="sm" variant="outline" onClick={() => createBoard(p)}>
              <PiPlus className="me-1 size-4" />
              {t(`boards.purpose.${p}`, p)}
            </Button>
          ))}
        </div>
      </div>

      <Input
        placeholder={t('boards.hub.search', 'Search boards…')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-md"
      />

      {loading ? (
        <Text className="text-gray-500">{t('common.loading', 'Loading…')}</Text>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-muted p-12 text-center">
          <Text className="text-gray-500">{t('boards.hub.empty', 'No boards yet. Create one to start.')}</Text>
          <Button className="mt-4" onClick={() => createBoard('free')}>
            <PiPlus className="me-1 size-4" />
            {t('boards.hub.create', 'Create board')}
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((board) => (
            <div
              key={board.id}
              className="rounded-lg border border-muted bg-white p-4 dark:bg-gray-100"
            >
              <Link href={routes.userBoards.detail(board.id)} className="block">
                <Title as="h6" className="mb-1 text-sm hover:text-primary">
                  {board.title}
                </Title>
              </Link>
              <Text className="text-xs text-gray-500">
                {board.purpose ? t(`boards.purpose.${board.purpose}`, board.purpose) : '—'} ·{' '}
                {boardObjectCount(board.snapshot)} {t('boards.objects', 'objects')}
              </Text>
              <Text className="mt-1 text-[10px] text-gray-400">
                {new Date(board.updatedAt).toLocaleString()}
              </Text>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleDuplicate(board)}>
                  <PiCopy className="size-3.5" />
                </Button>
                <Button size="sm" variant="outline" color="danger" onClick={() => handleDelete(board.id)}>
                  <PiTrash className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <BoardApiFootprint />
    </div>
  );
}
