'use client';

import Link from 'next/link';
import { Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import {
  PiChatCenteredDotsDuotone,
  PiFolderOpenDuotone,
  PiFolderDuotone,
  PiHardDrivesDuotone,
  PiUserCircleDuotone,
  PiGraphDuotone,
  PiListChecksDuotone,
  PiArrowSquareOutBold,
} from 'react-icons/pi';
import type { OneSearchLaneId, OneSearchLaneResult, OneSearchHit } from '@/types/one-search.types';
import { ChatCard, CaseCard, FileCard, UserCard, GraphCard } from './result-cards';
import { laneExploreHref, type OneSearchPageVariant } from '../utils/search-urls';

interface LaneSectionProps {
  lane: OneSearchLaneResult;
  searchQuery: string;
  pageVariant?: OneSearchPageVariant;
  onViewAllLane?: (lane: OneSearchLaneId) => void;
  maxItems?: number;
  className?: string;
}

export function LaneSection({
  lane,
  searchQuery,
  pageVariant = 'default',
  onViewAllLane,
  maxItems = 3,
  className,
}: LaneSectionProps) {
  const { t } = useTranslation();
  const { icon, color } = getLaneConfig(lane.lane);
  const visibleHits = lane.hits.slice(0, maxItems);
  const total = lane.total ?? lane.hits.length;
  const hasMore = total > visibleHits.length;
  const exploreHref = laneExploreHref(lane.lane, searchQuery, pageVariant);

  const renderCard = (hit: OneSearchHit & { lane: OneSearchLaneId }) => {
    const key = hit.id;
    switch (hit.lane) {
      case 'chat':
        return <ChatCard key={key} data={hit} />;
      case 'cases':
        return <CaseCard key={key} data={hit} />;
      case 'files':
      case 'storage':
        return <FileCard key={key} data={hit} lane={hit.lane} />;
      case 'users':
        return <UserCard key={key} data={hit} />;
      case 'graph':
        return <GraphCard key={key} data={hit} />;
      default:
        return null;
    }
  };

  return (
    <section
      className={cn(
        'overflow-hidden rounded-lg border border-muted bg-gray-0 shadow-sm dark:bg-gray-50',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-muted px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', color.bg)}>
            {icon}
          </div>
          <div className="min-w-0">
            <Title as="h2" className="text-sm font-semibold text-gray-900 dark:text-gray-700">
              {t(`searchHub.lanes.${lane.lane}`)}
            </Title>
            <Text className="text-[11px] text-gray-500 dark:text-gray-400">
              {t('searchHub.laneHitCount', { count: total })}
            </Text>
          </div>
        </div>

        {hasMore ? (
          onViewAllLane ? (
            <button
              type="button"
              onClick={() => onViewAllLane(lane.lane)}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-muted px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-gray-100 dark:hover:bg-gray-200/20"
            >
              {t('searchHub.viewAllInLane')}
              <PiArrowSquareOutBold className="h-3 w-3" />
            </button>
          ) : (
            <Link
              href={exploreHref}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-muted px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-gray-100 dark:hover:bg-gray-200/20"
            >
              {t('searchHub.viewAllInLane')}
              <PiArrowSquareOutBold className="h-3 w-3" />
            </Link>
          )
        ) : null}
      </div>

      <div className="divide-y divide-muted">
        {visibleHits.map((hit) => (
          <div key={hit.id} className="px-3 py-2.5 @sm:px-4 @sm:py-3">
            {renderCard({ ...hit, lane: lane.lane })}
          </div>
        ))}
      </div>
    </section>
  );
}

function getLaneConfig(lane: OneSearchLaneId) {
  const configs: Record<OneSearchLaneId, { icon: React.ReactNode; color: { bg: string; text: string } }> = {
    chat: {
      icon: <PiChatCenteredDotsDuotone className="h-5 w-5 text-primary" />,
      color: { bg: 'bg-primary/10 dark:bg-primary/15', text: 'text-primary' },
    },
    cases: {
      icon: <PiFolderOpenDuotone className="h-5 w-5 text-violet-600 dark:text-violet-400" />,
      color: { bg: 'bg-violet-50 dark:bg-violet-500/15', text: 'text-violet-600' },
    },
    files: {
      icon: <PiFolderDuotone className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
      color: { bg: 'bg-amber-50 dark:bg-amber-500/15', text: 'text-amber-600' },
    },
    storage: {
      icon: <PiHardDrivesDuotone className="h-5 w-5 text-teal-600 dark:text-teal-400" />,
      color: { bg: 'bg-teal-50 dark:bg-teal-500/15', text: 'text-teal-600' },
    },
    users: {
      icon: <PiUserCircleDuotone className="h-5 w-5 text-fuchsia-600 dark:text-fuchsia-400" />,
      color: { bg: 'bg-fuchsia-50 dark:bg-fuchsia-500/15', text: 'text-fuchsia-600' },
    },
    graph: {
      icon: <PiGraphDuotone className="h-5 w-5 text-rose-600 dark:text-rose-400" />,
      color: { bg: 'bg-rose-50 dark:bg-rose-500/15', text: 'text-rose-600' },
    },
    projects_tasks: {
      icon: <PiListChecksDuotone className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />,
      color: { bg: 'bg-cyan-50 dark:bg-cyan-500/15', text: 'text-cyan-600' },
    },
  };

  return configs[lane] || {
    icon: <PiFolderDuotone className="h-5 w-5 text-gray-600 dark:text-gray-400" />,
    color: { bg: 'bg-gray-100 dark:bg-gray-200/20', text: 'text-gray-600' },
  };
}
