'use client';

import { useTranslation } from 'react-i18next';
import { Badge } from 'rizzui';
import cn from '@core/utils/class-names';
import type { OneSearchHit } from '@/types/one-search.types';
import {
  formatHitScore,
  hitMatchType,
  isQueryImageSelf,
  matchTypeBadgeColor,
  matchTypeI18nKey,
} from '../utils/hit-match-meta';

export interface HitMatchBadgesProps {
  hit: OneSearchHit;
  queryImageEcho?: string;
  showScore?: boolean;
  showMatchType?: boolean;
  showSelfBadge?: boolean;
  className?: string;
  size?: 'sm' | 'xs';
}

export function HitMatchBadges({
  hit,
  queryImageEcho,
  showScore = true,
  showMatchType = true,
  showSelfBadge = true,
  className,
  size = 'xs',
}: HitMatchBadgesProps) {
  const { t } = useTranslation();
  const match = hitMatchType(hit);
  const scoreText = formatHitScore(hit.score);
  const isSelf = showSelfBadge && isQueryImageSelf(hit, queryImageEcho);
  const textSize = size === 'sm' ? 'text-[11px]' : 'text-[10px]';

  if (!showScore && !showMatchType && !isSelf) return null;
  if (!scoreText && match === 'unknown' && !isSelf) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {isSelf && (
        <Badge color="primary" rounded="md" className={textSize}>
          {t('searchHub.queryImageSelf')}
        </Badge>
      )}
      {showMatchType && match !== 'unknown' && (
        <Badge color={matchTypeBadgeColor(match)} rounded="md" className={textSize}>
          {t(matchTypeI18nKey(match))}
        </Badge>
      )}
      {showScore && scoreText && (
        <Badge color="secondary" rounded="md" className={cn(textSize, 'font-mono tabular-nums')}>
          {t('searchHub.scoreLabel', { score: scoreText })}
        </Badge>
      )}
    </div>
  );
}
