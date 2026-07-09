'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  PiBookOpenTextBold,
  PiBugBeetleBold,
  PiChatCircleDotsBold,
  PiQuestionBold,
  PiStopCircleBold,
} from 'react-icons/pi';
import { ActionIcon, Popover, Text, Title } from 'rizzui';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import { useBugReporter } from '@/app/shared/bug-reporter/context/bug-reporter-context';
import { SUPPORT_USER_ID } from '@/app/shared/bug-reporter/config/support-config';
import { useMedia } from '@core/hooks/use-media';
import {
  headerActionIconClass,
  headerHelpRecordingClass,
} from '@/layouts/header-action-icon-styles';
import {
  HeaderActionTooltip,
  HeaderPopoverWithTooltip,
} from '@/layouts/header-action-tooltip';

const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL?.trim() || '';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
}

function HelpMenuList({
  isEnabled,
  onClose,
  onSupportChat,
  onBugReport,
  onDocs,
}: {
  isEnabled: boolean;
  onClose: () => void;
  onSupportChat: () => void;
  onBugReport: () => void;
  onDocs: () => void;
}) {
  const { t } = useTranslation();

  const items = [
    {
      id: 'support',
      icon: PiChatCircleDotsBold,
      label: t('headerHelp.supportChat'),
      hint: t('headerHelp.supportChatHint'),
      onClick: onSupportChat,
      disabled: false,
    },
    {
      id: 'bug',
      icon: PiBugBeetleBold,
      label: t('headerHelp.reportBug'),
      hint: t('headerHelp.reportBugHint'),
      onClick: onBugReport,
      disabled: !isEnabled,
    },
    {
      id: 'docs',
      icon: PiBookOpenTextBold,
      label: t('headerHelp.documentation'),
      hint: DOCS_URL ? t('headerHelp.documentationHint') : t('headerHelp.docsComingSoon'),
      onClick: onDocs,
      disabled: !DOCS_URL,
    },
  ] as const;

  return (
    <div className="w-[280px] text-left sm:w-[320px] rtl:text-right">
      <div className="mb-2 ps-5">
        <Title as="h5" fontWeight="semibold">
          {t('headerHelp.title')}
        </Title>
        <Text className="mt-0.5 text-xs text-gray-500">{t('headerHelp.subtitle')}</Text>
      </div>
      <div className="grid grid-cols-1 gap-0.5 px-2 pb-1">
        {items.map(({ id, icon: Icon, label, hint, onClick, disabled }) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              onClick();
              onClose();
            }}
            className={cn(
              'flex items-start gap-3 rounded-lg px-3 py-2.5 text-start transition-colors',
              disabled
                ? 'cursor-not-allowed opacity-50'
                : 'hover:bg-gray-100 dark:hover:bg-gray-50'
            )}
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <Text className="text-sm font-semibold text-gray-900 dark:text-gray-700">{label}</Text>
              <Text className="text-xs text-gray-500">{hint}</Text>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Help hub — support chat, bug report, and documentation under one header control. */
export default function HeaderHelpLauncher() {
  const { t } = useTranslation();
  const router = useRouter();
  const isMobile = useMedia('(max-width: 480px)', false);
  const [isOpen, setIsOpen] = useState(false);

  const { isEnabled, capturePhase, recordingDuration, toggleCapture } = useBugReporter();
  const isRecording = capturePhase === 'recording';
  const isComposing = capturePhase === 'composing';

  const handleSupportChat = useCallback(() => {
    router.push(routes.messagesPeopleChat(SUPPORT_USER_ID));
  }, [router]);

  const handleBugReport = useCallback(() => {
    void toggleCapture();
  }, [toggleCapture]);

  const handleDocs = useCallback(() => {
    if (DOCS_URL) {
      window.open(DOCS_URL, '_blank', 'noopener,noreferrer');
    }
  }, []);

  if (isComposing) return null;

  if (isRecording) {
    const stopLabel = t('headerHelp.stopRecording');
    return (
      <HeaderActionTooltip content={stopLabel}>
        <button
          type="button"
          onClick={() => void toggleCapture()}
          className={headerHelpRecordingClass}
          aria-label={stopLabel}
        >
          <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-300 opacity-75" />
            <PiStopCircleBold className="relative h-4 w-4" aria-hidden />
          </span>
          <span className="font-mono text-xs font-semibold tabular-nums md:text-sm">
            {formatDuration(recordingDuration)}
          </span>
        </button>
      </HeaderActionTooltip>
    );
  }

  const menuLabel = t('headerHelp.openMenu');

  return (
    <HeaderPopoverWithTooltip label={menuLabel}>
      <Popover
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        shadow="sm"
        placement={isMobile ? 'bottom' : 'bottom-end'}
      >
        <Popover.Trigger>
          <ActionIcon
            variant="text"
            aria-label={menuLabel}
            aria-expanded={isOpen}
            className={cn(headerActionIconClass(isOpen), 'p-1')}
          >
            <PiQuestionBold className="h-[18px] w-[18px]" aria-hidden />
          </ActionIcon>
        </Popover.Trigger>
        <Popover.Content className="z-[9999] px-0 py-4 dark:bg-gray-100 [&>svg]:hidden [&>svg]:dark:fill-gray-100 sm:[&>svg]:inline-flex">
          <HelpMenuList
            isEnabled={isEnabled}
            onClose={() => setIsOpen(false)}
            onSupportChat={handleSupportChat}
            onBugReport={handleBugReport}
            onDocs={handleDocs}
          />
        </Popover.Content>
      </Popover>
    </HeaderPopoverWithTooltip>
  );
}
