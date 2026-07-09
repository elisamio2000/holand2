'use client';

import { useTranslation } from 'react-i18next';
import { Input, Title } from 'rizzui';
import type { BoardRecord } from '../../lib/board-types';

export interface BoardInfoSectionProps {
  board: BoardRecord;
  onTitleChange: (title: string) => void;
  onCaseIdChange: (caseId: string) => void;
  onToggleLegalHold: () => void;
}

export function BoardInfoSection({
  board,
  onTitleChange,
  onCaseIdChange,
  onToggleLegalHold,
}: BoardInfoSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="border-b border-muted pb-4">
      <Title as="h6" className="mb-2 text-sm">
        {t('boards.inspector.board', 'Board')}
      </Title>
      <Input
        label={t('boards.inspector.title', 'Title')}
        value={board.title}
        onChange={(e) => onTitleChange(e.target.value)}
        size="sm"
      />
      <Input
        className="mt-2"
        label={t('boards.inspector.caseId', 'Case ID (optional)')}
        value={board.caseId ?? ''}
        onChange={(e) => onCaseIdChange(e.target.value)}
        size="sm"
        placeholder="case-uuid"
      />
      <button
        type="button"
        className="mt-2 text-xs text-amber-600 underline"
        onClick={onToggleLegalHold}
      >
        {board.snapshot.legalHold
          ? t('boards.inspector.releaseHold', 'Release legal hold')
          : t('boards.inspector.applyHold', 'Apply legal hold')}
      </button>
    </div>
  );
}
