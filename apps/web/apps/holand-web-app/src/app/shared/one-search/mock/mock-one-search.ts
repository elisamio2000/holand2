// ============================================
// One Search â€” in-page mock repository (sample contract)
// Consumed ONLY by one-search-view.tsx â€” do not import elsewhere.
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

/** Broad match for the "Ø§Ø­Ù…Ø¯" scenario + generic queries for layout testing. */
function isAhmadScenario(q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return false;
  return /Ø§Ø­Ù…Ø¯|ahmad|ahmadi|Ø§Ø­Ù…Ø¯ÛŒ/.test(q) || n.includes('ahmad');
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
      title: `${src.title} Â· ${out.length + 1}`,
      score: Math.max(0.12, (src.score ?? 0.55) * 0.965 ** (out.length - base.length + 1)),
      snippet: src.snippet
        ? `${src.snippet} (Ø±Ø¯ÛŒÙ Ù†Ù…ÙˆÙ†Ù‡Ù” ${out.length + 1} Ø¨Ø±Ø§ÛŒ ØªØ³Øª Ø§Ø³Ú©Ø±ÙˆÙ„.)`
        : `Ø±Ø¯ÛŒÙ Ù†Ù…ÙˆÙ†Ù‡Ù” ${out.length + 1} Ø¨Ø±Ø§ÛŒ ØªØ³Øª Ø§Ø³Ú©Ø±ÙˆÙ„.`,
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
          title: `Ú†Øª ${i % 3 === 0 ? 'Ù¾Ø±ÙˆÙ†Ø¯Ù‡' : i % 3 === 1 ? 'ØªÛŒÙ…' : 'Ø¬Ù„Ø³Ù‡'} ${i + 1} â€” ${i % 2 === 0 ? 'Ø¨Ø§Ø²Ø¬ÙˆÛŒÛŒ' : 'ØªØ­Ù„ÛŒÙ„'}`,
          snippet: `${i % 2 === 0 ? 'Ø·Ø¨Ù‚ ØµÙˆØ±ØªØ¬Ù„Ø³Ù‡' : 'Ø¨Ø±Ø±Ø³ÛŒ Ø§Ø³Ù†Ø§Ø¯'}, Ø§Ø­Ù…Ø¯ ${i % 3 === 0 ? 'Ú¯ÙØªÙ‡ Ø¨ÙˆØ¯' : i % 3 === 1 ? 'ØªØ£Ú©ÛŒØ¯ Ú©Ø±Ø¯' : 'Ø§Ø´Ø§Ø±Ù‡ Ú©Ø±Ø¯'} Ú©Ù‡ ${i % 4 === 0 ? 'ÙØ§ÛŒÙ„ Ø§Ú©Ø³Ù„' : i % 4 === 1 ? 'Ù…Ø¯Ø§Ø±Ú©' : i % 4 === 2 ? 'Ú¯Ø²Ø§Ø±Ø´' : 'Ø§Ø·Ù„Ø§Ø¹Ø§Øª'} Ø±Ø§ ${i % 2 === 0 ? 'Ø±ÙˆÛŒ Ø¯Ø±Ø§ÛŒÙˆ' : 'Ø¯Ø± Ø³ÛŒØ³ØªÙ…'} Ù‚Ø±Ø§Ø± Ø¯Ø§Ø¯Ù‡ Ø§Ø³Øª.`,
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
          title: `Ù¾Ø±ÙˆÙ†Ø¯Ù‡ MOCK-${4412 + i * 100} â€” ${i % 3 === 0 ? 'Ø§Ø®ØªÙ„Ø§Ø³' : i % 3 === 1 ? 'Ú©Ù„Ø§Ù‡Ø¨Ø±Ø¯Ø§Ø±ÛŒ' : 'ØªØ®Ù„Ù Ù…Ø§Ù„ÛŒ'} ${i % 2 === 0 ? 'Ù…Ù†Ø·Ù‚Ù‡ ' + (i % 5 + 1) : 'Ø¨Ø®Ø´ ' + (i % 4 + 1)}`,
          snippet: `${i === 0 ? 'Ù†Ø§Ù… Ù…Ø¸Ù†ÙˆÙ† Ø§ØµÙ„ÛŒ: Ø§Ø­Ù…Ø¯ Ú©Ø±ÛŒÙ…ÛŒØ› Ù†Ø§Ù… Ù…Ø³ØªØ¹Ø§Ø± Ø¯Ø± Ø§Ø³Ù†Ø§Ø¯: Ahmad Karimi.' : `Ù¾Ø±ÙˆÙ†Ø¯Ù‡ Ø´Ù…Ø§Ø±Ù‡ ${i + 1} Ù…Ø±ØªØ¨Ø· Ø¨Ø§ ${i % 2 === 0 ? 'Ø§Ø­Ù…Ø¯' : 'Ahmad'} - ${i % 3 === 0 ? 'Ø¯Ø± Ø­Ø§Ù„ Ø¨Ø±Ø±Ø³ÛŒ' : i % 3 === 1 ? 'ØªØ­Øª ØªØ­Ù‚ÛŒÙ‚' : 'Ø¯Ø± Ø§Ù†ØªØ¸Ø§Ø± ØªØµÙ…ÛŒÙ…'}`}`,
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
          snippet: `${i % 2 === 0 ? 'ØµÙØ­Ù‡' : 'Ø¨Ø®Ø´'} ${i % 10 + 1}: Â«Ø§Ø­Ù…Ø¯Â» ${i % 3 === 0 ? 'Ø¨Ù‡ Ø¹Ù†ÙˆØ§Ù† Ø§Ù…Ø¶Ø§Ú©Ù†Ù†Ø¯Ù‡' : i % 3 === 1 ? 'Ø¯Ø± Ù„ÛŒØ³Øª Ù…Ø³Ø¦ÙˆÙ„ÛŒÙ†' : 'Ø¯Ø± Ø¬Ø¯ÙˆÙ„ Ø§Ø·Ù„Ø§Ø¹Ø§Øª'} ${i % 2 === 0 ? 'Ø°Ú©Ø± Ø´Ø¯Ù‡ Ø§Ø³Øª' : 'Ù‚ÛŒØ¯ Ø´Ø¯Ù‡'}.`,
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
        // Portrait images (Ø¹Ù…ÙˆØ¯ÛŒ)
        {
          id: 'mock-img-1',
          title: 'passport_photo_ahmad.jpg',
          snippet: 'Ø¹Ú©Ø³ Ù¾Ø§Ø³Ù¾ÙˆØ±Øª Ø§Ø­Ù…Ø¯ Ú©Ø±ÛŒÙ…ÛŒ - ØªØµÙˆÛŒØ± Ø¹Ù…ÙˆØ¯ÛŒ',
          href: routes.storage,
          score: 0.95,
          occurredAt: new Date(2026, 3, 20, 8, 0, 0).toISOString(),
          meta: {
            artifact_id: 'art-img-1',
            mime: 'image/jpeg',
            thumb_url: '/brand/brand-mark-4x.svg',
            url: '/brand/brand-mark-4x.svg',
            width: 800,
            height: 1200,
            size_bytes: 1800000,
          },
        },
        {
          id: 'mock-img-2',
          title: 'id_card_scan_ahmad.png',
          snippet: 'Ø§Ø³Ú©Ù† Ú©Ø§Ø±Øª Ø´Ù†Ø§Ø³Ø§ÛŒÛŒ - ØªØµÙˆÛŒØ± Ø¹Ù…ÙˆØ¯ÛŒ',
          href: routes.storage,
          score: 0.93,
          occurredAt: new Date(2026, 3, 19, 9, 0, 0).toISOString(),
          meta: {
            artifact_id: 'art-img-2',
            mime: 'image/png',
            thumb_url: '/brand/brand-mark-4x.svg',
            url: '/brand/brand-mark-4x.svg',
            width: 900,
            height: 1350,
            size_bytes: 2200000,
          },
        },
        {
          id: 'mock-img-3',
          title: 'portrait_ahmad_office.jpg',
          snippet: 'Ø¹Ú©Ø³ Ù¾Ø±ØªØ±Ù‡ Ø§Ø­Ù…Ø¯ Ø¯Ø± Ø¯ÙØªØ±',
          href: routes.storage,
          score: 0.91,
          occurredAt: new Date(2026, 3, 18, 10, 0, 0).toISOString(),
          meta: {
            artifact_id: 'art-img-3',
            mime: 'image/jpeg',
            thumb_url: '/brand/brand-mark-4x.svg',
            url: '/brand/brand-mark-4x.svg',
            width: 720,
            height: 1280,
            size_bytes: 1900000,
          },
        },
        // Landscape images (Ø§ÙÙ‚ÛŒ)
        {
          id: 'mock-img-4',
          title: 'meeting_room_ahmad.jpg',
          snippet: 'ØªØµÙˆÛŒØ± Ø§ØªØ§Ù‚ Ø¬Ù„Ø³Ù‡ - ØªØµÙˆÛŒØ± Ø§ÙÙ‚ÛŒ',
          href: routes.storage,
          score: 0.89,
          occurredAt: new Date(2026, 3, 17, 11, 0, 0).toISOString(),
          meta: {
            artifact_id: 'art-img-4',
            mime: 'image/jpeg',
            thumb_url: '/brand/brand-mark-4x.svg',
            url: '/brand/brand-mark-4x.svg',
            width: 1920,
            height: 1080,
            size_bytes: 2500000,
          },
        },
        {
          id: 'mock-img-5',
          title: 'office_panorama.png',
          snippet: 'Ù¾Ø§Ù†ÙˆØ±Ø§Ù…Ø§ÛŒ Ø¯ÙØªØ± Ú©Ø§Ø± Ø§Ø­Ù…Ø¯',
          href: routes.storage,
          score: 0.87,
          occurredAt: new Date(2026, 3, 16, 12, 0, 0).toISOString(),
          meta: {
            artifact_id: 'art-img-5',
            mime: 'image/png',
            thumb_url: '/brand/brand-mark-4x.svg',
            url: '/brand/brand-mark-4x.svg',
            width: 2400,
            height: 1200,
            size_bytes: 3200000,
          },
        },
        {
          id: 'mock-img-6',
          title: 'document_wide_scan.jpg',
          snippet: 'Ø§Ø³Ú©Ù† Ø³Ù†Ø¯ Ø¹Ø±ÛŒØ¶',
          href: routes.storage,
          score: 0.85,
          occurredAt: new Date(2026, 3, 15, 13, 0, 0).toISOString(),
          meta: {
            artifact_id: 'art-img-6',
            mime: 'image/jpeg',
            thumb_url: '/brand/brand-mark-4x.svg',
            url: '/brand/brand-mark-4x.svg',
            width: 1800,
            height: 1200,
            size_bytes: 2100000,
          },
        },
        // Square images (Ù…Ø±Ø¨Ø¹)
        {
          id: 'mock-img-7',
          title: 'profile_ahmad_square.jpg',
          snippet: 'Ø¹Ú©Ø³ Ù¾Ø±ÙˆÙØ§ÛŒÙ„ Ù…Ø±Ø¨Ø¹ÛŒ Ø§Ø­Ù…Ø¯',
          href: routes.storage,
          score: 0.83,
          occurredAt: new Date(2026, 3, 14, 14, 0, 0).toISOString(),
          meta: {
            artifact_id: 'art-img-7',
            mime: 'image/jpeg',
            thumb_url: '/brand/brand-mark-4x.svg',
            url: '/brand/brand-mark-4x.svg',
            width: 1200,
            height: 1200,
            size_bytes: 1700000,
          },
        },
        {
          id: 'mock-img-8',
          title: 'logo_company_square.png',
          snippet: 'Ù„ÙˆÚ¯ÙˆÛŒ Ù…Ø±Ø¨Ø¹ÛŒ Ø´Ø±Ú©Øª',
          href: routes.storage,
          score: 0.81,
          occurredAt: new Date(2026, 3, 13, 15, 0, 0).toISOString(),
          meta: {
            artifact_id: 'art-img-8',
            mime: 'image/png',
            thumb_url: '/brand/brand-mark-4x.svg',
            url: '/brand/brand-mark-4x.svg',
            width: 1000,
            height: 1000,
            size_bytes: 1500000,
          },
        },
        // Very tall portrait (Ø®ÛŒÙ„ÛŒ Ø¹Ù…ÙˆØ¯ÛŒ)
        {
          id: 'mock-img-9',
          title: 'full_body_photo.jpg',
          snippet: 'Ø¹Ú©Ø³ ØªÙ…Ø§Ù… Ù‚Ø¯ - ØªØµÙˆÛŒØ± Ø¨Ø³ÛŒØ§Ø± Ø¹Ù…ÙˆØ¯ÛŒ',
          href: routes.storage,
          score: 0.79,
          occurredAt: new Date(2026, 3, 12, 16, 0, 0).toISOString(),
          meta: {
            artifact_id: 'art-img-9',
            mime: 'image/jpeg',
            thumb_url: '/brand/brand-mark-4x.svg',
            url: '/brand/brand-mark-4x.svg',
            width: 600,
            height: 1800,
            size_bytes: 1600000,
          },
        },
        // Very wide landscape (Ø®ÛŒÙ„ÛŒ Ø§ÙÙ‚ÛŒ)
        {
          id: 'mock-img-10',
          title: 'banner_wide.png',
          snippet: 'Ø¨Ù†Ø± Ø¹Ø±ÛŒØ¶ - ØªØµÙˆÛŒØ± Ø¨Ø³ÛŒØ§Ø± Ø§ÙÙ‚ÛŒ',
          href: routes.storage,
          score: 0.77,
          occurredAt: new Date(2026, 3, 11, 17, 0, 0).toISOString(),
          meta: {
            artifact_id: 'art-img-10',
            mime: 'image/png',
            thumb_url: '/brand/brand-mark-4x.svg',
            url: '/brand/brand-mark-4x.svg',
            width: 2560,
            height: 1024,
            size_bytes: 2800000,
          },
        },
        // More varied sizes
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `mock-img-${11 + i}`,
          title: `photo_ahmad_${11 + i}.${i % 2 === 0 ? 'jpg' : 'png'}`,
          snippet: `ØªØµÙˆÛŒØ± ${11 + i} - ${i % 3 === 0 ? 'Ø¹Ù…ÙˆØ¯ÛŒ' : i % 3 === 1 ? 'Ø§ÙÙ‚ÛŒ' : 'Ù…Ø±Ø¨Ø¹'}`,
          href: routes.storage,
          score: 0.75 - i * 0.02,
          occurredAt: new Date(2026, 3, 10 - i, 8 + i, 0, 0).toISOString(),
          meta: {
            artifact_id: `art-img-${11 + i}`,
            mime: i % 2 === 0 ? 'image/jpeg' : 'image/png',
            thumb_url: `/brand/brand-mark-4x.svg + i}/400/300`,
            url: `/brand/brand-mark-4x.svg + i}/${
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
          snippet: `ÙˆÛŒØ¯ÛŒÙˆ ${i + 1} - ${i % 2 === 0 ? 'Ø¨Ø§Ø²Ø¬ÙˆÛŒÛŒ' : 'Ù…Ø³ØªÙ†Ø¯'} Ø§Ø­Ù…Ø¯ Ú©Ø±ÛŒÙ…ÛŒ`,
          href: routes.storage,
          score: 0.88 - i * 0.03,
          occurredAt: new Date(2026, 4, 2 - i, 14 + i, 30, 0).toISOString(),
          meta: {
            artifact_id: `art-video-${i + 1}`,
            mime: 'video/mp4',
            thumb_url: `/brand/brand-mark-4x.svg + i}/640/360`,
            url: i === 0 
              ? '/brand/brand-mark-4x.svg'
              : i === 1
              ? '/brand/brand-mark-4x.svg'
              : i === 2
              ? '/brand/brand-mark-4x.svg'
              : '/brand/brand-mark-4x.svg',
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
              : `Ø¶Ø¨Ø· ØµÙˆØªÛŒ ${i + 1} - ${i % 3 === 0 ? 'ØªÙ…Ø§Ø³ ØªÙ„ÙÙ†ÛŒ' : i % 3 === 1 ? 'Ø¬Ù„Ø³Ù‡' : 'Ù…ØµØ§Ø­Ø¨Ù‡'}`,
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
          snippet: `Ø³Ù†Ø¯ ${i + 1} Ù…Ø±ØªØ¨Ø· Ø¨Ø§ Ù¾Ø±ÙˆÙ†Ø¯Ù‡ Ø§Ø­Ù…Ø¯ Ú©Ø±ÛŒÙ…ÛŒ`,
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
          title: `Ú©Ø§Ø±Ø¨Ø±: ${i === 0 ? 'ahmad.karimi' : `user_${i}_ahmad`}`,
          snippet: `Ù†Ù‚Ø´: ${i % 3 === 0 ? 'ØªØ­Ù„ÛŒÙ„â€ŒÚ¯Ø±' : i % 3 === 1 ? 'Ù…Ø¯ÛŒØ±' : 'Ú©Ø§Ø±Ø´Ù†Ø§Ø³'} â€” Ú¯Ø±ÙˆÙ‡: ${i % 2 === 0 ? 'ØªÛŒÙ… Ø´Ù…Ø§Ù„' : 'ØªÛŒÙ… Ø¬Ù†ÙˆØ¨'} â€” Ø¢Ø®Ø±ÛŒÙ† ÙˆØ±ÙˆØ¯: ${new Date(2026, 4, 1 - i).toLocaleDateString('fa-IR')}`,
          href: routes.profile,
          score: 0.86 - i * 0.03,
          meta: {
            user_id: `usr-mock-${i + 1}`,
            aliases: i === 0 ? 'Ø§Ø­Ù…Ø¯ Ú©Ø±ÛŒÙ…ÛŒ, Ahmad Karimi' : `User ${i + 1}, Ahmad User`,
            thumb_url: `/brand/brand-mark-4x.svg % 2 === 0 ? 'men' : 'women'}/${32 + i}.jpg`,
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
          title: `Ú¯Ø±Ø§Ù: ${i % 4 === 0 ? 'Person' : i % 4 === 1 ? 'Account' : i % 4 === 2 ? 'Transaction' : 'Document'}(ahmad_${i + 1}) â€” Ø§Ø±ØªØ¨Ø§Ø· Ø¨Ø§ ${i % 3 === 0 ? 'Account' : i % 3 === 1 ? 'Person' : 'Organization'}`,
          snippet: `ÛŒØ§Ù„ ${i % 3 === 0 ? 'HAS_ALIAS' : i % 3 === 1 ? 'CONNECTED_TO' : 'OWNS'} â†’ Â«Ø§Ø­Ù…Ø¯Â»${i % 2 === 0 ? 'ØŒ Â«AhmadÂ»' : ''}${i % 3 === 0 ? 'ØŒ Â«Ø§Ø­Ù…Ø¯ Ú©Ø±ÛŒÙ…ÛŒÂ»' : ''}`,
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
          title: 'Operation North Star â€” Review import checklist',
          snippet: 'Assigned task in proj-mock-001 Â· due this week Â· linked case-mock-4412',
          href: routes.projects.task('proj-mock-001', 'task-mock-001'),
          score: 0.72,
          meta: { project_id: 'proj-mock-001', task_id: 'task-mock-001', status: 'in_progress' },
        },
        {
          id: 'task-mock-002',
          title: 'Financial Review â€” Reconcile transaction graph',
          snippet: 'High priority Â· proj-mock-002 Â· analyst assignment',
          href: routes.projects.task('proj-mock-002', 'task-mock-002'),
          score: 0.68,
          meta: { project_id: 'proj-mock-002', priority: 'high' },
        },
        {
          id: 'proj-mock-001',
          title: 'Project: Operation North Star',
          snippet: 'Active project Â· 12 open tasks Â· 3 linked cases',
          href: routes.projects.detail('proj-mock-001'),
          score: 0.61,
          meta: { type: 'project', status: 'active' },
        },
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `task-mock-search-${i + 3}`,
          title: `Task sample ${i + 3} â€” ${query.slice(0, 20) || 'projects'}`,
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
      scriptVariants: ['Ø§Ø­Ù…Ø¯', 'Ahmad', 'ahmad', 'Ø§Ø­Ù…Ø¯ÛŒ'],
      relatedEntities: ['Ú©Ø±ÛŒÙ…ÛŒ', 'Ù¾Ø±ÙˆÙ†Ø¯Ù‡ 4412', 'IBAN-IR-...', 'ØªÛŒÙ… Ø´Ù…Ø§Ù„'],
    },
    suggestions: {
      relatedSearches: [
        'Ø§Ø­Ù…Ø¯ Ú©Ø±ÛŒÙ…ÛŒ Ù¾Ø±ÙˆÙ†Ø¯Ù‡',
        'ahmad karimi case',
        'IBAN Ø§Ø­Ù…Ø¯',
        'Ù¾Ø±ÙˆÙ†Ø¯Ù‡ 4412',
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
            title: `Ù†ØªÛŒØ¬Ù‡Ù” Ù†Ù…ÙˆÙ†Ù‡ â€” Ú†Øª (${q.slice(0, 24)}${q.length > 24 ? 'â€¦' : ''})`,
            snippet: `â€¦Ù…ØªÙ† Ù†Ù…ÙˆÙ†Ù‡ Ø­Ø§ÙˆÛŒ Ø¹Ø¨Ø§Ø±Øª Ø¬Ø³ØªØ¬Ùˆ: Â«${q}Â» Ø¨Ø±Ø§ÛŒ ØªØ³Øª Ø±Ø§Ø¨Ø·.`,
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
            title: 'Ù¾Ø±ÙˆÙ†Ø¯Ù‡Ù” Ù†Ù…ÙˆÙ†Ù‡ MOCK-GENERIC',
            snippet: `Ø¯Ø± Ú†Ú©â€ŒÙ„ÛŒØ³Øª ÙˆØ§Ø±Ø¯Ø§ØªØŒ Ø±Ø´ØªÙ‡Ù” Â«${q}Â» Ø¯Ø± ÙÛŒÙ„Ø¯ ØªÙˆØ¶ÛŒØ­Ø§Øª ÛŒØ§ÙØª Ø´Ø¯.`,
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
            snippet: 'Ù†Ù…ÙˆÙ†Ù‡Ù” Ú©ÙˆØªØ§Ù‡ Ø¨Ø±Ø§ÛŒ Ø¨Ø±Ø±Ø³ÛŒ Ú©Ø§Ø±Øª Ù†ØªÛŒØ¬Ù‡ Ùˆ Ø§Ø³Ù†ÛŒÙ¾Øª.',
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
            title: `Task / project match â€” Â«${q.slice(0, 24)}${q.length > 24 ? 'â€¦' : ''}Â»`,
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

