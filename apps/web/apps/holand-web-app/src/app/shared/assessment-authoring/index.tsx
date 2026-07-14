'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  AssessmentVersionDiff,
  AssessmentVersionDetail,
  AssessmentVersionSummary,
  AuditLogEntry,
  AuthoringAssessmentType,
  FormulaVersion,
  VersionPreflight,
} from '@/types/assessment-authoring.types';
import { assessmentAuthoringService } from '@/services/assessment-authoring.service';

function toErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: { detail?: unknown } } }).response;
    const detail = response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (detail && typeof detail === 'object' && 'message' in detail && typeof detail.message === 'string') {
      return detail.message;
    }
  }
  return error instanceof Error ? error.message : 'Unknown error';
}

function sortByVersionDesc<T extends { version: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.version - a.version);
}

export function AssessmentAuthoringDashboard() {
  const [assessmentVersions, setAssessmentVersions] = useState<AssessmentVersionSummary[]>([]);
  const [formulaVersions, setFormulaVersions] = useState<FormulaVersion[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [selectedFormulaId, setSelectedFormulaId] = useState<string | null>(null);
  const [assessmentDetail, setAssessmentDetail] = useState<AssessmentVersionDetail | null>(null);
  const [formulaDetail, setFormulaDetail] = useState<FormulaVersion | null>(null);
  const [assessmentPreflight, setAssessmentPreflight] = useState<VersionPreflight | null>(null);
  const [formulaPreflight, setFormulaPreflight] = useState<VersionPreflight | null>(null);
  const [transitionNote, setTransitionNote] = useState('');
  const [assessmentDiff, setAssessmentDiff] = useState<AssessmentVersionDiff | null>(null);
  const [compareAssessmentId, setCompareAssessmentId] = useState<string>('');
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actor, setActor] = useState('admin@holand.dev');

  const [assessmentType, setAssessmentType] = useState<AuthoringAssessmentType>('holland');
  const [assessmentTitle, setAssessmentTitle] = useState('New assessment draft');

  const [questionText, setQuestionText] = useState('');
  const [questionDimension, setQuestionDimension] = useState('R');
  const [questionKind, setQuestionKind] = useState<'likert' | 'forced_choice'>('likert');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [questionEditText, setQuestionEditText] = useState('');
  const [optionLabel, setOptionLabel] = useState('New option');
  const [optionValue, setOptionValue] = useState(1);
  const [optionPole, setOptionPole] = useState('R');
  const [optionWeight, setOptionWeight] = useState(1);

  const [formulaKey, setFormulaKey] = useState('holland_normalization_ratio');
  const [formulaType, setFormulaType] = useState<AuthoringAssessmentType>('holland');
  const [formulaExpr, setFormulaExpr] = useState('(value / total) * 100 if total > 0 else 0');
  const [formulaInputVars, setFormulaInputVars] = useState('value,total');
  const [formulaOutputMetric, setFormulaOutputMetric] = useState('normalized_percentage');
  const [simulateInput, setSimulateInput] = useState('{"value": 8, "total": 10}');
  const [simulateResult, setSimulateResult] = useState<number | null>(null);

  async function refreshLists() {
    const [assessments, formulas] = await Promise.all([
      assessmentAuthoringService.listAssessmentVersions(),
      assessmentAuthoringService.listFormulaVersions(),
    ]);
    const sortedAssessments = sortByVersionDesc(assessments);
    const sortedFormulas = sortByVersionDesc(formulas);
    setAssessmentVersions(sortedAssessments);
    setFormulaVersions(sortedFormulas);
    if (!selectedAssessmentId && sortedAssessments.length > 0) {
      setSelectedAssessmentId(sortedAssessments[0].id);
    }
    if (!selectedFormulaId && sortedFormulas.length > 0) {
      setSelectedFormulaId(sortedFormulas[0].id);
    }
  }

  async function refreshAssessmentDetail(versionId: string) {
    const detail = await assessmentAuthoringService.getAssessmentVersion(versionId);
    setAssessmentDetail(detail);
    const exists = detail.questions.some((q) => q.id === selectedQuestionId);
    if (!exists) {
      const next = detail.questions[0];
      setSelectedQuestionId(next?.id ?? null);
      setQuestionEditText(next?.text ?? '');
    }
  }

  async function refreshFormulaDetail(formulaId: string) {
    const detail = await assessmentAuthoringService.getFormulaVersion(formulaId);
    setFormulaDetail(detail);
  }

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    refreshLists()
      .catch((err: unknown) => {
        if (!cancelled) setError(toErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedAssessmentId) {
      setAssessmentDetail(null);
      return;
    }
    refreshAssessmentDetail(selectedAssessmentId).catch((err: unknown) => setError(toErrorMessage(err)));
  }, [selectedAssessmentId]);

  useEffect(() => {
    if (!selectedFormulaId) {
      setFormulaDetail(null);
      return;
    }
    refreshFormulaDetail(selectedFormulaId).catch((err: unknown) => setError(toErrorMessage(err)));
  }, [selectedFormulaId]);

  async function handleCreateAssessmentDraft() {
    setError(null);
    try {
      const created = await assessmentAuthoringService.createAssessmentDraft({
        assessment_type: assessmentType,
        title: assessmentTitle.trim(),
        created_by: actor.trim(),
      });
      await refreshLists();
      setSelectedAssessmentId(created.id);
      setAssessmentPreflight(null);
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    }
  }

  async function handleAddQuestion() {
    if (!selectedAssessmentId) return;
    setError(null);
    try {
      await assessmentAuthoringService.addQuestion(selectedAssessmentId, {
        kind: questionKind,
        dimension: questionDimension.trim(),
        text: questionText.trim(),
        order_index: assessmentDetail?.questions.length ?? 0,
        is_reverse_scored: false,
        options:
          questionKind === 'likert'
            ? [
                { label: '1', value: 1, pole: questionDimension.slice(0, 1), weight: 1, order_index: 0 },
                { label: '2', value: 2, pole: questionDimension.slice(0, 1), weight: 2, order_index: 1 },
                { label: '3', value: 3, pole: questionDimension.slice(0, 1), weight: 3, order_index: 2 },
                { label: '4', value: 4, pole: questionDimension.slice(0, 1), weight: 4, order_index: 3 },
                { label: '5', value: 5, pole: questionDimension.slice(0, 1), weight: 5, order_index: 4 },
              ]
            : [
                { label: 'Option A', value: 1, pole: questionDimension.slice(0, 1), weight: 1, order_index: 0 },
                { label: 'Option B', value: 2, pole: questionDimension.slice(1, 2), weight: 1, order_index: 1 },
              ],
      });
      await refreshAssessmentDetail(selectedAssessmentId);
      setQuestionText('');
      setAssessmentPreflight(null);
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    }
  }

  async function handleDeleteQuestion(questionId: string) {
    if (!selectedAssessmentId) return;
    setError(null);
    try {
      const detail = await assessmentAuthoringService.deleteQuestion(selectedAssessmentId, questionId);
      setAssessmentDetail(detail);
      if (selectedQuestionId === questionId) {
        const next = detail.questions[0];
        setSelectedQuestionId(next?.id ?? null);
        setQuestionEditText(next?.text ?? '');
      }
      setAssessmentPreflight(null);
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    }
  }

  async function handleUpdateSelectedQuestion() {
    if (!selectedAssessmentId || !selectedQuestionId) return;
    setError(null);
    try {
      const detail = await assessmentAuthoringService.updateQuestion(selectedAssessmentId, selectedQuestionId, {
        text: questionEditText.trim(),
      });
      setAssessmentDetail(detail);
      setAssessmentPreflight(null);
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    }
  }

  async function handleMoveQuestion(questionId: string, direction: 'up' | 'down') {
    if (!selectedAssessmentId || !assessmentDetail) return;
    const sorted = [...assessmentDetail.questions].sort((a, b) => a.order_index - b.order_index);
    const index = sorted.findIndex((q) => q.id === questionId);
    if (index === -1) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= sorted.length) return;
    [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
    const items = sorted.map((q, idx) => ({ question_id: q.id, order_index: idx }));
    setError(null);
    try {
      const detail = await assessmentAuthoringService.reorderQuestions(selectedAssessmentId, items);
      setAssessmentDetail(detail);
      setAssessmentPreflight(null);
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    }
  }

  async function handleAddOption() {
    if (!selectedAssessmentId || !selectedQuestionId || !assessmentDetail) return;
    const selectedQuestion = assessmentDetail.questions.find((q) => q.id === selectedQuestionId);
    if (!selectedQuestion) return;
    setError(null);
    try {
      const detail = await assessmentAuthoringService.addOption(selectedAssessmentId, selectedQuestionId, {
        label: optionLabel.trim(),
        value: optionValue,
        pole: optionPole.trim(),
        weight: optionWeight,
        order_index: selectedQuestion.options.length,
      });
      setAssessmentDetail(detail);
      setAssessmentPreflight(null);
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    }
  }

  async function handleDeleteOption(optionId: string) {
    if (!selectedAssessmentId || !selectedQuestionId) return;
    setError(null);
    try {
      const detail = await assessmentAuthoringService.deleteOption(
        selectedAssessmentId,
        selectedQuestionId,
        optionId
      );
      setAssessmentDetail(detail);
      setAssessmentPreflight(null);
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    }
  }

  async function handleMoveOption(optionId: string, direction: 'up' | 'down') {
    if (!selectedAssessmentId || !selectedQuestionId || !assessmentDetail) return;
    const selectedQuestion = assessmentDetail.questions.find((q) => q.id === selectedQuestionId);
    if (!selectedQuestion) return;
    const sorted = [...selectedQuestion.options].sort((a, b) => a.order_index - b.order_index);
    const index = sorted.findIndex((o) => o.id === optionId);
    if (index === -1) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= sorted.length) return;
    [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
    const items = sorted.map((o, idx) => ({ option_id: o.id, order_index: idx }));
    setError(null);
    try {
      const detail = await assessmentAuthoringService.reorderOptions(
        selectedAssessmentId,
        selectedQuestionId,
        items
      );
      setAssessmentDetail(detail);
      setAssessmentPreflight(null);
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    }
  }

  async function handleAssessmentTransition(action: 'review' | 'approve' | 'publish') {
    if (!selectedAssessmentId) return;
    setError(null);
    try {
      if (action === 'review') {
        await assessmentAuthoringService.reviewAssessmentVersion(selectedAssessmentId, {
          actor: actor.trim(),
          note: transitionNote.trim() || undefined,
        });
      } else if (action === 'approve') {
        await assessmentAuthoringService.approveAssessmentVersion(selectedAssessmentId, {
          actor: actor.trim(),
          note: transitionNote.trim() || undefined,
        });
      } else {
        await assessmentAuthoringService.publishAssessmentVersion(selectedAssessmentId, {
          actor: actor.trim(),
          note: transitionNote.trim() || undefined,
        });
      }
      await Promise.all([refreshLists(), refreshAssessmentDetail(selectedAssessmentId)]);
      setAssessmentPreflight(null);
      setTransitionNote('');
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    }
  }

  async function handleAssessmentPreflight() {
    if (!selectedAssessmentId) return;
    setError(null);
    try {
      const preflight = await assessmentAuthoringService.preflightAssessment(selectedAssessmentId);
      setAssessmentPreflight(preflight);
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    }
  }

  async function handleCreateFormulaDraft() {
    setError(null);
    try {
      const created = await assessmentAuthoringService.createFormulaDraft({
        formula_key: formulaKey.trim(),
        assessment_type: formulaType,
        expression: { expr: formulaExpr.trim() },
        input_variables: formulaInputVars
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        output_metric: formulaOutputMetric.trim(),
        created_by: actor.trim(),
      });
      await refreshLists();
      setSelectedFormulaId(created.id);
      setFormulaPreflight(null);
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    }
  }

  async function handleUpdateFormulaDraft() {
    if (!selectedFormulaId) return;
    setError(null);
    try {
      await assessmentAuthoringService.updateFormulaDraft(selectedFormulaId, {
        expression: { expr: formulaExpr.trim() },
        input_variables: formulaInputVars
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        output_metric: formulaOutputMetric.trim(),
      });
      await refreshFormulaDetail(selectedFormulaId);
      setFormulaPreflight(null);
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    }
  }

  async function handleFormulaTransition(action: 'review' | 'approve' | 'publish') {
    if (!selectedFormulaId) return;
    setError(null);
    try {
      if (action === 'review') {
        await assessmentAuthoringService.reviewFormulaVersion(selectedFormulaId, {
          actor: actor.trim(),
          note: transitionNote.trim() || undefined,
        });
      } else if (action === 'approve') {
        await assessmentAuthoringService.approveFormulaVersion(selectedFormulaId, {
          actor: actor.trim(),
          note: transitionNote.trim() || undefined,
        });
      } else {
        await assessmentAuthoringService.publishFormulaVersion(selectedFormulaId, {
          actor: actor.trim(),
          note: transitionNote.trim() || undefined,
        });
      }
      await Promise.all([refreshLists(), refreshFormulaDetail(selectedFormulaId)]);
      setFormulaPreflight(null);
      setTransitionNote('');
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    }
  }

  async function handleAssessmentDiff() {
    if (!selectedAssessmentId || !compareAssessmentId) return;
    setError(null);
    try {
      const diff = await assessmentAuthoringService.diffAssessmentVersions(
        selectedAssessmentId,
        compareAssessmentId
      );
      setAssessmentDiff(diff);
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    }
  }

  async function handleLoadAudit(entityId: string | null) {
    setError(null);
    try {
      const rows = await assessmentAuthoringService.listAuditLogs(entityId ?? undefined);
      setAuditEntries(rows);
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    }
  }

  async function handleFormulaPreflight() {
    if (!selectedFormulaId) return;
    setError(null);
    try {
      const preflight = await assessmentAuthoringService.preflightFormula(selectedFormulaId);
      setFormulaPreflight(preflight);
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    }
  }

  async function handleFormulaSimulation() {
    if (!selectedFormulaId) return;
    setError(null);
    try {
      const variables = JSON.parse(simulateInput) as Record<string, number>;
      const result = await assessmentAuthoringService.simulateFormula(selectedFormulaId, variables);
      setSimulateResult(result.result);
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    }
  }

  const assessmentDrafts = useMemo(
    () => assessmentVersions.filter((x) => x.status === 'draft'),
    [assessmentVersions]
  );
  const formulaDrafts = useMemo(() => formulaVersions.filter((x) => x.status === 'draft'), [formulaVersions]);
  const comparableAssessmentVersions = useMemo(() => {
    if (!assessmentDetail) return [];
    return assessmentVersions.filter(
      (row) =>
        row.id !== assessmentDetail.id &&
        row.assessment_type === assessmentDetail.assessment_type
    );
  }, [assessmentDetail, assessmentVersions]);

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-7xl p-6 sm:p-8 lg:p-10">
        <p className="text-sm text-gray-500">Loading canonical authoring console...</p>
      </main>
    );
  }

  if (error) {
    const isAuthError = error.toLowerCase().includes('401') || error.toLowerCase().includes('403') || error.toLowerCase().includes('unauthorized') || error.toLowerCase().includes('forbidden');
    return (
      <main className="mx-auto w-full max-w-7xl p-6 sm:p-8 lg:p-10">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950">
          <h2 className="text-base font-semibold text-red-800 dark:text-red-200">
            {isAuthError ? 'دسترسی رد شد (401/403)' : 'خطا در بارگذاری آزمایشگاه خبره'}
          </h2>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            {isAuthError
              ? 'شما دسترسی لازم برای مشاهده این بخش را ندارید. لطفاً با مدیر سیستم تماس بگیرید.'
              : error}
          </p>
          {!isAuthError && (
            <button
              className="mt-4 rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900"
              onClick={() => {
                setError(null);
                setIsLoading(true);
                refreshLists()
                  .catch((err: unknown) => setError(toErrorMessage(err)))
                  .finally(() => setIsLoading(false));
              }}
            >
              تلاش مجدد
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl p-6 sm:p-8 lg:p-10">
      <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Assessment Authoring Console (Canonical)</h1>
      <p className="mt-3 max-w-4xl text-sm leading-7 text-gray-600">
        Canonical workflow for assessment and scoring governance using /admin/assessment-versions and
        /admin/formula-versions.
      </p>

      <div className="mt-4">
        <label className="text-sm text-gray-700">Actor</label>
        <input
          className="mt-1 w-full max-w-md rounded-lg border border-muted px-3 py-2 text-sm"
          value={actor}
          onChange={(e) => setActor(e.target.value)}
        />
      </div>
      <div className="mt-2">
        <label className="text-sm text-gray-700">Transition note (optional)</label>
        <input
          className="mt-1 w-full max-w-xl rounded-lg border border-muted px-3 py-2 text-sm"
          value={transitionNote}
          onChange={(e) => setTransitionNote(e.target.value)}
          placeholder="Reason or governance note for review/approve/publish"
        />
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-muted bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Assessment versions</h2>
          <p className="mt-1 text-xs text-gray-500">Drafts: {assessmentDrafts.length}</p>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <select
              className="rounded-lg border border-muted px-3 py-2 text-sm"
              value={assessmentType}
              onChange={(e) => setAssessmentType(e.target.value as AuthoringAssessmentType)}
            >
              <option value="holland">holland</option>
              <option value="mbti">mbti</option>
            </select>
            <input
              className="rounded-lg border border-muted px-3 py-2 text-sm"
              value={assessmentTitle}
              onChange={(e) => setAssessmentTitle(e.target.value)}
            />
            <button
              type="button"
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white"
              onClick={handleCreateAssessmentDraft}
            >
              Create draft
            </button>
          </div>

          <div className="mt-4 max-h-56 space-y-2 overflow-auto">
            {assessmentVersions.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedAssessmentId(row.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  selectedAssessmentId === row.id ? 'border-emerald-500 bg-emerald-50' : 'border-muted bg-white'
                }`}
              >
                <p className="font-medium text-gray-900">{row.title}</p>
                <p className="text-xs text-gray-600">
                  {row.assessment_type} · v{row.version} · {row.status}
                </p>
              </button>
            ))}
          </div>

          {assessmentDetail && (
            <div className="mt-5 space-y-3 rounded-lg border border-muted bg-gray-50 p-3">
              <p className="text-sm font-medium text-gray-900">
                Selected: {assessmentDetail.title} (v{assessmentDetail.version}) [{assessmentDetail.status}]
              </p>
              <p className="text-xs text-gray-600">Questions: {assessmentDetail.questions.length}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border border-gray-400 px-3 py-1 text-xs"
                  onClick={handleAssessmentPreflight}
                >
                  Run preflight
                </button>
                <button
                  type="button"
                  className="rounded border border-blue-500 px-3 py-1 text-xs text-blue-700"
                  onClick={() => handleAssessmentTransition('review')}
                >
                  Review
                </button>
                <button
                  type="button"
                  className="rounded border border-indigo-500 px-3 py-1 text-xs text-indigo-700"
                  onClick={() => handleAssessmentTransition('approve')}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="rounded border border-emerald-600 px-3 py-1 text-xs text-emerald-700"
                  onClick={() => handleAssessmentTransition('publish')}
                >
                  Publish
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <select
                  className="rounded border border-muted px-2 py-1 text-xs"
                  value={questionKind}
                  onChange={(e) => setQuestionKind(e.target.value as 'likert' | 'forced_choice')}
                >
                  <option value="likert">likert</option>
                  <option value="forced_choice">forced_choice</option>
                </select>
                <input
                  className="rounded border border-muted px-2 py-1 text-xs"
                  value={questionDimension}
                  onChange={(e) => setQuestionDimension(e.target.value)}
                  placeholder="Dimension (R/EI...)"
                />
                <input
                  className="rounded border border-muted px-2 py-1 text-xs sm:col-span-3"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Question text"
                />
              </div>
              <button
                type="button"
                className="rounded bg-gray-900 px-3 py-1 text-xs font-medium text-white"
                onClick={handleAddQuestion}
                disabled={!questionText.trim()}
              >
                Add question
              </button>

              <div className="space-y-2 rounded border border-muted bg-white p-2">
                <p className="text-xs font-medium text-gray-700">Question editor</p>
                {assessmentDetail.questions
                  .slice()
                  .sort((a, b) => a.order_index - b.order_index)
                  .map((q) => (
                    <div
                      key={q.id}
                      className={`rounded border p-2 ${
                        selectedQuestionId === q.id ? 'border-emerald-500 bg-emerald-50' : 'border-muted'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          className="text-left text-xs font-medium text-gray-800"
                          onClick={() => {
                            setSelectedQuestionId(q.id);
                            setQuestionEditText(q.text);
                            setOptionPole(q.dimension.slice(0, 1));
                          }}
                        >
                          #{q.order_index + 1} {q.dimension} · {q.kind}
                        </button>
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            className="rounded border border-muted px-2 py-0.5 text-xs"
                            onClick={() => handleMoveQuestion(q.id, 'up')}
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            className="rounded border border-muted px-2 py-0.5 text-xs"
                            onClick={() => handleMoveQuestion(q.id, 'down')}
                          >
                            Down
                          </button>
                          <button
                            type="button"
                            className="rounded border border-red-400 px-2 py-0.5 text-xs text-red-700"
                            onClick={() => handleDeleteQuestion(q.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-gray-600">{q.text}</p>
                    </div>
                  ))}
              </div>

              {selectedQuestionId && (
                <div className="space-y-2 rounded border border-muted bg-white p-2">
                  <p className="text-xs font-medium text-gray-700">Selected question details</p>
                  <input
                    className="w-full rounded border border-muted px-2 py-1 text-xs"
                    value={questionEditText}
                    onChange={(e) => setQuestionEditText(e.target.value)}
                    placeholder="Edit question text"
                  />
                  <button
                    type="button"
                    className="rounded border border-muted px-3 py-1 text-xs"
                    onClick={handleUpdateSelectedQuestion}
                    disabled={!questionEditText.trim()}
                  >
                    Save question text
                  </button>

                  <div className="grid gap-2 sm:grid-cols-4">
                    <input
                      className="rounded border border-muted px-2 py-1 text-xs sm:col-span-2"
                      value={optionLabel}
                      onChange={(e) => setOptionLabel(e.target.value)}
                      placeholder="Option label"
                    />
                    <input
                      type="number"
                      className="rounded border border-muted px-2 py-1 text-xs"
                      value={optionValue}
                      onChange={(e) => setOptionValue(Number(e.target.value))}
                      placeholder="Value"
                    />
                    <input
                      className="rounded border border-muted px-2 py-1 text-xs"
                      value={optionPole}
                      onChange={(e) => setOptionPole(e.target.value)}
                      placeholder="Pole"
                    />
                    <input
                      type="number"
                      step="0.1"
                      className="rounded border border-muted px-2 py-1 text-xs"
                      value={optionWeight}
                      onChange={(e) => setOptionWeight(Number(e.target.value))}
                      placeholder="Weight"
                    />
                    <button
                      type="button"
                      className="rounded border border-muted px-2 py-1 text-xs sm:col-span-2"
                      onClick={handleAddOption}
                      disabled={!optionLabel.trim() || !optionPole.trim()}
                    >
                      Add option
                    </button>
                  </div>

                  <div className="space-y-1">
                    {(assessmentDetail.questions.find((q) => q.id === selectedQuestionId)?.options ?? [])
                      .slice()
                      .sort((a, b) => a.order_index - b.order_index)
                      .map((opt) => (
                        <div
                          key={opt.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded border border-muted px-2 py-1 text-xs"
                        >
                          <span>
                            #{opt.order_index + 1} {opt.label} · v:{opt.value} · p:{opt.pole} · w:{opt.weight}
                          </span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="rounded border border-muted px-2 py-0.5"
                              onClick={() => handleMoveOption(opt.id, 'up')}
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              className="rounded border border-muted px-2 py-0.5"
                              onClick={() => handleMoveOption(opt.id, 'down')}
                            >
                              Down
                            </button>
                            <button
                              type="button"
                              className="rounded border border-red-400 px-2 py-0.5 text-red-700"
                              onClick={() => handleDeleteOption(opt.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {assessmentPreflight && (
                <div className="rounded border border-muted bg-white p-2 text-xs">
                  <p>
                    Ready: {assessmentPreflight.ready_to_publish ? 'yes' : 'no'} · Blocking:{' '}
                    {assessmentPreflight.blocking_issue_count} · Warnings: {assessmentPreflight.warning_count}
                  </p>
                  {assessmentPreflight.issues.map((issue) => (
                    <p key={`${issue.code}-${issue.path}`} className="mt-1 text-gray-700">
                      [{issue.blocking ? 'BLOCK' : 'WARN'}] {issue.code}: {issue.message}
                    </p>
                  ))}
                </div>
              )}

              <div className="space-y-2 rounded border border-muted bg-white p-2 text-xs">
                <p className="font-medium text-gray-700">Version diff + audit</p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="rounded border border-muted px-2 py-1 text-xs"
                    value={compareAssessmentId}
                    onChange={(e) => setCompareAssessmentId(e.target.value)}
                  >
                    <option value="">Select compare target</option>
                    {comparableAssessmentVersions.map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.version} · {v.status} · {v.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="rounded border border-muted px-2 py-1"
                    onClick={handleAssessmentDiff}
                    disabled={!compareAssessmentId}
                  >
                    Compute diff
                  </button>
                  <button
                    type="button"
                    className="rounded border border-muted px-2 py-1"
                    onClick={() => handleLoadAudit(assessmentDetail.id)}
                  >
                    Load assessment audit
                  </button>
                </div>
                {assessmentDiff && (
                  <div className="rounded border border-muted bg-gray-50 p-2">
                    <p>
                      Diff {assessmentDiff.from_version_id.slice(0, 8)} →{' '}
                      {assessmentDiff.to_version_id.slice(0, 8)}
                    </p>
                    <p>
                      Added: {assessmentDiff.added.length} · Removed: {assessmentDiff.removed.length} · Changed:{' '}
                      {assessmentDiff.changed.length}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-muted bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Formula versions</h2>
          <p className="mt-1 text-xs text-gray-500">Drafts: {formulaDrafts.length}</p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <input
              className="rounded border border-muted px-3 py-2 text-sm"
              value={formulaKey}
              onChange={(e) => setFormulaKey(e.target.value)}
              placeholder="formula_key"
            />
            <select
              className="rounded border border-muted px-3 py-2 text-sm"
              value={formulaType}
              onChange={(e) => setFormulaType(e.target.value as AuthoringAssessmentType)}
            >
              <option value="holland">holland</option>
              <option value="mbti">mbti</option>
            </select>
            <input
              className="rounded border border-muted px-3 py-2 text-sm sm:col-span-2"
              value={formulaExpr}
              onChange={(e) => setFormulaExpr(e.target.value)}
              placeholder="Expression (expr)"
            />
            <input
              className="rounded border border-muted px-3 py-2 text-sm"
              value={formulaInputVars}
              onChange={(e) => setFormulaInputVars(e.target.value)}
              placeholder="input vars (comma separated)"
            />
            <input
              className="rounded border border-muted px-3 py-2 text-sm"
              value={formulaOutputMetric}
              onChange={(e) => setFormulaOutputMetric(e.target.value)}
              placeholder="output metric"
            />
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"
              onClick={handleCreateFormulaDraft}
            >
              Create formula draft
            </button>
            <button
              type="button"
              className="rounded border border-muted px-3 py-1.5 text-xs"
              onClick={handleUpdateFormulaDraft}
              disabled={!selectedFormulaId}
            >
              Update selected draft
            </button>
          </div>

          <div className="mt-4 max-h-56 space-y-2 overflow-auto">
            {formulaVersions.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedFormulaId(row.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  selectedFormulaId === row.id ? 'border-emerald-500 bg-emerald-50' : 'border-muted bg-white'
                }`}
              >
                <p className="font-medium text-gray-900">{row.formula_key}</p>
                <p className="text-xs text-gray-600">
                  {row.assessment_type} · v{row.version} · {row.status}
                </p>
              </button>
            ))}
          </div>

          {formulaDetail && (
            <div className="mt-5 space-y-3 rounded-lg border border-muted bg-gray-50 p-3">
              <p className="text-sm font-medium text-gray-900">
                Selected: {formulaDetail.formula_key} (v{formulaDetail.version}) [{formulaDetail.status}]
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border border-gray-400 px-3 py-1 text-xs"
                  onClick={handleFormulaPreflight}
                >
                  Run preflight
                </button>
                <button
                  type="button"
                  className="rounded border border-blue-500 px-3 py-1 text-xs text-blue-700"
                  onClick={() => handleFormulaTransition('review')}
                >
                  Review
                </button>
                <button
                  type="button"
                  className="rounded border border-indigo-500 px-3 py-1 text-xs text-indigo-700"
                  onClick={() => handleFormulaTransition('approve')}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="rounded border border-emerald-600 px-3 py-1 text-xs text-emerald-700"
                  onClick={() => handleFormulaTransition('publish')}
                >
                  Publish
                </button>
              </div>

              <div className="space-y-2">
                <textarea
                  className="w-full rounded border border-muted px-2 py-1 text-xs"
                  value={simulateInput}
                  onChange={(e) => setSimulateInput(e.target.value)}
                  rows={2}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded border border-muted px-3 py-1 text-xs"
                    onClick={handleFormulaSimulation}
                  >
                    Simulate
                  </button>
                  {simulateResult !== null && <p className="text-xs text-gray-700">Result: {simulateResult}</p>}
                </div>
              </div>

              {formulaPreflight && (
                <div className="rounded border border-muted bg-white p-2 text-xs">
                  <p>
                    Ready: {formulaPreflight.ready_to_publish ? 'yes' : 'no'} · Blocking:{' '}
                    {formulaPreflight.blocking_issue_count} · Warnings: {formulaPreflight.warning_count}
                  </p>
                  {formulaPreflight.issues.map((issue) => (
                    <p key={`${issue.code}-${issue.path}`} className="mt-1 text-gray-700">
                      [{issue.blocking ? 'BLOCK' : 'WARN'}] {issue.code}: {issue.message}
                    </p>
                  ))}
                </div>
              )}

              <div className="rounded border border-muted bg-white p-2 text-xs">
                <p className="font-medium text-gray-700">Formula audit</p>
                <button
                  type="button"
                  className="mt-1 rounded border border-muted px-2 py-1"
                  onClick={() => handleLoadAudit(formulaDetail.id)}
                >
                  Load formula audit
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-muted bg-white p-4 text-xs shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Audit timeline</h3>
          <button
            type="button"
            className="rounded border border-muted px-2 py-1"
            onClick={() => handleLoadAudit(null)}
          >
            Load latest global audit
          </button>
        </div>
        {auditEntries.length === 0 ? (
          <p className="mt-2 text-gray-500">No audit entries loaded.</p>
        ) : (
          <div className="mt-2 max-h-52 space-y-1 overflow-auto">
            {auditEntries.map((entry) => (
              <div key={entry.id} className="rounded border border-muted px-2 py-1">
                <p>
                  {entry.entity_type} · {entry.action} · {entry.actor ?? 'unknown'} ·{' '}
                  {new Date(entry.created_at).toLocaleString()}
                </p>
                <p className="text-gray-600">
                  {entry.from_status ?? 'none'} → {entry.to_status ?? 'none'}
                  {entry.note ? ` · ${entry.note}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
