import React, { useState } from 'react';
import OverviewTab from './OverviewTab';
import QuestionsTab from './QuestionsTab';
import ScoringTab from './ScoringTab';
import AgeBranchingTab from './AgeBranchingTab';

const tabs = ['Overview', 'Questions', 'Scoring', 'Age-Branching'] as const;

type Tab = typeof tabs[number];

export default function AuthoringPanel({ assessmentId }: { assessmentId: string }) {
  const [active, setActive] = useState<Tab>('Overview');

  return (
    <div className="authoring-panel">
      <header className="authoring-header">
        <h2>Authoring — Assessment</h2>
        <div className="tab-bar">
          {tabs.map((t) => (
            <button
              key={t}
              className={`tab-button ${t === active ? 'active' : ''}`}
              onClick={() => setActive(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <main className="authoring-main">
        {active === 'Overview' && <OverviewTab assessmentId={assessmentId} />}
        {active === 'Questions' && <QuestionsTab assessmentId={assessmentId} />}
        {active === 'Scoring' && <ScoringTab assessmentId={assessmentId} />}
        {active === 'Age-Branching' && <AgeBranchingTab assessmentId={assessmentId} />}
      </main>
    </div>
  );
}
