import React, { useEffect, useState } from 'react';

export default function ScoringTab({ assessmentId }: { assessmentId: string }) {
  const [models, setModels] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/assessments/${assessmentId}/scoring-models`);
        if (res.ok) setModels(await res.json());
      } catch (e) {
        console.error('load scoring models', e);
      }
    }
    load();
  }, [assessmentId]);

  return (
    <div className="scoring-tab">
      <div className="models-list">
        {models.length === 0 && <div>No scoring models</div>}
        {models.map((m) => (
          <div key={m.id} className="model-card">
            <div className="model-name">{m.name}</div>
            <div className="model-algo">{m.algorithm}</div>
          </div>
        ))}
      </div>
      <div className="models-actions">
        <button onClick={async () => {
          const res = await fetch(`/api/assessments/${assessmentId}/scoring-models`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'New model', algorithm: 'weighted_sum', output_type: 'score', config_json: {} }) });
          if (res.ok) setModels([...(await res.json() ? [await res.json()] : []), ...models]);
        }}>Add model</button>
      </div>
    </div>
  );
}
