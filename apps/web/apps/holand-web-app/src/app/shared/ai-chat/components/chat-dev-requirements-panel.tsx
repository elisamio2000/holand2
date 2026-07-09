'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'rizzui';
import { PiArrowsClockwiseBold } from 'react-icons/pi';
import {
  CHAT_BACKEND_CAPABILITY_GAPS,
  chatGapI18nKey,
} from '@/app/shared/ai-chat/config/backend-capability-gaps';
import {
  CHAT_API_GROUP_ORDER,
  CHAT_API_REQUIREMENTS,
  resolveLiveApiStatus,
} from '@/app/shared/ai-chat/config/chat-api-requirements';
import type { ChatApiHealth } from '@/hooks/use-chat-api-health';
import {
  CapabilityGapsTable,
  DevPanelFooter,
  DevPanelHeader,
  DevPanelShell,
  DevPanelTabs,
  LiveApisTable,
  isDevPanelEnabled,
  type DevPanelShellHandle,
} from '@/platform/dev-panels';

const showDevPanel = isDevPanelEnabled('AI_CHAT_DEV_PANEL');

let openPanelExternal: (() => void) | null = null;

/** Opens and scrolls to the dev requirements panel (no-op if panel hidden). */
export function openChatDevRequirementsPanel() {
  openPanelExternal?.();
}

export type ChatDevRequirementsPanelHandle = {
  open: () => void;
};

interface ChatDevRequirementsPanelProps {
  liveHealth?: ChatApiHealth;
  onReProbe?: () => void;
  isProbing?: boolean;
}

type DevPanelTab = 'apis' | 'gaps';

/**
 * Collapsible dev handoff panel — backend API contract checklist for gateway team.
 * Dev-only (or NEXT_PUBLIC_AI_CHAT_DEV_PANEL=true).
 */
const ChatDevRequirementsPanel = forwardRef<
  ChatDevRequirementsPanelHandle,
  ChatDevRequirementsPanelProps
>(function ChatDevRequirementsPanel({ liveHealth, onReProbe, isProbing }, ref) {
  const { t } = useTranslation();
  const shellRef = useRef<DevPanelShellHandle>(null);
  const [activeTab, setActiveTab] = useState<DevPanelTab>('apis');

  const openPanel = useCallback(() => {
    shellRef.current?.open();
  }, []);

  useImperativeHandle(ref, () => ({ open: openPanel }), [openPanel]);

  useEffect(() => {
    openPanelExternal = openPanel;
    return () => {
      if (openPanelExternal === openPanel) openPanelExternal = null;
    };
  }, [openPanel]);

  if (!showDevPanel) return null;

  const health = liveHealth ?? {
    memory: 'unknown' as const,
    tools: 'unknown' as const,
    feedback: 'unknown' as const,
    isProbing: false,
  };

  const liveCols = t('chatPage.devRequirements.liveApis.columns', {
    returnObjects: true,
  }) as Record<string, string>;

  const liveGroups = t('chatPage.devRequirements.liveApis.groups', {
    returnObjects: true,
  }) as Record<string, string>;

  const cols = t('chatPage.devRequirements.columns', { returnObjects: true }) as Record<
    string,
    string
  >;

  const gapLabels = {
    resolved: t('chatPage.devRequirements.resolved'),
    requestSample: t('chatPage.devRequirements.gaps.requestSample'),
    responseSample: t('chatPage.devRequirements.gaps.responseSample'),
    expandContract: t('chatPage.devRequirements.gaps.expandContract'),
    collapseContract: t('chatPage.devRequirements.gaps.collapseContract'),
    priority: {
      P0: t('chatPage.devRequirements.priority.P0'),
      P1: t('chatPage.devRequirements.priority.P1'),
      P2: t('chatPage.devRequirements.priority.P2'),
    },
    surfaces: t('chatPage.devRequirements.surfaces', { returnObjects: true }) as Record<
      string,
      string
    >,
  };

  const resolveStatusLabel = (statusKey: string) =>
    t(`chatPage.devRequirements.liveApis.status.${statusKey}`, statusKey);

  const headerActions =
    onReProbe != null ? (
      <Button
        size="sm"
        variant="outline"
        className="h-7 shrink-0 px-2 text-[10px]"
        onClick={() => onReProbe()}
        disabled={isProbing ?? health.isProbing}
      >
        <PiArrowsClockwiseBold
          className={`me-1 size-3.5 ${isProbing ?? health.isProbing ? 'animate-spin' : ''}`}
        />
        {t('chatPage.devRequirements.reProbe')}
      </Button>
    ) : null;

  return (
    <DevPanelShell
      ref={shellRef}
      id="chat-dev-requirements-panel"
      toggleLabel={t('chatPage.devRequirements.toggle')}
      enabled={showDevPanel}
      headerActions={headerActions}
    >
      <DevPanelHeader
        title={t('chatPage.devRequirements.title')}
        subtitle={t('chatPage.devRequirements.subtitle')}
      />

      <DevPanelTabs
        tabs={[
          { id: 'apis', label: t('chatPage.devRequirements.tabApis') },
          { id: 'gaps', label: t('chatPage.devRequirements.tabGaps') },
        ]}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as DevPanelTab)}
      />

      {activeTab === 'apis' && (
        <LiveApisTable
          rows={CHAT_API_REQUIREMENTS}
          labels={{
            columns: {
              id: liveCols.id,
              endpoint: liveCols.endpoint,
              status: liveCols.status,
            },
            status: t('chatPage.devRequirements.liveApis.status', {
              returnObjects: true,
            }) as Record<string, string>,
            groups: liveGroups,
          }}
          groupOrder={CHAT_API_GROUP_ORDER}
          groupLabel={(key) => liveGroups[key] ?? key}
          resolveStatus={(req) => resolveLiveApiStatus(req, health)}
          resolveStatusLabel={resolveStatusLabel}
        />
      )}

      {activeTab === 'gaps' && (
        <CapabilityGapsTable
          gaps={CHAT_BACKEND_CAPABILITY_GAPS}
          columns={{
            capability: cols.capability,
            workaround: cols.workaround,
            contract: cols.contract,
            api: cols.api,
            priority: cols.priority,
            surface: cols.surface,
            acceptance: cols.acceptance,
          }}
          labels={gapLabels}
          gapI18nKey={chatGapI18nKey}
          translate={(key, fallback) => t(key, fallback)}
          copyLabel={t('chatPage.devRequirements.copy')}
        />
      )}

      <DevPanelFooter>{t('chatPage.devRequirements.footer')}</DevPanelFooter>
    </DevPanelShell>
  );
});

export default ChatDevRequirementsPanel;
