// ============================================
// One Search — in-page mock repository (sample contract)
// Consumed ONLY by one-search-view.tsx — do not import elsewhere.
// ============================================

import { routes } from '@/config/routes';
import type {
  OneSearchHit,
  OneSearchLaneId,
  OneSearchLaneResult,
  OneSearchMode,
  OneSearchResponse,
} from '@/types/one-search.types';

const MOCK_DELAY_MS_MIN = 380;
const MOCK_DELAY_MS_MAX = 720;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Broad match for the "احمد" scenario + generic queries for layout testing. */
function isAhmadScenario(q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return false;
  return /احمد|ahmad|ahmadi|احمدی/.test(q) || n.includes('ahmad');
}

function lane(
  partial: Omit<OneSearchLaneResult, 'lane'> & { lane: OneSearchLaneResult['lane'] }
): OneSearchLaneResult {
  return {
    lane: partial.lane,
    total: partial.total ?? partial.hits.length,
    hits: partial.hits,
  };
}

/** Duplicate / vary hits so long lists and scroll behaviour can be reviewed in the UI. */
function expandHitsForStressTest(
  base: OneSearchHit[],
  prefix: string,
  targetLen: number
): OneSearchHit[] {
  if (base.length === 0 || base.length >= targetLen) return base;
  const out: OneSearchHit[] = [...base];
  let seq = base.length;
  while (out.length < targetLen) {
    const src = base[out.length % base.length];
    seq += 1;
    out.push({
      ...src,
      id: `${prefix}-synth-${seq}`,
      title: `${src.title} · ${out.length + 1}`,
      score: Math.max(0.12, (src.score ?? 0.55) * 0.965 ** (out.length - base.length + 1)),
      snippet: src.snippet
        ? `${src.snippet} (ردیف نمونهٔ ${out.length + 1} برای تست اسکرول.)`
        : `ردیف نمونهٔ ${out.length + 1} برای تست اسکرول.`,
    });
  }
  return out;
}

function buildRichAhmadResponse(query: string, mode: OneSearchMode): OneSearchResponse {
  const lanes: OneSearchLaneResult[] = [
    lane({
      lane: 'chat',
      total: 25,
      hits: [
        ...Array.from({ length: 25 }, (_, i) => ({
          id: `mock-msg-${i + 1}`,
          title: `چت ${i % 3 === 0 ? 'پرونده' : i % 3 === 1 ? 'تیم' : 'جلسه'} ${i + 1} — ${i % 2 === 0 ? 'بازجویی' : 'تحلیل'}`,
          snippet: `${i % 2 === 0 ? 'طبق صورتجلسه' : 'بررسی اسناد'}, احمد ${i % 3 === 0 ? 'گفته بود' : i % 3 === 1 ? 'تأکید کرد' : 'اشاره کرد'} که ${i % 4 === 0 ? 'فایل اکسل' : i % 4 === 1 ? 'مدارک' : i % 4 === 2 ? 'گزارش' : 'اطلاعات'} را ${i % 2 === 0 ? 'روی درایو' : 'در سیستم'} قرار داده است.`,
          href: routes.aiChat.session(`mock-session-${i + 1}`),
          score: 0.94 - i * 0.02,
          occurredAt: new Date(2026, 4, 2 - Math.floor(i / 3), 14 + i, 22, 0).toISOString(),
          meta: { 
            session_id: `mock-session-${i + 1}`, 
            case_id: i % 2 === 0 ? 'CASE-MOCK-4412' : undefined 
          },
        })),
      ],
    }),
    lane({
      lane: 'cases',
      total: 18,
      hits: [
        ...Array.from({ length: 18 }, (_, i) => ({
          id: `mock-case-${i + 1}`,
          title: `پرونده MOCK-${4412 + i * 100} — ${i % 3 === 0 ? 'اختلاس' : i % 3 === 1 ? 'کلاهبرداری' : 'تخلف مالی'} ${i % 2 === 0 ? 'منطقه ' + (i % 5 + 1) : 'بخش ' + (i % 4 + 1)}`,
          snippet: `${i === 0 ? 'نام مظنون اصلی: احمد کریمی؛ نام مستعار در اسناد: Ahmad Karimi.' : `پرونده شماره ${i + 1} مرتبط با ${i % 2 === 0 ? 'احمد' : 'Ahmad'} - ${i % 3 === 0 ? 'در حال بررسی' : i % 3 === 1 ? 'تحت تحقیق' : 'در انتظار تصمیم'}`}`,
          href: routes.cases.detail(`CASE-MOCK-${4412 + i * 100}`),
          score: 0.97 - i * 0.03,
          occurredAt: new Date(2026, 2, 15 - i * 2, 0, 0, 0).toISOString(),
          meta: { 
            case_id: `CASE-MOCK-${4412 + i * 100}`, 
            status: i % 3 === 0 ? 'active' : i % 3 === 1 ? 'pending' : 'closed' 
          },
        })),
      ],
    }),
    lane({
      lane: 'files',
      total: 30,
      hits: [
        ...Array.from({ length: 30 }, (_, i) => ({
          id: `mock-file-${i + 1}`,
          title: `${i % 4 === 0 ? 'report' : i % 4 === 1 ? 'document' : i % 4 === 2 ? 'contract' : 'invoice'}_ahmad_${i % 3 === 0 ? 'draft' : i % 3 === 1 ? 'final' : 'v' + (i % 5 + 1)}.${i % 5 === 0 ? 'pdf' : i % 5 === 1 ? 'docx' : i % 5 === 2 ? 'xlsx' : i % 5 === 3 ? 'txt' : 'pptx'}`,
          snippet: `${i % 2 === 0 ? 'صفحه' : 'بخش'} ${i % 10 + 1}: «احمد» ${i % 3 === 0 ? 'به عنوان امضاکننده' : i % 3 === 1 ? 'در لیست مسئولین' : 'در جدول اطلاعات'} ${i % 2 === 0 ? 'ذکر شده است' : 'قید شده'}.`,
          href: `${routes.fileExplorer}?search=ahmad&file=${i + 1}`,
          score: 0.88 - i * 0.015,
          occurredAt: new Date(2026, 3, 30 - Math.floor(i / 2), 11 + i, 0, 0).toISOString(),
          meta: { 
            mime: i % 5 === 0 ? 'application/pdf' : i % 5 === 1 ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : i % 5 === 2 ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : i % 5 === 3 ? 'text/plain' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            path: '/cases/4412/docs/' 
          },
        })),
      ],
    }),
    lane({
      lane: 'storage',
      total: 50,
      hits: [
        // Images (20 items with varied dimensions and orientations)
        // Portrait images (عمودی)
        {
          id: 'mock-img-1',
          title: 'passport_photo_ahmad.jpg',
          snippet: 'عکس پاسپورت احمد کریمی - تصویر عمودی',
          href: routes.storage,
          score: 0.95,
          occurredAt: new Date(2026, 3, 20, 8, 0, 0).toISOString(),
          meta: {
            artifact_id: 'art-img-1',
            mime: 'image/jpeg',
            thumb_url: '/logo.png',
            url: '/logo.png',
            width: 800,
            height: 1200,
            size_bytes: 1800000,
          },
        },
        {
          id: 'mock-img-2',
          title: 'id_card_scan_ahmad.png',
          snippet: 'اسکن کارت شناسایی - تصویر عمودی',
          href: routes.storage,
          score: 0.93,
          occurredAt: new Date(2026, 3, 19, 9, 0, 0).toISOString(),
          meta: {
            artifact_id: 'art-img-2',
            mime: 'image/png',
            thumb_url: '/logo.png',
            url: '/logo.png',
            width: 900,
            height: 1350,
            size_bytes: 2200000,
          },
        },
        {
          id: 'mock-img-3',
          title: 'portrait_ahmad_office.jpg',
          snippet: 'عکس پرتره احمد در دفتر',
          href: routes.storage,
          score: 0.91,
          occurredAt: new Date(2026, 3, 18, 10, 0, 0).toISOString(),
          meta: {
            artifact_id: 'art-img-3',
            mime: 'image/jpeg',
            thumb_url: '/logo.png',
            url: '/logo.png',
            width: 720,
            height: 1280,
            size_bytes: 1900000,
          },
        },
        // Landscape images (افقی)
        {
          id: 'mock-img-4',
          title: 'meeting_room_ahmad.jpg',
          snippet: 'تصویر اتاق جلسه - تصویر افقی',
          href: routes.storage,
          score: 0.89,
          occurredAt: new Date(2026, 3, 17, 11, 0, 0).toISOString(),
          meta: {
            artifact_id: 'art-img-4',
            mime: 'image/jpeg',
            thumb_url: '/logo.png',
            url: '/logo.png',
            width: 1920,
            height: 1080,
            size_bytes: 2500000,
          },
        },
        {
          id: 'mock-img-5',
          title: 'office_panorama.png',
          snippet: 'پانورامای دفتر کار احمد',
          href: routes.storage,
          score: 0.87,
          occurredAt: new Date(2026, 3, 16, 12, 0, 0).toISOString(),
          meta: {
            artifact_id: 'art-img-5',
            mime: 'image/png',
            thumb_url: '/logo.png',
            url: '/logo.png',
            width: 2400,
            height: 1200,
            size_bytes: 3200000,
          },
        },
        {
          id: 'mock-img-6',
          title: 'document_wide_scan.jpg',
          snippet: 'اسکن سند عریض',
          href: routes.storage,
          score: 0.85,
          occurredAt: new Date(2026, 3, 15, 13, 0, 0).toISOString(),
          meta: {
            artifact_id: 'art-img-6',
            mime: 'image/jpeg',
            thumb_url: '/logo.png',
            url: '/logo.png',
            width: 1800,
            height: 1200,
            size_bytes: 2100000,
          },
        },
        // Square images (مربع)
        {
          id: 'mock-img-7',
          title: 'profile_ahmad_square.jpg',
          snippet: 'عکس پروفایل مربعی احمد',
          href: routes.storage,
          score: 0.83,
          occurredAt: new Date(2026, 3, 14, 14, 0, 0).toISOString(),
          meta: {
            artifact_id: 'art-img-7',
            mime: 'image/jpeg',
            thumb_url: '/logo.png',
            url: '/logo.png',
            width: 1200,
            height: 1200,
            size_bytes: 1700000,
          },
        },
        {
          id: 'mock-img-8',
          title: 'logo_company_square.png',
          snippet: 'لوگوی مربعی شرکت',
          href: routes.storage,
          score: 0.81,
          occurredAt: new Date(2026, 3, 13, 15, 0, 0).toISOString(),
          meta: {
            artifact_id: 'art-img-8',
            mime: 'image/png',
            thumb_url: '/logo.png',
            url: '/logo.png',
            width: 1000,
            height: 1000,
            size_bytes: 1500000,
          },
        },
        // Very tall portrait (خیلی عمودی)
        {
          id: 'mock-img-9',
          title: 'full_body_photo.jpg',
          snippet: 'عکس تمام قد - تصویر بسیار عمودی',
          href: routes.storage,
          score: 0.79,
          occurredAt: new Date(2026, 3, 12, 16, 0, 0).toISOString(),
          meta: {
            artifact_id: 'art-img-9',
            mime: 'image/jpeg',
            thumb_url: '/logo.png',
            url: '/logo.png',
            width: 600,
            height: 1800,
            size_bytes: 1600000,
          },
        },
        // Very wide landscape (خیلی افقی)
        {
          id: 'mock-img-10',
          title: 'banner_wide.png',
          snippet: 'بنر عریض - تصویر بسیار افقی',
          href: routes.storage,
          score: 0.77,
          occurredAt: new Date(2026, 3, 11, 17, 0, 0).toISOString(),
          meta: {
            artifact_id: 'art-img-10',
            mime: 'image/png',
            thumb_url: '/logo.png',
            url: '/logo.png',
            width: 2560,
            height: 1024,
            size_bytes: 2800000,
          },
        },
        // More varied sizes
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `mock-img-${11 + i}`,
          title: `photo_ahmad_${11 + i}.${i % 2 === 0 ? 'jpg' : 'png'}`,
          snippet: `تصویر ${11 + i} - ${i % 3 === 0 ? 'عمودی' : i % 3 === 1 ? 'افقی' : 'مربع'}`,
          href: routes.storage,
          score: 0.75 - i * 0.02,
          occurredAt: new Date(2026, 3, 10 - i, 8 + i, 0, 0).toISOString(),
          meta: {
            artifact_id: `art-img-${11 + i}`,
            mime: i % 2 === 0 ? 'image/jpeg' : 'image/png',
            thumb_url: `/logo.png + i}/400/300`,
            url: `/logo.png + i}/${
              i % 3 === 0 ? '800/1200' : i % 3 === 1 ? '1600/900' : '1200/1200'
            }`,
            width: i % 3 === 0 ? 800 : i % 3 === 1 ? 1600 : 1200,
            height: i % 3 === 0 ? 1200 : i % 3 === 1 ? 900 : 1200,
            size_bytes: 1800000 + i * 100000,
          },
        })),
        // Videos (10 items)
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `mock-video-${i + 1}`,
          title: `video_ahmad_${i + 1}.mp4`,
          snippet: `ویدیو ${i + 1} - ${i % 2 === 0 ? 'بازجویی' : 'مستند'} احمد کریمی`,
          href: routes.storage,
          score: 0.88 - i * 0.03,
          occurredAt: new Date(2026, 4, 2 - i, 14 + i, 30, 0).toISOString(),
          meta: {
            artifact_id: `art-video-${i + 1}`,
            mime: 'video/mp4',
            thumb_url: `/logo.png + i}/640/360`,
            url: i === 0 
              ? '/logo.png'
              : i === 1
              ? '/logo.png'
              : i === 2
              ? '/logo.png'
              : '/logo.png',
            width: 1920,
            height: 1080,
            duration: 300 + i * 120,
            size_bytes: 40000000 + i * 5000000,
          },
        })),
        // Audio (15 items)
        ...Array.from({ length: 15 }, (_, i) => ({
          id: `mock-audio-${i + 1}`,
          title: `audio_ahmad_${i + 1}.${i % 2 === 0 ? 'mp3' : 'm4a'}`,
          snippet:
            i % 3 === 0
              ? '... discussed the budget meeting for Q2 in the recording ...'
              : `ضبط صوتی ${i + 1} - ${i % 3 === 0 ? 'تماس تلفنی' : i % 3 === 1 ? 'جلسه' : 'مصاحبه'}`,
          href: routes.storage,
          score: 0.82 - i * 0.02,
          occurredAt: new Date(2026, 3, 20 - i, 16 + i, 45, 0).toISOString(),
          meta: {
            artifact_id: `art-audio-${i + 1}`,
            mime: i % 2 === 0 ? 'audio/mpeg' : 'audio/mp4',
            url: '/test-media/female_02.mp3',
            duration: 600 + i * 60,
            size_bytes: 4000000 + i * 500000,
            has_transcript: i % 2 === 0,
            match: i % 3 === 0 ? 'transcript' : i % 2 === 0 ? 'filename' : 'metadata',
            uploaded_by: i % 4 === 0 ? 'operator-1' : undefined,
            transcript_match:
              i % 3 === 0
                ? {
                    start_sec: 42.1 + i,
                    end_sec: 47.8 + i,
                    text: 'budget meeting for Q2',
                  }
                : undefined,
          },
        })),
        // Documents (10 items)
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `mock-doc-${i + 1}`,
          title: `document_ahmad_${i + 1}.${i % 3 === 0 ? 'pdf' : i % 3 === 1 ? 'docx' : 'txt'}`,
          snippet: `سند ${i + 1} مرتبط با پرونده احمد کریمی`,
          href: routes.storage,
          score: 0.75 - i * 0.02,
          occurredAt: new Date(2026, 3, 15 - i, 10 + i, 0, 0).toISOString(),
          meta: {
            artifact_id: `art-doc-${i + 1}`,
            mime: i % 3 === 0 ? 'application/pdf' : i % 3 === 1 ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain',
            size_bytes: 500000 + i * 100000,
          },
        })),
      ],
    }),
    lane({
      lane: 'users',
      total: 12,
      hits: [
        ...Array.from({ length: 12 }, (_, i) => ({
          id: `mock-user-${i + 1}`,
          title: `کاربر: ${i === 0 ? 'ahmad.karimi' : `user_${i}_ahmad`}`,
          snippet: `نقش: ${i % 3 === 0 ? 'تحلیل‌گر' : i % 3 === 1 ? 'مدیر' : 'کارشناس'} — گروه: ${i % 2 === 0 ? 'تیم شمال' : 'تیم جنوب'} — آخرین ورود: ${new Date(2026, 4, 1 - i).toLocaleDateString('fa-IR')}`,
          href: routes.profile,
          score: 0.86 - i * 0.03,
          meta: {
            user_id: `usr-mock-${i + 1}`,
            aliases: i === 0 ? 'احمد کریمی, Ahmad Karimi' : `User ${i + 1}, Ahmad User`,
            thumb_url: `/logo.png % 2 === 0 ? 'men' : 'women'}/${32 + i}.jpg`,
          },
        })),
      ],
    }),
    lane({
      lane: 'graph',
      total: 20,
      hits: [
        ...Array.from({ length: 20 }, (_, i) => ({
          id: `mock-graph-${i + 1}`,
          title: `گراف: ${i % 4 === 0 ? 'Person' : i % 4 === 1 ? 'Account' : i % 4 === 2 ? 'Transaction' : 'Document'}(ahmad_${i + 1}) — ارتباط با ${i % 3 === 0 ? 'Account' : i % 3 === 1 ? 'Person' : 'Organization'}`,
          snippet: `یال ${i % 3 === 0 ? 'HAS_ALIAS' : i % 3 === 1 ? 'CONNECTED_TO' : 'OWNS'} → «احمد»${i % 2 === 0 ? '، «Ahmad»' : ''}${i % 3 === 0 ? '، «احمد کریمی»' : ''}`,
          href: routes.graphExplorer,
          score: 0.79 - i * 0.02,
          meta: { 
            node_type: i % 4 === 0 ? 'Person' : i % 4 === 1 ? 'Account' : i % 4 === 2 ? 'Transaction' : 'Document',
            edge_count: 14 + i * 2 
          },
        })),
      ],
    }),
    lane({
      lane: 'projects_tasks',
      total: 8,
      hits: [
        {
          id: 'task-mock-001',
          title: 'Operation North Star — Review import checklist',
          snippet: 'Assigned task in proj-mock-001 · due this week · linked case-mock-4412',
          href: routes.projects.task('proj-mock-001', 'task-mock-001'),
          score: 0.72,
          meta: { project_id: 'proj-mock-001', task_id: 'task-mock-001', status: 'in_progress' },
        },
        {
          id: 'task-mock-002',
          title: 'Financial Review — Reconcile transaction graph',
          snippet: 'High priority · proj-mock-002 · analyst assignment',
          href: routes.projects.task('proj-mock-002', 'task-mock-002'),
          score: 0.68,
          meta: { project_id: 'proj-mock-002', priority: 'high' },
        },
        {
          id: 'proj-mock-001',
          title: 'Project: Operation North Star',
          snippet: 'Active project · 12 open tasks · 3 linked cases',
          href: routes.projects.detail('proj-mock-001'),
          score: 0.61,
          meta: { type: 'project', status: 'active' },
        },
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `task-mock-search-${i + 3}`,
          title: `Task sample ${i + 3} — ${query.slice(0, 20) || 'projects'}`,
          snippet: `Mock projects & tasks lane hit for federated search UI testing.`,
          href: routes.projects.myTasksAssigned,
          score: 0.55 - i * 0.04,
          meta: { project_id: 'proj-mock-001' },
        })),
      ],
    }),
  ];

  const filtered =
    mode === 'all'
      ? lanes
      : lanes.map((L) => ({
          ...L,
          hits: L.hits.filter((h) => {
            if (mode === 'text') return true;
            if (mode === 'image')
              return String(h.meta?.mime ?? '').startsWith('image/') || L.lane === 'graph';
            if (mode === 'audio')
              return String(h.meta?.mime ?? '').includes('audio') || String(h.title).includes('voice');
            if (mode === 'file') return L.lane === 'files' || L.lane === 'storage';
            return true;
          }),
        }));

  const totalHits = filtered.reduce((sum, L) => sum + L.hits.length, 0);

  return {
    query,
    mode,
    tookMs: 514,
    total: totalHits,
    lanes: filtered.map((L) => ({
      ...L,
      total: L.hits.length,
    })),
    facets: {
      byLane: Object.fromEntries(filtered.map((L) => [L.lane, L.hits.length])) as any,
      byDate: {
        'last_24h': 5,
        'last_week': 12,
        'last_month': 30,
        'older': 14,
      },
      byFileType: {
        'pdf': 8,
        'image': 12,
        'audio': 3,
        'video': 2,
        'docx': 4,
        'xlsx': 3,
      },
      scriptVariants: ['احمد', 'Ahmad', 'ahmad', 'احمدی'],
      relatedEntities: ['کریمی', 'پرونده 4412', 'IBAN-IR-...', 'تیم شمال'],
    },
    suggestions: {
      relatedSearches: [
        'احمد کریمی پرونده',
        'ahmad karimi case',
        'IBAN احمد',
        'پرونده 4412',
      ],
    },
  };
}

function buildGenericResponse(query: string, mode: OneSearchMode): OneSearchResponse {
  const q = query.trim();
  return {
    query: q,
    mode,
    tookMs: 210,
    lanes: [
      lane({
        lane: 'chat',
        hits: [
          {
            id: 'gen-chat-1',
            title: `نتیجهٔ نمونه — چت (${q.slice(0, 24)}${q.length > 24 ? '…' : ''})`,
            snippet: `…متن نمونه حاوی عبارت جستجو: «${q}» برای تست رابط.`,
            href: routes.aiChat.root,
            score: 0.55,
          },
        ],
      }),
      lane({
        lane: 'cases',
        hits: [
          {
            id: 'gen-case-1',
            title: 'پروندهٔ نمونه MOCK-GENERIC',
            snippet: `در چک‌لیست واردات، رشتهٔ «${q}» در فیلد توضیحات یافت شد.`,
            href: routes.cases.list,
            score: 0.48,
          },
        ],
      }),
      lane({
        lane: 'files',
        hits: [
          {
            id: 'gen-file-1',
            title: `file_containing_${q.slice(0, 12).replace(/\s+/g, '_') || 'query'}.txt`,
            snippet: 'نمونهٔ کوتاه برای بررسی کارت نتیجه و اسنیپت.',
            href: routes.fileExplorer,
            score: 0.41,
          },
        ],
      }),
      lane({ lane: 'storage', hits: [] }),
      lane({ lane: 'users', hits: [] }),
      lane({ lane: 'graph', hits: [] }),
      lane({
        lane: 'projects_tasks',
        hits: [
          {
            id: 'gen-task-1',
            title: `Task / project match — «${q.slice(0, 24)}${q.length > 24 ? '…' : ''}»`,
            snippet: 'Sample projects & tasks lane hit for layout testing.',
            href: routes.projects.feed,
            score: 0.38,
          },
        ],
      }),
    ],
    facets: {
      byLane: {
        chat: 1,
        cases: 1,
        files: 1,
        storage: 0,
        users: 0,
        graph: 0,
        projects_tasks: 1,
      } as any,
      byDate: {
        'last_24h': 1,
        'last_week': 2,
        'last_month': 3,
      },
      scriptVariants: [q],
    },
  };
}

/**
 * Simulates a gateway `POST /search/query` for UX prototyping.
 */
export async function runMockOneSearch(params: {
  query: string;
  mode: OneSearchMode;
}): Promise<OneSearchResponse> {
  const ms =
    MOCK_DELAY_MS_MIN +
    Math.floor(Math.random() * (MOCK_DELAY_MS_MAX - MOCK_DELAY_MS_MIN + 1));
  await sleep(ms);
  const q = params.query.trim();
  if (!q) {
    return { query: '', mode: params.mode, tookMs: 0, lanes: [], facets: {} };
  }
  if (isAhmadScenario(q)) {
    return buildRichAhmadResponse(q, params.mode);
  }
  return buildGenericResponse(q, params.mode);
}
