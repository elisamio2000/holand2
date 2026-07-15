import React, { useEffect, useState } from 'react';

export default function QuestionsTab({ assessmentId }: { assessmentId: string }) {
  const [questions, setQuestions] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/assessments/${assessmentId}/questions`);
        if (res.ok) setQuestions(await res.json());
      } catch (e) {
        console.error('load questions', e);
      }
    }
    load();
  }, [assessmentId]);

  return (
    <div className="questions-tab">
      <div className="questions-list">
        {questions.length === 0 && <div>No questions yet</div>}
        {questions.map((q) => (
          <div key={q.id} className="question-row">
            <div className="q-prompt">{q.prompt}</div>
            <div className="q-type">{q.question_type}</div>
          </div>
        ))}
      </div>
      <div className="questions-actions">
        <button onClick={async () => {
          const res = await fetch(`/api/assessments/${assessmentId}/questions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'New question', question_type: 'open_text', section_index: 0 }) });
          if (res.ok) setQuestions([...(await res.json() ? [await res.json()] : []), ...questions]);
        }}>Add question</button>
      </div>
    </div>
  );
}
