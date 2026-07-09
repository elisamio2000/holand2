'use client';

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Title } from 'rizzui';
import RichTextEditor from '@/app/shared/rich-text-editor';
import type { BoardSnapshot } from '../lib/board-types';

interface BoardReportPanelProps {
  snapshot: BoardSnapshot;
  onChange: (patch: Partial<Pick<BoardSnapshot, 'reportTitle' | 'reportContent'>>) => void;
  onEditSessionStart?: () => void;
  onEditSessionEnd?: () => void;
}

export function BoardReportPanel({
  snapshot,
  onChange,
  onEditSessionStart,
  onEditSessionEnd,
}: BoardReportPanelProps) {
  const { t } = useTranslation();

  const handleBodyChange = useCallback(
    (output: { html: string }) => {
      onEditSessionStart?.();
      onChange({ reportContent: output.html });
    },
    [onChange, onEditSessionStart]
  );

  return (
    <div className="h-full overflow-y-auto p-6">
      <Title as="h5" className="mb-4">
        {t('boards.report.title', 'Report')}
      </Title>
      <Input
        label={t('boards.report.heading', 'Heading')}
        value={snapshot.reportTitle ?? ''}
        onFocus={() => onEditSessionStart?.()}
        onBlur={() => onEditSessionEnd?.()}
        onChange={(e) => {
          onEditSessionStart?.();
          onChange({ reportTitle: e.target.value });
        }}
        className="mb-4"
      />
      <div onBlur={() => onEditSessionEnd?.()}>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          {t('boards.report.body', 'Body')}
        </label>
        <RichTextEditor
          initialContent={snapshot.reportContent ?? ''}
          onChange={handleBodyChange}
          minHeight="420px"
          stickyToolbar
          showCharacterCount={false}
          className="rounded-lg border border-muted"
        />
      </div>
    </div>
  );
}
