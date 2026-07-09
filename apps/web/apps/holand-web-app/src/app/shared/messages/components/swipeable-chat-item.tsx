'use client';

import { ReactNode, useRef, useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import cn from '@core/utils/class-names';
import { PiPushPinBold, PiArchiveBold } from 'react-icons/pi';

interface SwipeableChatItemProps {
  children: ReactNode;
  onPin?: () => void;
  onArchive?: () => void;
  isPinned?: boolean;
  className?: string;
}

export default function SwipeableChatItem({
  children,
  onPin,
  onArchive,
  isPinned,
  className,
}: SwipeableChatItemProps) {
  const [offsetX, setOffsetX] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      if (eventData.dir === 'Left') {
        const offset = Math.min(0, eventData.deltaX);
        setOffsetX(Math.max(offset, -100));
      }
    },
    onSwipedLeft: () => {
      if (Math.abs(offsetX) > 50) {
        setOffsetX(-100);
      } else {
        setOffsetX(0);
      }
    },
    onSwipedRight: () => {
      setOffsetX(0);
    },
    trackMouse: false,
    trackTouch: true,
  });

  const handleActionClick = (action: 'pin' | 'archive') => {
    if (action === 'pin' && onPin) {
      onPin();
    } else if (action === 'archive' && onArchive) {
      onArchive();
    }
    setOffsetX(0);
  };

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden', className)}>
      <div
        {...handlers}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: offsetX === 0 || offsetX === -100 ? 'transform 0.2s ease-out' : 'none',
        }}
        className="relative"
      >
        {children}
      </div>

      <div
        className={cn(
          'absolute inset-y-0 right-0 flex items-center gap-2 px-3',
          'transition-opacity',
          offsetX < -10 ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        {onPin && (
          <button
            type="button"
            onClick={() => handleActionClick('pin')}
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-lg transition-colors',
              isPinned
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            )}
          >
            <PiPushPinBold className="h-5 w-5" />
          </button>
        )}
        {onArchive && (
          <button
            type="button"
            onClick={() => handleActionClick('archive')}
            className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-500 text-white transition-colors hover:bg-gray-600"
          >
            <PiArchiveBold className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
