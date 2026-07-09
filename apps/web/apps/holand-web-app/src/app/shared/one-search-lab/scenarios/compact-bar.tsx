'use client';

import { useCallback, useState, type FormEvent } from 'react';
import { OneSearchCompactBar } from '@/app/shared/one-search/one-search-chrome';
import { useOneSearchCompactBarPin } from '@/app/shared/one-search/hooks/use-one-search-compact-bar-pin';
import { LabSection } from '@/platform/lab';
import { SCENARIO_COMPACT_CHECKLIST } from '../fixtures/qa-checklists';

export function CompactBarScenario({ moduleId = 'one-search' }: { moduleId?: string }) {
  const [query, setQuery] = useState('platform dx lab');
  const { sentinelRef, barRef, pin } = useOneSearchCompactBarPin(true);

  const onSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
    },
    []
  );

  return (
    <LabSection
      id="scenario-compact"
      title="S1 — Compact search bar + pin"
      description="Scroll the column — compact bar pins to the main scroll container top like production One Search results."
      checklist={SCENARIO_COMPACT_CHECKLIST}
      moduleId={moduleId}
      dataTourId="scenario-compact"
    >
      <div className="max-h-[65vh] overflow-y-auto rounded-lg border border-muted bg-gray-50/30 dark:bg-gray-100/5">
        <div ref={sentinelRef} aria-hidden className="h-0" />
        {pin.placeholderHeight > 0 && <div style={{ height: pin.placeholderHeight }} aria-hidden />}
        <OneSearchCompactBar
          query={query}
          setQuery={setQuery}
          onSubmit={onSubmit}
          variant="default"
          onOpenAdvanced={() => {}}
          onOpenSimple={() => {}}
          onClearQuery={() => setQuery('')}
          barRef={barRef}
          pinned={pin.active}
          pinStyle={pin.style}
        />
        <div className="space-y-[40vh] p-4">
          <p className="text-sm text-gray-500">Scroll to exercise compact bar pin behavior…</p>
          <p className="text-sm text-gray-500">End of scroll area</p>
        </div>
      </div>
      {pin.active && (
        <p className="mt-2 text-xs font-medium text-primary">Compact bar is pinned (fixed)</p>
      )}
    </LabSection>
  );
}
