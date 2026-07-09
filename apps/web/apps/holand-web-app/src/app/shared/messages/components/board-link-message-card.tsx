'use client';

import Link from 'next/link';
import { PiSquaresFourBold } from 'react-icons/pi';
import { routes } from '@/config/routes';

export interface BoardLinkMessageCardProps {
  boardId: string;
  title?: string;
  objectCount?: number;
  className?: string;
}

/** Renders a board deep-link card inside messenger threads. */
export function BoardLinkMessageCard({
  boardId,
  title = 'Board',
  objectCount,
  className,
}: BoardLinkMessageCardProps) {
  const href = `${routes.userBoards.detail(boardId)}?view=readOnly`;

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg border border-muted bg-gray-50/80 p-3 transition-colors hover:border-primary/40 hover:bg-primary/5 dark:bg-gray-200/20 ${className ?? ''}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <PiSquaresFourBold className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">{title}</span>
        <span className="block text-[10px] text-gray-500">
          Board · {objectCount != null ? `${objectCount} objects` : boardId.slice(0, 8)}
        </span>
      </span>
    </Link>
  );
}

export function parseBoardLinkFromMessageBody(body: string): { boardId: string; title?: string } | null {
  const match = body.match(/\[board_link:([^\]|]+)(?:\|([^\]]+))?\]/);
  if (!match?.[1]) return null;
  return { boardId: match[1], title: match[2] };
}

export function formatBoardLinkMessageBody(boardId: string, title?: string): string {
  return `[board_link:${boardId}${title ? `|${title}` : ''}]`;
}
