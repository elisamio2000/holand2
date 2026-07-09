'use client';

import { splitByQuery } from '../utils/highlight-query';

interface HighlightedTextProps {
  text: string;
  query: string;
  className?: string;
  as?: 'span' | 'p';
}

export default function HighlightedText({
  text,
  query,
  className,
  as: Tag = 'span',
}: HighlightedTextProps) {
  const segments = splitByQuery(text, query);
  return (
    <Tag className={className}>
      {segments.map((seg, i) =>
        seg.highlight ? (
          <mark
            key={i}
            className="rounded-sm bg-primary/20 text-inherit dark:bg-primary/30"
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </Tag>
  );
}
