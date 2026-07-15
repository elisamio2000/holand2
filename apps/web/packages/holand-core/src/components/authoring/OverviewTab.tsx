import React, { useEffect, useState } from 'react';

export default function OverviewTab({ assessmentId }: { assessmentId: string }) {
  const [assessment, setAssessment] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/assessments/${assessmentId}`);
        if (res.ok) setAssessment(await res.json());
      } catch (e) {
        console.error('load assessment', e);
      }
    }
    load();
  }, [assessmentId]);

  if (!assessment) return <div>Loading assessment...</div>;

  return (
    <div className="overview-tab">
      <label>
        Title
        <input defaultValue={assessment.title} />
      </label>
      <label>
        Description
        <textarea defaultValue={assessment.description} />
      </label>
      <div>Age-branched: {assessment.is_age_branched ? 'Yes' : 'No'}</div>
    </div>
  );
}
