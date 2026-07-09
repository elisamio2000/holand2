'use client';

import { Tooltip } from '@/components/tooltip';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';

import type { UIMessage } from '@/types/chat.types';
import {
  ARC_NAV_CENTER_SLOT,
  ARC_NAV_MIN_TURNS,
  ARC_NAV_SLOT_COUNT,
  arcMessageAnchorId,
  buildDialSlots,
  buildTurnsFromMessages,
  computeArcLineGeometry,
  type ArcNavTurn,
} from './arc-navigator-utils';

export interface ArcNavigatorProps {
  messages: UIMessage[];
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  hidden?: boolean;
  className?: string;
}

export default function ArcNavigator({
  messages,
  scrollContainerRef,
  hidden = false,
  className,
}: ArcNavigatorProps) {
  const { t } = useTranslation();
  const turns = useMemo(() => buildTurnsFromMessages(messages), [messages]);
  const maxWeight = useMemo(
    () => Math.max(1, ...turns.map((x) => x.weight)),
    [turns]
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const wheelAccum = useRef(0);
  const isProgrammaticScroll = useRef(false);

  const dialSlots = useMemo(
    () => buildDialSlots(turns, activeIndex),
    [turns, activeIndex]
  );

  const scrollToTurn = useCallback(
    (turn: ArcNavTurn, behavior: ScrollBehavior = 'smooth') => {
      const container = scrollContainerRef.current;
      const anchor = document.getElementById(arcMessageAnchorId(turn.userMessageId));
      if (!container || !anchor) return;

      isProgrammaticScroll.current = true;
      const containerRect = container.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const offset = anchorRect.top - containerRect.top + container.scrollTop - 24;

      container.scrollTo({ top: Math.max(0, offset), behavior });
      window.setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, behavior === 'smooth' ? 450 : 50);
    },
    [scrollContainerRef]
  );

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || turns.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isProgrammaticScroll.current) return;
        let best: { idx: number; ratio: number } | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = entry.target.getAttribute('data-arc-turn-index');
          if (id == null) continue;
          const idx = Number(id);
          if (!Number.isFinite(idx)) continue;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { idx, ratio: entry.intersectionRatio };
          }
        }
        if (best) setActiveIndex(best.idx);
      },
      { root: container, rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    turns.forEach((turn, idx) => {
      const el = document.getElementById(arcMessageAnchorId(turn.userMessageId));
      if (el) {
        el.setAttribute('data-arc-turn-index', String(idx));
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, [turns, scrollContainerRef, messages]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      wheelAccum.current += e.deltaY;
      if (Math.abs(wheelAccum.current) < 40) return;

      const dir = wheelAccum.current > 0 ? 1 : -1;
      wheelAccum.current = 0;
      const next = Math.max(0, Math.min(turns.length - 1, activeIndex + dir));
      if (next === activeIndex) return;
      setActiveIndex(next);
      scrollToTurn(turns[next]);
    },
    [activeIndex, turns, scrollToTurn]
  );

  if (hidden || turns.length < ARC_NAV_MIN_TURNS) return null;

  return (
    <nav
      className={cn(
        'pointer-events-auto absolute right-2 top-1/2 z-40 -translate-y-1/2',
        'w-[72px] select-none',
        'hidden lg:flex lg:flex-col',
        className
      )}
      aria-label={t('chatPage.arcNavigator.ariaLabel')}
      onWheel={handleWheel}
    >
      <div className="flex max-h-[min(72vh,640px)] flex-col items-end justify-center gap-[7px] py-4">
        {dialSlots.map((slot) => {
          const isPlaceholder = slot.turn === null;
          const geo = computeArcLineGeometry(
            slot.slotIndex,
            ARC_NAV_SLOT_COUNT,
            slot.turn?.weight ?? 1,
            maxWeight,
            ARC_NAV_CENTER_SLOT,
            { placeholder: isPlaceholder }
          );

          if (isPlaceholder) {
            return (
              <div
                key={`slot-${slot.slotIndex}-empty`}
                className="flex w-full items-center justify-end px-0.5 py-0.5"
                aria-hidden
              >
                <span
                  className="block shrink-0 rounded-full bg-gray-400/20 dark:bg-gray-500/15"
                  style={{
                    width: geo.length,
                    height: 1,
                    opacity: geo.opacity,
                    transform: `translateX(${geo.offsetX}px)`,
                    transformOrigin: 'right center',
                  }}
                />
              </div>
            );
          }

          const turn = slot.turn!;

          return (
            <Tooltip
              key={`slot-${slot.slotIndex}-${turn.id}`}
              placement="left"
              content={
                <span className="block max-w-[220px] whitespace-pre-wrap text-xs leading-snug">
                  {turn.fullLabel}
                </span>
              }
            >
              <button
                type="button"
                aria-label={turn.fullLabel}
                onClick={() => {
                  setActiveIndex(slot.globalIndex);
                  scrollToTurn(turn);
                }}
                className={cn(
                  'group flex w-full items-center justify-end gap-1 rounded-md px-0.5 py-0.5 transition-all duration-150 ease-out',
                  geo.isActive && 'z-10'
                )}
              >
                {geo.showDot && (
                  <span
                    className="size-1 shrink-0 rounded-full bg-primary shadow-sm"
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    'block shrink-0 rounded-full transition-all duration-150 ease-out',
                    geo.isActive
                      ? 'bg-primary shadow-sm'
                      : 'bg-gray-500/50 dark:bg-gray-400/45'
                  )}
                  style={{
                    width: geo.length,
                    height: geo.lineHeight,
                    opacity: geo.isActive ? 1 : geo.opacity,
                    transform: `translateX(${geo.offsetX}px)`,
                    transformOrigin: 'right center',
                  }}
                  aria-hidden
                />
              </button>
            </Tooltip>
          );
        })}
      </div>
    </nav>
  );
}
