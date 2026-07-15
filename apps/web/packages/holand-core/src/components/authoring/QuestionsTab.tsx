import React, { useEffect, useState } from 'react';
import useAutosave from '../../hooks/useAutosave';

export default function QuestionsTab({ assessmentId }: { assessmentId: string }) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const { schedule: scheduleReorder } = useAutosave(async () => {
    if (questions.length === 0) return;
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/questions/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: questions.map((q, idx) => ({ question_id: q.id, order_index: idx })),
        }),
      });
      if (!res.ok) throw new Error('Reorder failed');
    } catch (e) {
      setError(String(e));
    }
  }, 1000);

  useEffect(() => {
    loadQuestions();
  }, [assessmentId]);

  async function loadQuestions() {
    try {
      setLoading(true);
      const res = await fetch(`/api/assessments/${assessmentId}/questions`);
      if (!res.ok) throw new Error('Failed to load questions');
      const data = await res.json();
      setQuestions(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function createQuestion() {
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'likert',
          dimension: 'R',
          text: 'New question',
          order_index: questions.length,
          is_reverse_scored: false,
          options: [
            { label: 'Disagree', value: 1, pole: 'R', weight: 1.0, order_index: 0 },
            { label: 'Agree', value: 5, pole: 'R', weight: 1.0, order_index: 1 },
          ],
        }),
      });
      if (!res.ok) throw new Error('Create failed');
      const q = await res.json();
      setQuestions([...questions, q]);
    } catch (e) {
      setError(String(e));
    }
  }

  async function updateQuestion(qId: string, data: any) {
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/questions/${qId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Update failed');
      const updated = await res.json();
      setQuestions(questions.map((q) => (q.id === qId ? updated : q)));
      setEditingId(null);
    } catch (e) {
      setError(String(e));
    }
  }

  async function deleteQuestion(qId: string) {
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/questions/${qId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      setQuestions(questions.filter((q) => q.id !== qId));
    } catch (e) {
      setError(String(e));
    }
  }

  const handleDragStart = (e: React.DragEvent, qId: string) => {
    setDraggedId(qId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }
    const dragIdx = questions.findIndex((q) => q.id === draggedId);
    const targetIdx = questions.findIndex((q) => q.id === targetId);
    const newQuestions = [...questions];
    [newQuestions[dragIdx], newQuestions[targetIdx]] = [newQuestions[targetIdx], newQuestions[dragIdx]];
    setQuestions(newQuestions);
    scheduleReorder();
    setDraggedId(null);
  };

  if (loading) return <div className="tab-content loading">Loading questions...</div>;

  return (
    <div className="tab-content questions-tab">
      {error && <div className="error-banner">{error}</div>}
      <div className="questions-header">
        <h4>Questions ({questions.length})</h4>
        <button onClick={createQuestion} className="btn-primary">+ Add Question</button>
      </div>

      <div className="questions-list">
        {questions.length === 0 ? (
          <div className="empty-state">No questions yet. Add one to get started.</div>
        ) : (
          questions.map((q, idx) => (
            <div
              key={q.id}
              draggable
              onDragStart={(e) => handleDragStart(e, q.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, q.id)}
              className={`question-row ${draggedId === q.id ? 'dragging' : ''}`}
            >
              <div className="q-order">{idx + 1}</div>
              {editingId === q.id ? (
                <div className="q-edit">
                  <input
                    autoFocus
                    value={q.text}
                    onChange={(e) => {
                      const updated = { ...q, text: e.target.value };
                      setQuestions(questions.map((q2) => (q2.id === q.id ? updated : q2)));
                    }}
                  />
                  <button
                    onClick={() => updateQuestion(q.id, q)}
                    className="btn-small btn-success"
                  >
                    Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="btn-small btn-secondary">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="q-view">
                  <div className="q-prompt">{q.text}</div>
                  <div className="q-meta">{q.kind} / {q.dimension}</div>
                  <button onClick={() => setEditingId(q.id)} className="btn-small">
                    Edit
                  </button>
                  <button onClick={() => deleteQuestion(q.id)} className="btn-small btn-danger">
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
