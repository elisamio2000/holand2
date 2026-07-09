'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PiQuotes } from 'react-icons/pi';

interface SelectionQuoteToolbarProps {
  containerId: string;
  onQuote: (quotedText: string) => void;
}

export default function SelectionQuoteToolbar({
  containerId,
  onQuote,
}: SelectionQuoteToolbarProps) {
  const { t } = useTranslation();
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');

  const hide = useCallback(() => {
    setPosition(null);
    setSelectedText('');
  }, []);

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      const container = document.getElementById(containerId);
      if (!container?.contains(e.target as Node)) {
        hide();
        return;
      }

      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? '';
      if (!text || text.length < 2) {
        hide();
        return;
      }

      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      if (!range || !container.contains(range.commonAncestorContainer)) {
        hide();
        return;
      }

      const rect = range.getBoundingClientRect();
      setSelectedText(text);
      setPosition({
        top: rect.top + window.scrollY - 40,
        left: rect.left + window.scrollX + rect.width / 2,
      });
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [containerId, hide]);

  const handleQuote = useCallback(() => {
    if (!selectedText) return;
    const block = selectedText
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
    onQuote(`${block}\n\n`);
    hide();
    window.getSelection()?.removeAllRanges();
  }, [selectedText, onQuote, hide]);

  if (!position || !selectedText) return null;

  return (
    <div
      className="fixed z-[10001] -translate-x-1/2"
      style={{ top: position.top, left: position.left }}
      role="toolbar"
      aria-label={t('chatPage.quoteSelection.toolbarLabel')}
    >
      <button
        type="button"
        onClick={handleQuote}
        className="flex items-center gap-1.5 rounded-lg border border-muted bg-gray-0 px-3 py-1.5 text-sm font-medium text-gray-700 shadow-lg transition-colors hover:bg-gray-50 dark:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-100"
      >
        <PiQuotes className="h-4 w-4 text-primary" />
        {t('chatPage.quoteSelection.askAbout')}
      </button>
    </div>
  );
}
