import React, { useEffect, useState } from 'react';

const AGE_GROUPS = ['child', 'teen', 'adult', 'senior'] as const;

type AgeGroup = typeof AGE_GROUPS[number];

export default function AgeBranchingTab({ assessmentId }: { assessmentId: string }) {
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/assessments/${assessmentId}/branches`);
        if (res.ok) setBranches(await res.json());
      } catch (e) {
        console.error('load branches', e);
      }
    }
    load();
  }, [assessmentId]);

  return (
    <div className="age-branching-tab">
      <div className="branch-cards">
        {AGE_GROUPS.map((g) => {
          const b = branches.find((br: any) => br.age_group === g) || { age_group: g, state: 'not_initialized' };
          return (
            <div key={g} className="branch-card">
              <h4>{g}</h4>
              <div>State: {b.state}</div>
              {b.state === 'not_initialized' ? (
                <button onClick={async () => {
                  const res = await fetch(`/api/assessments/${assessmentId}/branches/${g}/init`, { method: 'POST' });
                  if (res.ok) setBranches(await (await fetch(`/api/assessments/${assessmentId}/branches`)).json());
                }}>Copy from parent</button>
              ) : (
                <button onClick={() => alert('Open branch editor (switch tab)')}>Edit</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
