'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  PiPlus,
  PiXBold,
  PiChatCircleDotsBold,
  PiSparkle,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import { requestNativeAiChatOpen } from '@/app/shared/native-ai-chat/native-ai-chat-bridge';
import { SUPPORT_USER_ID } from '../config/support-config';

export default function MessagesSupportFab() {
  const { t } = useTranslation();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [menuOpen]);

  const handleSupportChat = () => {
    setMenuOpen(false);
    router.push(routes.messagesPeopleChat(SUPPORT_USER_ID));
  };

  const handleAiChat = () => {
    setMenuOpen(false);
    requestNativeAiChatOpen('messages');
  };

  return (
    <div
      ref={containerRef}
      className="support-assistant-fab-root rr-block fixed bottom-24 end-6 z-[9000] flex flex-col items-end gap-2"
    >
      {menuOpen && (
        <div className="flex flex-col items-end gap-2 rounded-2xl border border-muted bg-gray-0/95 p-2 shadow-xl backdrop-blur-sm dark:bg-gray-50/95">
          <button
            type="button"
            onClick={handleSupportChat}
            className="flex w-full min-w-[220px] items-center gap-3 rounded-xl bg-blue-500 px-3 py-2.5 text-start text-sm font-medium text-white transition-colors hover:bg-blue-600"
          >
            <PiChatCircleDotsBold className="h-5 w-5 shrink-0" />
            <span>{t('messages.fab.chatCustomer')}</span>
          </button>
          <button
            type="button"
            onClick={handleAiChat}
            className="flex w-full min-w-[220px] items-center gap-3 rounded-xl bg-violet-600 px-3 py-2.5 text-start text-sm font-medium text-white transition-colors hover:bg-violet-700"
          >
            <PiSparkle className="h-5 w-5 shrink-0" />
            <span>{t('messages.fab.aiChat')}</span>
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all duration-300',
          menuOpen ? 'rotate-45 bg-gray-700 hover:bg-gray-800' : 'bg-primary hover:bg-primary-dark',
          'hover:scale-105 active:scale-95'
        )}
        aria-label={menuOpen ? t('common.close') : t('messages.fab.openMenu')}
      >
        {menuOpen ? (
          <PiXBold className="h-6 w-6 text-white" />
        ) : (
          <PiPlus className="h-6 w-6 text-white" />
        )}
      </button>
    </div>
  );
}
