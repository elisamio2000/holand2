import React, { useEffect, useState } from 'react';

const AGE_GROUPS = ['child', 'teen', 'adult', 'senior'] as const;

type AgeGroup = typeof AGE_GROUPS[number];

export default function AgeBranchingTab({ assessmentId }: { assessmentId: string }) {
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBranches();
  }, [assessmentId]);

  async function loadBranches() {
    try {
      setLoading(true);
      const res = await fetch(`/api/assessments/${assessmentId}/branches`);
      if (!res.ok) throw new Error('Failed to load branches');
      const data = await res.json();
      setBranches(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function initBranch(ageGroup: AgeGroup) {
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/branches/${ageGroup}/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Init failed');
      await loadBranches();
    } catch (e) {
      setError(String(e));
    }
  }

  async function updateBranchState(ageGroup: AgeGroup, newState: string) {
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/branches/${ageGroup}/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: newState }),
      });
      if (!res.ok) throw new Error('State update failed');
      await loadBranches();
    } catch (e) {
      setError(String(e));
    }
  }

  if (loading) return <div className="tab-content loading">Loading branches...</div>;

  return (
    <div className="tab-content age-branching-tab">
      {error && <div className="error-banner">{error}</div>}
      <div className="branch-intro">
        <h4>Age-Branching Management</h4>
        <p>Manage separate assessment versions for different age groups.</p>
      </div>

      <div className="branch-cards">
        {AGE_GROUPS.map((ageGroup) => {
          const branch = branches.find((b: any) => b.age_group === ageGroup);
          const isInitialized = branch && branch.state !== 'not_initialized';
          const states = ['draft', 'reviewed', 'approved', 'published'];

          return (
            <div key={ageGroup} className="branch-card">
              <div className="branch-header">
                <h5>{ageGroup.toUpperCase()}</h5>
                {branch && (
                  <span className={`state-badge state-${branch.state}`}>{branch.state}</span>
                )}
              </div>
              <div className="branch-body">
                {!isInitialized ? (
                  <>
                    <div className="branch-status">Not initialized</div>
                    <button
                      onClick={() => initBranch(ageGroup)}
                      className="btn-primary btn-block"
                    >
                      Initialize (Copy from Parent)
                    </button>
                  </>
                ) : (
                  <>
                    <div className="state-selector">
                      <label>State:</label>
                      <select
                        value={branch.state}
                        onChange={(e) => updateBranchState(ageGroup, e.target.value)}
                        className="select-input"
                      >
                        {states.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="branch-info">
                      <small>
                        Created: {branch.created_at ? new Date(branch.created_at).toLocaleDateString() : 'N/A'}
                      </small>
                      {branch.created_from_id && (
                        <small>Copied from: {branch.created_from_id.substring(0, 8)}</small>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
