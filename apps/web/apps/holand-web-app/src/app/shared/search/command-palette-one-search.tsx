'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  PiFileBold,
  PiFolderBold,
  PiGraphBold,
  PiMagnifyingGlassBold,
  PiTextAaBold,
} from 'react-icons/pi';
import { Text } from 'rizzui';
import cn from '@core/utils/class-names';
import { buildOneSearchUrl, laneExploreHref } from '@/app/shared/one-search/utils/search-urls';
import type { OneSearchLaneId } from '@/types/one-search.types';

const LANE_SHORTCUTS: {
  lane: OneSearchLaneId;
  mode: string;
  labelKey: 'laneAll' | 'laneText' | 'laneFiles' | 'laneCases' | 'laneGraph';
  icon: React.ReactNode;
}[] = [
  {
    lane: 'users',
    mode: 'all',
    labelKey: 'laneAll',
    icon: <PiMagnifyingGlassBold className="h-4 w-4 text-primary" />,
  },
  {
    lane: 'chat',
    mode: 'text',
    labelKey: 'laneText',
    icon: <PiTextAaBold className="h-4 w-4 text-sky-600" />,
  },
  {
    lane: 'files',
    mode: 'file',
    labelKey: 'laneFiles',
    icon: <PiFileBold className="h-4 w-4 text-amber-600" />,
  },
  {
    lane: 'cases',
    mode: 'cases',
    labelKey: 'laneCases',
    icon: <PiFolderBold className="h-4 w-4 text-violet-600" />,
  },
  {
    lane: 'graph',
    mode: 'graph',
    labelKey: 'laneGraph',
    icon: <PiGraphBold className="h-4 w-4 text-rose-600" />,
  },
];

export default function CommandPaletteOneSearch({
  query,
  onClose,
}: {
  query: string;
  onClose?: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const trimmed = query.trim();

  const navigate = (href: string) => {
    onClose?.();
    router.push(href);
  };

  return (
    <div className="px-3 pb-2">
      <button
        type="button"
        onClick={() => navigate(buildOneSearchUrl({ q: trimmed }))}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-start transition-colors hover:bg-gray-100 dark:hover:bg-gray-50/50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-muted bg-gray-0">
          <PiMagnifyingGlassBold className="h-5 w-5 text-primary" />
        </span>
        <span className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-gray-900 dark:text-gray-700">
            {trimmed
              ? t('commandPalette.oneSearch.searchEverythingWithQuery', { q: trimmed })
              : t('commandPalette.oneSearch.searchEverything')}
          </Text>
          <Text className="text-xs text-gray-500">{t('commandPalette.oneSearch.hint')}</Text>
        </span>
        <kbd className="hidden rounded border border-muted px-1.5 py-0.5 text-[10px] font-medium text-gray-500 sm:inline">
          Enter
        </kbd>
      </button>

      <Text className="mb-2 mt-4 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {t('commandPalette.oneSearch.lanesTitle')}
      </Text>
      <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
        {LANE_SHORTCUTS.map(({ lane, labelKey, icon }) => (
          <button
            key={lane}
            type="button"
            onClick={() => navigate(laneExploreHref(lane, trimmed))}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-start text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-50/50'
            )}
          >
            {icon}
            <span className="font-medium text-gray-800 dark:text-gray-700">
              {t(`commandPalette.oneSearch.${labelKey}`)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function resolveOneSearchEnterHref(query: string): string {
  return buildOneSearchUrl({ q: query.trim() });
}
