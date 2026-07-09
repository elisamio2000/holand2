'use client';

import { useState } from 'react';
import { Button } from 'rizzui';
import ChatDevRequirementsPanel from '@/app/shared/ai-chat/components/chat-dev-requirements-panel';
import ChatSearchExpandedModal from '@/app/shared/ai-chat/components/chat-search-expanded-modal';
import type { ChatSearchTab } from '@/app/shared/ai-chat/components/chat-search-results-panel';
import { LabSection } from '@/platform/lab';
import { SCENARIO_DEV_PANEL_CHECKLIST, SCENARIO_SEARCH_MODAL_CHECKLIST } from '../fixtures/qa-checklists';

export function DevPanelScenario({ moduleId = 'ai-chat' }: { moduleId?: string }) {
  return (
    <LabSection
      id="scenario-dev-panel"
      title="S2 — Dev requirements panel"
      description="Production ChatDevRequirementsPanel — grouped live APIs, tabbed gaps with expandable request/response samples, Re-probe."
      checklist={SCENARIO_DEV_PANEL_CHECKLIST}
      moduleId={moduleId}
      dataTourId="scenario-dev-panel"
    >
      <ChatDevRequirementsPanel />
    </LabSection>
  );
}

export function SearchModalScenario({ moduleId = 'ai-chat' }: { moduleId?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('lab search');
  const [activeTab, setActiveTab] = useState<ChatSearchTab>('sessions');

  return (
    <LabSection
      id="scenario-search-modal"
      title="S3 — In-app search modal"
      description="Production ChatSearchExpandedModal with empty mock results — layout, tabs, and dismiss behavior."
      checklist={SCENARIO_SEARCH_MODAL_CHECKLIST}
      moduleId={moduleId}
    >
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Open search modal
      </Button>
      <ChatSearchExpandedModal
        isOpen={open}
        onClose={() => setOpen(false)}
        query={query}
        onQueryChange={setQuery}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sessionResults={[]}
        messageResults={[]}
        fileResults={[]}
        isSearching={false}
        onSelectSession={() => {}}
        onSelectMessage={() => {}}
        onSelectFile={() => {}}
        onClear={() => setQuery('')}
      />
    </LabSection>
  );
}
