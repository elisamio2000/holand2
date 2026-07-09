// ============================================
// AssessmentFunnelDashboard — visualizes the completion funnel & drop-off rates
// ============================================

'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useFunnelSummary } from './use-funnel-summary';

export function AssessmentFunnelDashboard() {
  const { t } = useTranslation();
  const { summary, isLoading, error } = useFunnelSummary();

  return (
    <main className="mx-auto w-full max-w-6xl p-6 sm:p-8 lg:p-10">
      <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t('analyticsDashboard.title')}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">{t('analyticsDashboard.subtitle')}</p>

      {isLoading && <p className="mt-6 text-sm text-gray-500">…</p>}
      {error && (
        <p role="alert" className="mt-6 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {summary && (
        <>
          <p className="mt-6 text-sm font-medium text-gray-700">
            {t('analyticsDashboard.totalSessions')}: <span className="font-semibold">{summary.total_sessions}</span>
          </p>

          {summary.total_sessions === 0 ? (
            <p className="mt-4 text-sm text-gray-500">{t('analyticsDashboard.empty')}</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-muted bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead>
                  <tr className="text-start text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">{t('analyticsDashboard.step')}</th>
                    <th className="px-4 py-3">{t('analyticsDashboard.eventCount')}</th>
                    <th className="px-4 py-3">{t('analyticsDashboard.uniqueSessions')}</th>
                    <th className="px-4 py-3">{t('analyticsDashboard.avgDuration')}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.steps.map((step) => (
                    <tr key={step.step} data-testid="funnel-step-row" className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {t(`analyticsDashboard.steps.${step.step}`, step.step)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{step.event_count}</td>
                      <td className="px-4 py-3 text-gray-600">{step.unique_sessions}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {step.avg_duration_ms != null ? Math.round(step.avg_duration_ms) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {Object.keys(summary.drop_off_rate).length > 0 && (
            <section className="mt-6 grid gap-3 sm:grid-cols-3">
              {Object.entries(summary.drop_off_rate).map(([transition, rate]) => (
                <article key={transition} className="rounded-xl border border-muted bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500">{transition}</p>
                  <p className="mt-1 text-lg font-bold text-gray-900">{rate}%</p>
                  <p className="text-xs text-gray-500">{t('analyticsDashboard.dropOff')}</p>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
