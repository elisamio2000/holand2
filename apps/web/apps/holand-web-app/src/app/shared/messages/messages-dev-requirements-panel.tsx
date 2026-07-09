'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'rizzui';
import { PiArrowsClockwiseBold } from 'react-icons/pi';
import {
  MESSAGES_BACKEND_CAPABILITY_GAPS,
  messagesGapI18nKey,
} from '@/app/shared/messages/config/backend-capability-gaps';
import {
  MESSAGES_API_GROUP_ORDER,
  MESSAGES_API_REQUIREMENTS,
  resolveLiveApiStatus,
} from '@/app/shared/messages/config/messages-api-requirements';
import type { MessagesApiHealth } from '@/hooks/use-messages-api-health';
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

const showDevPanel = isDevPanelEnabled('MESSAGES_DEV_PANEL');

let openPanelExternal: (() => void) | null = null;

/** Opens and scrolls to the messages dev requirements panel (no-op if panel hidden). */
export function openMessagesDevRequirementsPanel() {
  openPanelExternal?.();
}

export type MessagesDevRequirementsPanelHandle = {
  open: () => void;
};

interface MessagesDevRequirementsPanelProps {
  liveHealth?: MessagesApiHealth;
  onReProbe?: () => void;
  isProbing?: boolean;
}

type DevPanelTab = 'apis' | 'gaps';

/**
 * Collapsible dev handoff panel — backend API contract for messenger/mailbox team.
 * Dev-only (or NEXT_PUBLIC_MESSAGES_DEV_PANEL=true).
 */
const MessagesDevRequirementsPanel = forwardRef<
  MessagesDevRequirementsPanelHandle,
  MessagesDevRequirementsPanelProps
>(function MessagesDevRequirementsPanel({ liveHealth, onReProbe, isProbing }, ref) {
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
    mailList: 'unknown' as const,
    chatConversations: 'unknown' as const,
    wsInfo: 'unknown' as const,
    isProbing: false,
  };

  const liveCols = t('messages.devRequirements.liveApis.columns', {
    returnObjects: true,
  }) as Record<string, string>;

  const liveGroups = t('messages.devRequirements.liveApis.groups', {
    returnObjects: true,
  }) as Record<string, string>;

  const cols = t('messages.devRequirements.columns', { returnObjects: true }) as Record<
    string,
    string
  >;

  const gapLabels = {
    resolved: t('messages.devRequirements.resolved'),
    requestSample: t('messages.devRequirements.gaps.requestSample'),
    responseSample: t('messages.devRequirements.gaps.responseSample'),
    expandContract: t('messages.devRequirements.gaps.expandContract'),
    collapseContract: t('messages.devRequirements.gaps.collapseContract'),
    priority: {
      P0: t('messages.devRequirements.priority.P0'),
      P1: t('messages.devRequirements.priority.P1'),
      P2: t('messages.devRequirements.priority.P2'),
    },
    surfaces: t('messages.devRequirements.surfaces', { returnObjects: true }) as Record<
      string,
      string
    >,
  };

  const resolveStatusLabel = (statusKey: string) =>
    t(`messages.devRequirements.liveApis.status.${statusKey}`, statusKey);

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
        {t('messages.devRequirements.reProbe')}
      </Button>
    ) : null;

  return (
    <DevPanelShell
      ref={shellRef}
      id="messages-dev-requirements-panel"
      toggleLabel={t('messages.devRequirements.toggle')}
      enabled={showDevPanel}
      headerActions={headerActions}
    >
      <DevPanelHeader
        title={t('messages.devRequirements.title')}
        subtitle={t('messages.devRequirements.subtitle')}
      />

      <DevPanelTabs
        tabs={[
          { id: 'apis', label: t('messages.devRequirements.tabApis') },
          { id: 'gaps', label: t('messages.devRequirements.tabGaps') },
        ]}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as DevPanelTab)}
      />

      {activeTab === 'apis' && (
        <LiveApisTable
          rows={MESSAGES_API_REQUIREMENTS}
          labels={{
            columns: {
              id: liveCols.id,
              endpoint: liveCols.endpoint,
              status: liveCols.status,
            },
            status: t('messages.devRequirements.liveApis.status', {
              returnObjects: true,
            }) as Record<string, string>,
            groups: liveGroups,
          }}
          groupOrder={MESSAGES_API_GROUP_ORDER}
          groupLabel={(key) => liveGroups[key] ?? key}
          resolveStatus={(req) => resolveLiveApiStatus(req, health)}
          resolveStatusLabel={resolveStatusLabel}
        />
      )}

      {activeTab === 'gaps' && (
        <CapabilityGapsTable
          gaps={MESSAGES_BACKEND_CAPABILITY_GAPS}
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
          gapI18nKey={messagesGapI18nKey}
          translate={(key, fallback) => t(key, fallback)}
          copyLabel={t('messages.devRequirements.copy')}
        />
      )}

      <DevPanelFooter>{t('messages.devRequirements.footer')}</DevPanelFooter>
    </DevPanelShell>
  );
});

export default MessagesDevRequirementsPanel;
