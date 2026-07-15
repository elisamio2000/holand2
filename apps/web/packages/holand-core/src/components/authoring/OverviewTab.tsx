import React, { useEffect, useState } from 'react';
import useAutosave from '../../hooks/useAutosave';

export default function OverviewTab({ assessmentId }: { assessmentId: string }) {
  const [assessment, setAssessment] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isAgeBranched, setIsAgeBranched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { schedule: scheduleAutosave } = useAutosave(async () => {
    if (!assessment) return;
    try {
      const res = await fetch(`/api/assessments/${assessmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || assessment.title,
          description: description || assessment.description,
          is_age_branched: isAgeBranched,
        }),
      });
      if (!res.ok) throw new Error('Update failed');
      const updated = await res.json();
      setAssessment(updated);
    } catch (e) {
      setError(String(e));
    }
  }, 800);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/assessments/${assessmentId}`);
        if (!res.ok) throw new Error('Failed to load assessment');
        const data = await res.json();
        setAssessment(data);
        setTitle(data.title);
        setDescription(data.description || '');
        setIsAgeBranched(data.is_age_branched || false);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [assessmentId]);

  if (loading) return <div className="tab-content loading">Loading assessment...</div>;
  if (error) return <div className="tab-content error">Error: {error}</div>;

  return (
    <div className="tab-content overview-tab">
      <div className="form-group">
        <label>Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            scheduleAutosave();
          }}
          placeholder="Assessment title"
        />
      </div>
      <div className="form-group">
        <label>Description</label>
        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            scheduleAutosave();
          }}
          placeholder="Assessment description"
          rows={4}
        />
      </div>
      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={isAgeBranched}
            onChange={(e) => {
              setIsAgeBranched(e.target.checked);
              scheduleAutosave();
            }}
          />
          Enable Age-Branching (4 separate branches for different age groups)
        </label>
      </div>
      <div className="status-section">
        <h4>Publish Status</h4>
        {assessment?.publish_state && (
          <div className="status-grid">
            {Object.entries(assessment.publish_state).map(([age, state]) => (
              <div key={age} className="status-item">
                <span className="age-label">{age}</span>
                <span className={`state-badge state-${state}`}>{state}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
