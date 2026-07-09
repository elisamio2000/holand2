'use client';

import {
  PiFlowArrowBold,
  PiSparkleBold,
  PiWrenchBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';

export type LlmRoutingTabKey = 'roles' | 'routes' | 'tools';

const TAB_ITEMS = [
  { key: 'roles' as const, i18nKey: 'llmPage.tabs.roles', icon: PiSparkleBold },
  { key: 'routes' as const, i18nKey: 'llmPage.tabs.routes', icon: PiFlowArrowBold },
  { key: 'tools' as const, i18nKey: 'llmPage.tabs.tools', icon: PiWrenchBold },
] as const;

interface LlmSegmentTabsProps {
  tab: LlmRoutingTabKey;
  onTabChange: (tab: LlmRoutingTabKey) => void;
}

export default function LlmSegmentTabs({ tab, onTabChange }: LlmSegmentTabsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-2 rounded-xl border border-muted p-1.5">
      {TAB_ITEMS.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onTabChange(item.key)}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            tab === item.key
              ? 'bg-primary text-white shadow'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400'
          )}
        >
          <item.icon className="h-4 w-4" />
          {t(item.i18nKey)}
        </button>
      ))}
    </div>
  );
}
