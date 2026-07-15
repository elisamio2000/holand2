import React, { useEffect, useState } from 'react';
import useAutosave from '../../hooks/useAutosave';

export default function ScoringTab({ assessmentId }: { assessmentId: string }) {
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
  }, [assessmentId]);

  async function loadModels() {
    try {
      setLoading(true);
      const res = await fetch(`/api/assessments/${assessmentId}/scoring-models`);
      if (!res.ok) throw new Error('Failed to load models');
      const data = await res.json();
      setModels(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function createModel() {
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/scoring-models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formula_key: `model_${Date.now()}`,
          expression: { algorithm: 'weighted_sum', rules: [] },
        }),
      });
      if (!res.ok) throw new Error('Create failed');
      const m = await res.json();
      setModels([...models, m]);
    } catch (e) {
      setError(String(e));
    }
  }

  async function deleteModel(mId: string) {
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/scoring-models/${mId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      setModels(models.filter((m) => m.id !== mId));
    } catch (e) {
      setError(String(e));
    }
  }

  if (loading) return <div className="tab-content loading">Loading scoring models...</div>;

  return (
    <div className="tab-content scoring-tab">
      {error && <div className="error-banner">{error}</div>}
      <div className="models-header">
        <h4>Scoring Models ({models.length})</h4>
        <button onClick={createModel} className="btn-primary">+ Add Model</button>
      </div>

      <div className="models-grid">
        {models.length === 0 ? (
          <div className="empty-state">No scoring models yet.</div>
        ) : (
          models.map((m) => (
            <div key={m.id} className="model-card">
              <div className="card-header">
                <h5>{m.name}</h5>
                <span className={`version-badge`}>v{m.version}</span>
              </div>
              <div className="card-body">
                <div className="model-field">
                  <label>Algorithm:</label>
                  <code>{m.algorithm}</code>
                </div>
                <div className="model-field">
                  <label>Weight:</label>
                  <span>{m.weight}</span>
                </div>
                <div className="model-field">
                  <label>Output Type:</label>
                  <span>{m.output_type}</span>
                </div>
              </div>
              <div className="card-footer">
                <button onClick={() => setEditingId(m.id)} className="btn-small">
                  Edit
                </button>
                <button onClick={() => deleteModel(m.id)} className="btn-small btn-danger">
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
