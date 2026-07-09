'use client';

import { Tooltip } from '@/components/tooltip';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PiDownloadSimple } from 'react-icons/pi';
import cn from '@core/utils/class-names';

import type { UIMessage } from '@/types/chat.types';
import { buildConversationExportData } from './utils/build-export-data';
import ChatExportModal from './chat-export-modal';

interface ExportMenuProps {
  sessionId: string;
  sessionTitle?: string;
  messages: UIMessage[];
  className?: string;
}

export default function ExportMenu({
  sessionId,
  sessionTitle,
  messages,
  className,
}: ExportMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const messageCount = useMemo(
    () => buildConversationExportData(sessionId, sessionTitle || '', messages).messages.length,
    [sessionId, sessionTitle, messages]
  );

  return (
    <>
      <Tooltip content={t('chatPage.export')} placement="bottom">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/20 dark:hover:text-gray-300',
            className
          )}
          aria-label={t('chatPage.export')}
          disabled={messageCount === 0}
        >
          <PiDownloadSimple className="h-5 w-5" />
        </button>
      </Tooltip>

      <ChatExportModal
        open={open}
        onClose={() => setOpen(false)}
        sessionId={sessionId}
        sessionTitle={sessionTitle}
        messages={messages}
      />
    </>
  );
}
