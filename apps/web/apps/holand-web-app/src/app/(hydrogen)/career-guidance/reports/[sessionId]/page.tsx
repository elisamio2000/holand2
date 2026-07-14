// ============================================
// Full Report Page — button-triggered AI analysis, i18n, confirmation dialog
// ============================================

'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Text, Title } from 'rizzui';
import { PiSparkle, PiArrowsClockwise } from 'react-icons/pi';
import WidgetCard from '@core/components/cards/widget-card';
import { reportService, type GeneratedReportResponse } from '@/services/report.service';
import { analyticsService } from '@/services/analytics.service';
import { gatewayClient } from '@/lib/api-client';
import ReportMarkdown from './report-markdown';

const safeList = (items?: string[]) => (items && items.length ? items : ['—']);

function safeStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object') {
    const o = val as Record<string, unknown>;
    const text = o.description ?? o.name ?? o.title ?? o.text ?? o.value;
    if (typeof text === 'string') return text;
    return JSON.stringify(val);
  }
  return String(val);
}

function extractAiSections(sections: AiReportSections): AiReportSections {
  if (!sections.raw_text || sections.personality_description) return sections;
  try {
    const match = sections.raw_text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as AiReportSections;
  } catch { /* fall through */ }
  return sections;
}

interface AiReportSections {
  personality_description?: string;
  strengths?: unknown[];
  challenges?: unknown[];
  recommended_jobs?: unknown[];
  recommended_majors?: unknown[];
  action_plan?: { '3_months'?: unknown[]; '6_months'?: unknown[]; '12_months'?: unknown[] };
  raw_text?: string;
}

interface AiReportResponse {
  id: number;
  parsed_sections: AiReportSections;
  model_name?: string;
  generation_time_ms?: number;
  status: string;
}

export default function FullReportPage() {
  const { t } = useTranslation();
  const params = useParams<{ sessionId: string }>();
  const reportRef = params.sessionId;
  const aiSectionRef = useRef<HTMLDivElement>(null);
  const [report, setReport] = useState<GeneratedReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [aiSections, setAiSections] = useState<AiReportSections | null>(null);
  const [aiMeta, setAiMeta] = useState<{ model_name?: string; generation_time_ms?: number } | null>(null);
  const [aiVisible, setAiVisible] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    reportService
      .getGeneratedReportById(reportRef)
      .catch(() => reportService.getGeneratedReport(reportRef))
      .then((data) => { if (!cancelled) setReport(data); })
      .catch(() => { if (!cancelled) setError(t('reportPage.fetchError')); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [reportRef, t]);

  useEffect(() => {
    analyticsService.trackEvent({ session_id: reportRef, event_name: 'report_opened', step: 'report_opened' }).catch(() => undefined);
  }, [reportRef]);

  useEffect(() => {
    if (!report) return;
    Promise.allSettled([
      analyticsService.trackEvent({ session_id: reportRef, event_name: 'report_interpretation_viewed', step: 'report_interpretation_viewed' }),
      analyticsService.trackEvent({ session_id: reportRef, event_name: 'report_action_plan_viewed', step: 'report_action_plan_viewed' }),
      analyticsService.trackEvent({ session_id: reportRef, event_name: 'report_recommendations_viewed', step: 'report_recommendations_viewed' }),
    ]).catch(() => undefined);
  }, [reportRef, report]);

  async function handleExport() {
    if (!report?.id) return;
    setIsExporting(true); setExportError(null);
    try {
      let blob: Blob; let ext = 'pdf';
      try { blob = await reportService.exportReport(report.id, 'pdf'); }
      catch { blob = await reportService.exportReport(report.id, 'html'); ext = 'html'; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `holand-report-${report.id}.${ext}`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch { setExportError(t('reportPage.exportError')); }
    finally { setIsExporting(false); }
  }

  function applyAiResponse(data: AiReportResponse) {
    setAiSections(extractAiSections(data.parsed_sections ?? {}));
    setAiMeta({ model_name: data.model_name, generation_time_ms: data.generation_time_ms });
    setAiVisible(true);
    setTimeout(() => aiSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
  }

  async function fetchExistingAiReport(): Promise<AiReportResponse | null> {
    try { const res = await gatewayClient.get<AiReportResponse>(`/sessions/${reportRef}/ai-report`); return res.data; }
    catch { return null; }
  }

  async function generateNewAiReport() {
    setIsGeneratingAi(true); setAiError(null);
    try {
      await gatewayClient.post(`/admin/llm/sessions/${reportRef}/generate-ai-report`, {});
      const fresh = await fetchExistingAiReport();
      if (fresh) applyAiResponse(fresh); else setAiError(t('reportPage.aiError'));
    } catch { setAiError(t('reportPage.aiError')); }
    finally { setIsGeneratingAi(false); setShowReplaceConfirm(false); }
  }

  async function handleRequestAiAnalysis() {
    setAiError(null);
    if (aiVisible && aiSections) { setShowReplaceConfirm(true); return; }
    setIsGeneratingAi(true);
    const existing = await fetchExistingAiReport();
    if (existing && existing.status === 'completed') { applyAiResponse(existing); setIsGeneratingAi(false); }
    else await generateNewAiReport();
  }

  function renderStrList(items: unknown[], colorClass: string, prefix: string) {
    return (
      <ul className="mt-3 space-y-2">
        {items.map((s, i) => (
          <li key={i} className={`rounded-lg px-3 py-2 text-sm ${colorClass}`}>{prefix} {safeStr(s)}</li>
        ))}
      </ul>
    );
  }

  if (isLoading) return <main className="mx-auto w-full max-w-5xl p-6 sm:p-8 lg:p-10"><Text className="text-sm text-gray-500">{t('reportPage.loading')}</Text></main>;
  if (error || !report) return <main className="mx-auto w-full max-w-5xl p-6 sm:p-8 lg:p-10"><Text className="text-sm text-red-600">{error ?? t('reportPage.notFound')}</Text></main>;

  return (
    <main className="mx-auto w-full max-w-5xl p-6 sm:p-8 lg:p-10">
      <Title as="h1" className="text-2xl font-bold text-gray-900 sm:text-3xl">{t('reportPage.title')}</Title>
      <Text className="mt-3 text-sm leading-7 text-gray-600">{report.summary_card.headline_fa}</Text>
      <div className="mt-3 flex flex-wrap gap-3">
        <Badge variant="flat" color="success" className="px-4 py-2 text-sm">{t('reportPage.hollandCode')}: {report.holland_code}</Badge>
        <Badge variant="flat" color="info" className="px-4 py-2 text-sm">{t('reportPage.mbtiType')}: {report.mbti_type}</Badge>
        <Badge variant="flat" color="secondary" className="px-4 py-2 text-sm">{t('reportPage.ageBand')}: {report.age_band}</Badge>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" variant="outline" isLoading={isExporting} onClick={handleExport}>{t('reportPage.exportButton')}</Button>
        {exportError && <Text className="text-xs text-red-600">{exportError}</Text>}
      </div>

      <section className="mt-8 grid gap-6 sm:grid-cols-2">
        <WidgetCard title={t('reportPage.careersSummary')}>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-gray-700">
            {safeList(report.summary_card.top_careers_fa).map((item, idx) => (
              <li key={idx} className="rounded-lg bg-emerald-50 px-4 py-3">{item}</li>
            ))}
          </ul>
        </WidgetCard>
        <WidgetCard title={t('reportPage.majorsSummary')}>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-gray-700">
            {safeList(report.summary_card.top_majors_fa).map((item, idx) => (
              <li key={idx} className="rounded-lg bg-indigo-50 px-4 py-3">{item}</li>
            ))}
          </ul>
        </WidgetCard>
      </section>

      <section className="mt-8 grid gap-6 sm:grid-cols-2">
        <WidgetCard title={t('reportPage.psychometric')}>
          <ReportMarkdown content={report.detailed_interpretation.psychometric_fa || '—'} />
        </WidgetCard>
        <WidgetCard title={t('reportPage.behavioralFit')}>
          <ReportMarkdown content={report.detailed_interpretation.behavioral_fit_fa || '—'} />
        </WidgetCard>
      </section>

      <section className="mt-8 grid gap-6 sm:grid-cols-2">
        <WidgetCard title={t('reportPage.careerMajorAnalysis')}>
          <ReportMarkdown content={report.detailed_interpretation.career_major_fa || '—'} />
        </WidgetCard>
        <WidgetCard title={t('reportPage.skillGrowth')}>
          <ReportMarkdown content={report.detailed_interpretation.skill_growth_fa || '—'} />
        </WidgetCard>
      </section>

      <section className="mt-8 grid gap-6 sm:grid-cols-2">
        <WidgetCard title={t('reportPage.careerRecommendations')}>
          <ul className="mt-4 space-y-3">
            {report.recommendations.careers.length > 0
              ? report.recommendations.careers.map((item) => (
                  <li key={item.title_fa} className="rounded-lg border border-muted p-4">
                    <div className="flex items-center justify-between">
                      <Text className="font-semibold text-gray-900">{item.title_fa}</Text>
                      <Text className="text-xs font-semibold text-emerald-700">{Math.round(item.fit_score)}٪ {t('reportPage.fitScore')}</Text>
                    </div>
                    <Text className="mt-1 text-xs leading-5 text-gray-500">{item.why_fa}</Text>
                  </li>
                ))
              : <li className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-500">{t('reportPage.noItems')}</li>}
          </ul>
        </WidgetCard>
        <WidgetCard title={t('reportPage.majorRecommendations')}>
          <ul className="mt-4 space-y-3">
            {report.recommendations.majors.length > 0
              ? report.recommendations.majors.map((item) => (
                  <li key={item.title_fa} className="rounded-lg border border-muted p-4">
                    <div className="flex items-center justify-between">
                      <Text className="font-semibold text-gray-900">{item.title_fa}</Text>
                      <Text className="text-xs font-semibold text-indigo-700">{Math.round(item.fit_score)}٪ {t('reportPage.fitScore')}</Text>
                    </div>
                    <Text className="mt-1 text-xs leading-5 text-gray-500">{item.why_fa}</Text>
                  </li>
                ))
              : <li className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-500">{t('reportPage.noItems')}</li>}
          </ul>
        </WidgetCard>
      </section>

      <section className="mt-8">
        <WidgetCard title={t('reportPage.actionPlan')}>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              { label: t('reportPage.actionPlan3m'), items: report.action_plan.short_term_3_months_fa, key: 'st' },
              { label: t('reportPage.actionPlan6m'), items: report.action_plan.mid_term_6_months_fa, key: 'mt' },
              { label: t('reportPage.actionPlan12m'), items: report.action_plan.long_term_12_months_fa, key: 'lt' },
            ].map(({ label, items, key }) => (
              <div key={key} className="rounded-xl border border-muted p-4">
                <Text className="text-xs font-semibold text-emerald-700">{label}</Text>
                <ul className="mt-2 space-y-2 text-xs leading-5 text-gray-600">
                  {safeList(items).map((item, idx) => <li key={`${key};-${idx}`}>{item}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </WidgetCard>
      </section>

      <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
        <ul className="space-y-2 text-xs leading-6 text-amber-800">
          {safeList(report.risk_flags).map((flag, idx) => <li key={`risk-${idx}`}>⚠️ {flag}</li>)}
        </ul>
      </section>

      <section className="mt-4 rounded-xl border border-muted bg-white p-5">
        <Text className="text-xs leading-6 text-gray-700">
          {t('reportPage.confidenceScore')}: <span className="font-semibold">{Math.round(report.confidence_score)}٪</span>
        </Text>
      </section>

      {/* ── AI Analysis Trigger ─────────────────────────────────── */}
      <section className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
          <PiSparkle className="h-6 w-6 text-violet-600" />
        </div>
        <div>
          <Title as="h3" className="text-base font-bold text-gray-900">{t('reportPage.aiAnalysisTitle')}</Title>
          <Text className="mt-1 text-sm text-gray-500">
            {aiVisible ? t('reportPage.aiRegenerateButton') : 'تحلیل عمیق‌تر نقاط قوت، چالش‌ها و مسیرهای شغلی با هوش مصنوعی'}
          </Text>
        </div>
        {showReplaceConfirm ? (
          <div className="w-full max-w-sm rounded-xl border border-violet-300 bg-white p-5 shadow-sm">
            <Text className="mb-4 text-sm text-gray-700">{t('reportPage.aiReplaceConfirm')}</Text>
            <div className="flex justify-center gap-3">
              <Button size="sm" onClick={generateNewAiReport} isLoading={isGeneratingAi}>{t('reportPage.aiConfirmYes')}</Button>
              <Button size="sm" variant="outline" onClick={async () => { setShowReplaceConfirm(false); const e = await fetchExistingAiReport(); if (e) applyAiResponse(e); }}>{t('reportPage.aiConfirmNo')}</Button>
            </div>
          </div>
        ) : (
          <Button onClick={handleRequestAiAnalysis} isLoading={isGeneratingAi} className="min-w-[220px]">
            {isGeneratingAi ? t('reportPage.aiGenerating') : aiVisible
              ? <><PiArrowsClockwise className="me-2 h-4 w-4 inline" />{t('reportPage.aiRegenerateButton')}</>
              : <><PiSparkle className="me-2 h-4 w-4 inline" />{t('reportPage.aiGenerateButton')}</>}
          </Button>
        )}
        {aiError && <Text className="text-xs text-red-600">{aiError}</Text>}
      </section>

      {/* ── AI Analysis Results ─────────────────────────────────── */}
      {aiVisible && aiSections && (
        <section ref={aiSectionRef} className="mt-8 scroll-mt-8">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Title as="h2" className="text-xl font-bold text-gray-900">{t('reportPage.aiAnalysisTitle')}</Title>
            <Badge color="success" variant="flat" className="text-xs">{t('reportPage.aiGeneratedBadge')}</Badge>
            {aiMeta?.model_name && <Text className="text-xs text-gray-400">{t('reportPage.aiModelLabel')}: {aiMeta.model_name}</Text>}
          </div>

          <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5 space-y-6">
            {aiSections.personality_description && (
              <WidgetCard title={t('reportPage.aiPersonalityDesc')}>
                <Text className="mt-3 text-sm leading-7 text-gray-700">{safeStr(aiSections.personality_description)}</Text>
              </WidgetCard>
            )}
            {aiSections.raw_text && !aiSections.personality_description && (
              <WidgetCard title={t('reportPage.aiRawOutput')}>
                <Text className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">{aiSections.raw_text}</Text>
              </WidgetCard>
            )}
            {((aiSections.strengths?.length ?? 0) > 0 || (aiSections.challenges?.length ?? 0) > 0) && (
              <div className="grid gap-5 sm:grid-cols-2">
                {(aiSections.strengths?.length ?? 0) > 0 && (
                  <WidgetCard title={t('reportPage.aiStrengths')}>
                    {renderStrList(aiSections.strengths!, 'bg-green-50 text-green-800', '✓')}
                  </WidgetCard>
                )}
                {(aiSections.challenges?.length ?? 0) > 0 && (
                  <WidgetCard title={t('reportPage.aiChallenges')}>
                    {renderStrList(aiSections.challenges!, 'bg-orange-50 text-orange-800', '△')}
                  </WidgetCard>
                )}
              </div>
            )}
            {(aiSections.recommended_jobs?.length ?? 0) > 0 && (
              <WidgetCard title={t('reportPage.aiJobs')}>
                <div className="mt-3 flex flex-wrap gap-2">
                  {aiSections.recommended_jobs!.map((job, i) => {
                    const o = job as Record<string, unknown>;
                    return (
                      <div key={i} className="flex items-center gap-2 rounded-full border border-violet-200 bg-white px-4 py-2">
                        <Text className="text-sm font-medium text-gray-800">{safeStr(o.title ?? o.name ?? job)}</Text>
                        {typeof o.fit_score === 'number' && o.fit_score > 0 && (
                          <Badge color="success" variant="flat" className="text-xs">{o.fit_score}٪</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </WidgetCard>
            )}
            {(aiSections.recommended_majors?.length ?? 0) > 0 && (
              <WidgetCard title={t('reportPage.aiMajors')}>
                <div className="mt-3 flex flex-wrap gap-2">
                  {aiSections.recommended_majors!.map((major, i) => {
                    const o = major as Record<string, unknown>;
                    return (
                      <div key={i} className="rounded-full border border-violet-200 bg-white px-4 py-2">
                        <Text className="text-sm font-medium text-gray-800">{safeStr(o.title ?? o.name ?? major)}</Text>
                      </div>
                    );
                  })}
                </div>
              </WidgetCard>
            )}
            {aiSections.action_plan && (
              <WidgetCard title={t('reportPage.aiActionPlan')}>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  {([['3_months', t('reportPage.actionPlan3m')], ['6_months', t('reportPage.actionPlan6m')], ['12_months', t('reportPage.actionPlan12m')]] as const).map(([key, label]) => {
                    const items = aiSections.action_plan![key];
                    if (!items?.length) return null;
                    return (
                      <div key={key} className="rounded-xl border border-violet-100 p-3">
                        <Text className="text-xs font-semibold text-violet-700">{label}</Text>
                        <ul className="mt-2 space-y-1 text-xs text-gray-600">
                          {items.map((item, i) => <li key={i}>• {safeStr(item)}</li>)}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </WidgetCard>
            )}
            <p className="text-xs text-violet-600">{t('reportPage.aiDisclaimer')}</p>
          </div>
        </section>
      )}
    </main>
  );
}