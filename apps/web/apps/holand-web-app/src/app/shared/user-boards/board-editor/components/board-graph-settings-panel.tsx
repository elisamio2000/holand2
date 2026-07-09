'use client';

import { useTranslation } from 'react-i18next';
import { Title } from 'rizzui';
import { GraphDisplaySettingsForm } from '@/app/shared/graph-explorer/graph-display-settings-form';
import type { GraphSettings } from '@/types/graph-explorer.types';

export interface BoardGraphSettingsPanelProps {
  settings: GraphSettings;
  onSettingsChange: (settings: GraphSettings) => void;
  className?: string;
}

export function BoardGraphSettingsPanel({
  settings,
  onSettingsChange,
  className,
}: BoardGraphSettingsPanelProps) {
  const { t } = useTranslation();

  return (
    <div className={className}>
      <Title as="h6" className="mb-2 text-sm">
        {t('boards.settings.graphDisplay', 'Graph display')}
      </Title>
      <GraphDisplaySettingsForm settings={settings} onSettingsChange={onSettingsChange} />
    </div>
  );
}
