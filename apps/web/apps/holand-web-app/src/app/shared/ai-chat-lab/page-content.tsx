'use client';

import Link from 'next/link';
import { LabShell, DevBanner } from '@/platform/lab';
import { DevPanelScenario, SearchModalScenario } from './scenarios/dev-panel-and-search';
import { AiChatLabTour } from './components/ai-chat-lab-tour';

type LabTab = 'scenarios';

const ANCHORS = [
  { href: '#scenario-dev-panel', label: 'Dev panel', tab: 'scenarios' as LabTab },
  { href: '#scenario-search-modal', label: 'Search modal', tab: 'scenarios' as LabTab },
];

export function AiChatLabPage() {
  return (
    <div className="space-y-4">
      <AiChatLabTour />
      <LabShell<LabTab>
        moduleId="ai-chat"
        defaultTab="scenarios"
        banner={
          <DevBanner>
            Media attachment / MPS scenarios live in{' '}
            <Link href="/dev/media-players" className="underline">
              Media Player Lab
            </Link>{' '}
            (S1, S5, S6). This lab covers chat-specific dev panel and search modal. Verify streaming on{' '}
            <Link href="/ai-chat" className="underline" data-tour="lab-production-link">
              production AI Chat
            </Link>
            .
          </DevBanner>
        }
        anchors={ANCHORS}
        tabs={[
          {
            id: 'scenarios',
            label: 'Scenarios',
            dataTourId: 'lab-tab-scenarios',
            content: (
              <div className="space-y-6">
                <DevPanelScenario />
                <SearchModalScenario />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
