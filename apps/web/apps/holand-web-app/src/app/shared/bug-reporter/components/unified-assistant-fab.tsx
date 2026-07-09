'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  PiXBold,
  PiChatCircleDotsBold,
  PiBugBeetleBold,
  PiStopCircleBold,
  PiQuestionBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import { SUPPORT_USER_ID } from '../config/support-config';
import { useBugReporter } from '../context/bug-reporter-context';

const FAB_SIZE = 56; // main FAB diameter (px)
const SUB_SIZE = 48; // sub-button diameter (px)

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
}

/**
 * Arc positions for LTR: FAB is at bottom-RIGHT → opens upper-LEFT
 * Arc positions for RTL: FAB is at bottom-LEFT  → opens upper-RIGHT
 *
 * Three slots: straight-up, diagonal, horizontal
 * tx: negative = left, positive = right (screen coords)
 * ty: negative = up
 */
const ARC_LTR = [
  { tx:   0, ty: -76 }, // ↑  straight up
  { tx: -54, ty: -54 }, // ↖  upper-left diagonal
  { tx: -76, ty:   0 }, // ←  straight left
] as const;

const ARC_RTL = [
  { tx:  0, ty: -76 }, // ↑  straight up
  { tx: 54, ty: -54 }, // ↗  upper-right diagonal
  { tx: 76, ty:   0 }, // →  straight right
] as const;

type SubItem = {
  id: string;
  icon: React.ReactNode;
  label: string;
  colorClass: string;
  onClick?: () => void;
};

export default function UnifiedAssistantFab() {
  const { t } = useTranslation();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const { isEnabled, capturePhase, recordingDuration, toggleCapture } = useBugReporter();
  const isRecording = capturePhase === 'recording';
  const isComposing = capturePhase === 'composing';

  // Detect page direction to pick the correct arc table
  const [isRTL, setIsRTL] = useState(false);
  useEffect(() => {
    setIsRTL(document.documentElement.dir === 'rtl');
    // Re-check if dir attribute changes at runtime (language switch)
    const observer = new MutationObserver(() => {
      setIsRTL(document.documentElement.dir === 'rtl');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['dir'] });
    return () => observer.disconnect();
  }, []);

  // Close menu when recording starts
  useEffect(() => {
    if (isRecording) setMenuOpen(false);
  }, [isRecording]);

  // Close on click outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [menuOpen]);

  const handleBugReport = useCallback(() => {
    setMenuOpen(false);
    void toggleCapture();
  }, [toggleCapture]);

  const handleSupportChat = useCallback(() => {
    setMenuOpen(false);
    router.push(routes.messagesPeopleChat(SUPPORT_USER_ID));
  }, [router]);

  if (isComposing) return null;

  // ── RECORDING MODE ─────────────────────────────────────────────────────────
  if (isRecording) {
    return (
      <button
        type="button"
        onClick={() => void toggleCapture()}
        className={cn(
          'unified-assistant-fab rr-block fixed bottom-6 end-6 z-[9000]',
          'flex items-center gap-2 rounded-full px-4 py-3',
          'bg-red-600 hover:bg-red-700 text-white shadow-2xl',
          'ring-2 ring-red-300 ring-offset-2',
          'transition-all duration-300 hover:scale-105 active:scale-95'
        )}
        title={t('messages.bugReport.stopRecording', 'Stop recording')}
        aria-label={t('messages.bugReport.stopRecording', 'Stop recording')}
      >
        <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-300 opacity-75" />
          <PiStopCircleBold className="relative h-5 w-5" />
        </span>
        <span className="font-mono text-sm font-semibold tabular-nums">
          {formatDuration(recordingDuration)}
        </span>
      </button>
    );
  }

  // ── IDLE / OPEN STATE ──────────────────────────────────────────────────────
  const subItems: SubItem[] = [
    {
      id: 'bug',
      icon: <PiBugBeetleBold className="h-[22px] w-[22px]" />,
      label: t('messages.bugReport.reportBug', 'Report bug'),
      colorClass: isEnabled
        ? 'bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500'
        : 'bg-gray-400 cursor-not-allowed opacity-50',
      onClick: isEnabled ? handleBugReport : undefined,
    },
    {
      id: 'support',
      icon: <PiChatCircleDotsBold className="h-[22px] w-[22px]" />,
      label: t('messages.fab.chatCustomer', 'Chat with support'),
      colorClass: 'bg-blue-500 hover:bg-blue-600',
      onClick: handleSupportChat,
    },
  ];

  const arcPositions = isRTL ? ARC_RTL : ARC_LTR;
  const total = subItems.length;
  const subOffset = (FAB_SIZE - SUB_SIZE) / 2; // = 4px centering

  return (
    <div
      ref={containerRef}
      className="unified-assistant-fab rr-block fixed bottom-6 end-6 z-[9000]"
      style={{ width: FAB_SIZE, height: FAB_SIZE }}
    >
      {/* Sub-buttons */}
      {subItems.map(({ id, icon, label, colorClass, onClick }, idx) => {
        const { tx, ty } = arcPositions[idx];

        const style: React.CSSProperties = {
          transitionProperty: 'transform, opacity',
          transitionDuration: menuOpen ? '220ms' : '150ms',
          transitionTimingFunction: menuOpen
            ? 'cubic-bezier(0.34, 1.56, 0.64, 1)'
            : 'cubic-bezier(0.4, 0, 0.2, 1)',
          transitionDelay: menuOpen
            ? `${idx * 55}ms`
            : `${(total - 1 - idx) * 40}ms`,
          transform: menuOpen
            ? `translate(${tx}px, ${ty}px) scale(1)`
            : 'translate(0px, 0px) scale(0)',
          opacity: menuOpen ? 1 : 0,
          pointerEvents: menuOpen ? 'auto' : 'none',
        };

        return (
          <button
            key={id}
            type="button"
            onClick={onClick}
            disabled={!onClick}
            aria-label={label}
            title={label}
            className={cn(
              'absolute flex items-center justify-center rounded-full text-white shadow-xl',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2',
              colorClass
            )}
            style={{
              ...style,
              width: SUB_SIZE,
              height: SUB_SIZE,
              bottom: subOffset,
              insetInlineEnd: subOffset,
            }}
          >
            {icon}
          </button>
        );
      })}

      {/* Main FAB */}
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={menuOpen ? t('common.close', 'Close') : t('messages.fab.openMenu', 'Help & support')}
        aria-expanded={menuOpen}
        title={menuOpen ? t('common.close', 'Close') : t('messages.fab.openMenu', 'Help & support')}
        className={cn(
          'absolute inset-0 flex items-center justify-center rounded-full shadow-2xl text-white',
          'transition-colors duration-300 hover:scale-105 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2',
          menuOpen
            ? 'bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500'
            : 'bg-primary hover:bg-primary-dark'
        )}
      >
        {/* Icon crossfades between ? and ✕ */}
        <span className="relative flex h-6 w-6 items-center justify-center">
          <PiQuestionBold
            className="absolute h-6 w-6 transition-all duration-200"
            style={{
              opacity: menuOpen ? 0 : 1,
              transform: menuOpen ? 'rotate(90deg) scale(0.5)' : 'rotate(0deg) scale(1)',
            }}
          />
          <PiXBold
            className="absolute h-6 w-6 transition-all duration-200"
            style={{
              opacity: menuOpen ? 1 : 0,
              transform: menuOpen ? 'rotate(0deg) scale(1)' : 'rotate(-90deg) scale(0.5)',
            }}
          />
        </span>
      </button>

      {/* Invisible backdrop — closes menu on outside click */}
      {menuOpen && (
        <div
          className="fixed inset-0"
          style={{ zIndex: -1 }}
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}
