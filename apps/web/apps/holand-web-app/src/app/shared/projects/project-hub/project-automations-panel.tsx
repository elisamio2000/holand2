'use client';

import { useEffect, useState } from 'react';
import { Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { getAutomationLog } from '../mock/automations-mock-log';

const PRESETS = ['presetImport', 'presetOverdue', 'presetAssign'] as const;

export default function ProjectAutomationsPanel() {
  const { t } = useTranslation();
  const [log, setLog] = useState(getAutomationLog());

  useEffect(() => {
    const id = window.setInterval(() => setLog(getAutomationLog()), 2000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="rounded-xl border border-dashed border-muted bg-gray-50/50 p-4 dark:bg-gray-100/20">
      <Title as="h6" className="mb-3 text-sm font-semibold">
        {t('projects.automations.title')}
      </Title>
      <ul className="space-y-2">
        {PRESETS.map((key) => (
          <li key={key} className="flex items-start gap-2 text-sm text-gray-600">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <Text>{t(`projects.automations.${key}`)}</Text>
          </li>
        ))}
      </ul>
      <Title as="h6" className="mb-2 mt-4 text-xs font-semibold uppercase text-gray-500">
        {t('projects.automations.executionLog')}
      </Title>
      {log.length === 0 ? (
        <Text className="text-[11px] text-gray-400">{t('projects.automations.noRuns')}</Text>
      ) : (
        <ul className="max-h-32 space-y-1 overflow-y-auto text-[11px] text-gray-500">
          {log.map((entry) => (
            <li key={entry.id}>
              <span className="font-medium">{t(`projects.automations.${entry.preset}`)}</span>
              {' · '}
              {entry.detail}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
