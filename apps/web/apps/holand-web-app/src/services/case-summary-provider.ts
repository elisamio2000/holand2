// AI Summary: try BR-5 API first, then derive from import detail

import { isAxiosError } from 'axios';
import { gatewayClient } from '@/lib/api-client';
import type { CaseDetail } from '@/types/case-importer.types';

export type CaseSummarySource = 'api' | 'derived' | 'empty';

export interface CaseSummaryData {
  source: CaseSummarySource;
  executive_summary: string;
  key_findings: string[];
  entities: {
    persons: string[];
    organizations: string[];
    locations: string[];
  };
  generated_at?: number;
  confidence?: number;
}

function extractStringsFromUnknown(value: unknown, limit = 12): string[] {
  if (!value) return [];
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  if (Array.isArray(value)) {
    return value
      .flatMap((v) => extractStringsFromUnknown(v, 1))
      .filter(Boolean)
      .slice(0, limit);
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const parts: string[] = [];
    for (const k of ['name', 'label', 'value', 'text', 'title']) {
      if (typeof o[k] === 'string' && (o[k] as string).trim()) {
        parts.push((o[k] as string).trim());
      }
    }
    return parts.slice(0, limit);
  }
  return [];
}

/** Build summary from real import detail (tools, files, logs). */
export function deriveCaseSummaryFromDetail(detail: CaseDetail | null): CaseSummaryData {
  if (!detail) {
    return {
      source: 'empty',
      executive_summary: '',
      key_findings: [],
      entities: { persons: [], organizations: [], locations: [] },
    };
  }

  const files = Array.isArray(detail.files) ? detail.files : [];
  const toolIds = new Set<string>();
  const kinds = new Map<string, number>();
  let errorFiles = 0;

  for (const f of files) {
    const kind = (f.kind || f.media_type || 'other').toString();
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    if (Array.isArray(f.errors) && f.errors.length > 0) errorFiles += 1;
    if (Array.isArray(f.tools)) {
      for (const tr of f.tools) {
        if (tr.tool_id) toolIds.add(tr.tool_id);
      }
    }
  }

  const status = detail.status ?? 'unknown';
  const progressPct = Math.round((detail.progress ?? 0) * 100);
  const executive_summary = [
    `Case "${detail.case_name}" (${detail.case_id}) is ${status} with ${progressPct}% progress.`,
    `${detail.files_done ?? 0} of ${detail.files_total ?? files.length} files processed.`,
    toolIds.size > 0
      ? `Analysis tools used: ${Array.from(toolIds).slice(0, 6).join(', ')}${toolIds.size > 6 ? '…' : ''}.`
      : 'No tool runs recorded on files yet.',
    detail.error
      ? `Last error: ${detail.error}`
      : errorFiles > 0
        ? `${errorFiles} file(s) reported errors.`
        : '',
  ]
    .filter(Boolean)
    .join(' ');

  const key_findings: string[] = [];
  if (kinds.size > 0) {
    key_findings.push(
      `File mix: ${Array.from(kinds.entries())
        .map(([k, n]) => `${k} (${n})`)
        .join(', ')}`
    );
  }
  if (detail.qdrant_vectors_count && detail.qdrant_vectors_count > 0) {
    key_findings.push(`${detail.qdrant_vectors_count} vectors indexed.`);
  }
  const logs = Array.isArray(detail.logs) ? detail.logs : [];
  const lastLog = logs[logs.length - 1];
  if (lastLog && typeof lastLog === 'object' && 'message' in lastLog) {
    key_findings.push(String((lastLog as { message: unknown }).message).slice(0, 200));
  }

  const persons = new Set<string>();
  const orgs = new Set<string>();
  const locations = new Set<string>();

  for (const f of files) {
    if (!Array.isArray(f.tools)) continue;
    for (const tr of f.tools) {
      const out = tr.result;
      extractStringsFromUnknown(out, 3).forEach((s) => {
        if (/person|name|contact/i.test(tr.tool_id ?? '')) persons.add(s);
        else if (/org|company/i.test(tr.tool_id ?? '')) orgs.add(s);
        else if (/geo|location|place/i.test(tr.tool_id ?? '')) locations.add(s);
      });
    }
  }

  return {
    source: 'derived',
    executive_summary,
    key_findings: key_findings.slice(0, 8),
    entities: {
      persons: Array.from(persons).slice(0, 8),
      organizations: Array.from(orgs).slice(0, 8),
      locations: Array.from(locations).slice(0, 8),
    },
    generated_at: detail.updated_at ? detail.updated_at * 1000 : Date.now(),
    confidence: detail.status === 'completed' ? 0.75 : 0.5,
  };
}

async function fetchApiSummary(caseId: string): Promise<CaseSummaryData | null> {
  const paths = [
    `/import/${encodeURIComponent(caseId)}/ai-summary`,
    `/cases/${encodeURIComponent(caseId)}/summary`,
  ];
  for (const path of paths) {
    try {
      const res = await gatewayClient.get(path);
      const d = res.data as Record<string, unknown>;
      if (!d || typeof d !== 'object') continue;
      return {
        source: 'api',
        executive_summary: String(d.executive_summary ?? d.summary ?? ''),
        key_findings: Array.isArray(d.key_findings)
          ? (d.key_findings as string[])
          : [],
        entities: {
          persons: Array.isArray((d.entities as Record<string, unknown>)?.persons)
            ? ((d.entities as { persons: string[] }).persons)
            : [],
          organizations: Array.isArray(
            (d.entities as Record<string, unknown>)?.organizations
          )
            ? ((d.entities as { organizations: string[] }).organizations)
            : [],
          locations: Array.isArray((d.entities as Record<string, unknown>)?.locations)
            ? ((d.entities as { locations: string[] }).locations)
            : [],
        },
        generated_at:
          typeof d.generated_at === 'number' ? d.generated_at * 1000 : undefined,
        confidence: typeof d.confidence === 'number' ? d.confidence : undefined,
      };
    } catch (err: unknown) {
      if (isAxiosError(err) && err.response?.status === 404) continue;
      if (isAxiosError(err) && err.response?.status === 202) continue;
    }
  }
  return null;
}

export async function loadCaseSummary(
  caseId: string,
  detail: CaseDetail | null
): Promise<CaseSummaryData> {
  const api = await fetchApiSummary(caseId);
  if (api?.executive_summary) return api;
  return deriveCaseSummaryFromDetail(detail);
}
