'use client';

import { useTranslation } from 'react-i18next';
import { Badge, Text, Title } from 'rizzui';
import cn from '@core/utils/class-names';
import { BOARD_API_REQUIREMENTS } from '../config/board-api-requirements';
import type { BoardApiStatus } from '../services/board.service';

const STATUS_COLOR: Record<BoardApiStatus, 'success' | 'warning' | 'danger' | 'secondary'> = {
  live: 'success',
  mock: 'warning',
  blocked: 'danger',
  optional: 'secondary',
};

export interface BoardApiFootprintProps {
  className?: string;
}

export function BoardApiFootprint({ className }: BoardApiFootprintProps) {
  const { t } = useTranslation();

  return (
    <div className={cn('rounded-lg border border-muted bg-gray-50/80 p-4 dark:bg-gray-200/10', className)}>
      <Title as="h6" className="mb-2 text-sm">
        {t('boards.footprint.title', 'Backend API footprint')}
      </Title>
      <Text className="mb-3 text-xs text-gray-500">
        {t(
          'boards.footprint.note',
          'Frontend persists to IndexedDB first. Cloud sync activates when backend endpoints are live.'
        )}
      </Text>
      <div className="overflow-x-auto">
        <table className="w-full text-start text-xs">
          <thead>
            <tr className="border-b border-muted text-gray-500">
              <th className="px-2 py-1">{t('boards.footprint.phase', 'Phase')}</th>
              <th className="px-2 py-1">{t('boards.footprint.method', 'Method')}</th>
              <th className="px-2 py-1">{t('boards.footprint.path', 'Path')}</th>
              <th className="px-2 py-1">{t('boards.footprint.status', 'Status')}</th>
              <th className="px-2 py-1">{t('boards.footprint.desc', 'Description')}</th>
            </tr>
          </thead>
          <tbody>
            {BOARD_API_REQUIREMENTS.map((row) => (
              <tr key={row.id} className="border-b border-muted/50 align-top">
                <td className="px-2 py-2 font-mono">{row.phase}</td>
                <td className="px-2 py-2 font-mono">{row.method}</td>
                <td className="px-2 py-2 font-mono text-[10px]">{row.path}</td>
                <td className="px-2 py-2">
                  <Badge color={STATUS_COLOR[row.status]} rounded="md" className="text-[10px]">
                    {row.status}
                  </Badge>
                </td>
                <td className="px-2 py-2 text-gray-600">{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
