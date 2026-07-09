'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { PiSparkle } from 'react-icons/pi';
import { ActionIcon } from 'rizzui';
import cn from '@core/utils/class-names';
import { HeaderActionTooltip } from '@/layouts/header-action-tooltip';
import { usePermissions } from '@/hooks/use-permissions';
import {
  NATIVE_AI_CHAT_PANEL_STATE_EVENT,
  requestNativeAiChatOpen,
  resolveNativeAiChatSurface,
  type NativeAiChatPanelStateDetail,
} from '@/app/shared/native-ai-chat/native-ai-chat-bridge';
import { headerAiChatIconClass } from '@/layouts/header-action-icon-styles';

/**
 * Persistent header launcher for native AI chat.
 * Click → opens the floating panel (active state). Does NOT navigate away.
 * Close/deselect only via the panel ✕ button (or minimize → floating FAB).
 */
export default function HeaderAiChatLauncher() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { canAccessSection, isLoading } = usePermissions();
  const surface = resolveNativeAiChatSurface(pathname);
  const [panelOpen, setPanelOpen] = useState(false);
  const canShowChat = isLoading || canAccessSection('chat');

  useEffect(() => {
    setPanelOpen(false);
    const onState = (e: Event) => {
      const ce = e as CustomEvent<NativeAiChatPanelStateDetail>;
      if (ce.detail?.surface === surface) {
        setPanelOpen(!!ce.detail.open);
      }
    };
    window.addEventListener(NATIVE_AI_CHAT_PANEL_STATE_EVENT, onState as EventListener);
    return () =>
      window.removeEventListener(NATIVE_AI_CHAT_PANEL_STATE_EVENT, onState as EventListener);
  }, [surface]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (panelOpen) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      requestNativeAiChatOpen(surface, rect);
    },
    [surface, panelOpen]
  );

  if (!canShowChat) {
    return null;
  }

  const label = panelOpen
    ? t('nativeAiChat.headerPanelOpen')
    : t('nativeAiChat.headerOpenPanel');

  return (
    <HeaderActionTooltip content={label}>
      <ActionIcon
        variant="text"
        aria-label={label}
        aria-pressed={panelOpen}
        className={cn(headerAiChatIconClass(panelOpen), 'p-1')}
        onClick={handleClick}
      >
        <PiSparkle
          className={cn('h-[18px] w-[18px]', panelOpen && 'text-white')}
          aria-hidden
        />
      </ActionIcon>
    </HeaderActionTooltip>
  );
}
