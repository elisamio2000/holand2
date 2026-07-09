// Expert notes: localStorage + optional backend (BR-6) with sync queue

import { isAxiosError } from 'axios';
import { gatewayClient } from '@/lib/api-client';

export type NoteStatus = 'draft' | 'final';

export interface ExpertNoteRecord {
  case_id: string;
  content: string;
  status: NoteStatus;
  author: string;
  timestamp: number;
  synced?: boolean;
}

const SYNC_QUEUE_KEY = 'Holand:expertNotesSyncQueue:v1';

function storageKey(caseId: string) {
  return `expert_note_${caseId}`;
}

function readSyncQueue(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    const parsed = JSON.parse(raw ?? '[]') as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSyncQueue(ids: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(ids));
}

export function loadExpertNoteLocal(caseId: string): ExpertNoteRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(caseId));
    if (!raw) return null;
    return JSON.parse(raw) as ExpertNoteRecord;
  } catch {
    return null;
  }
}

export function saveExpertNoteLocal(note: ExpertNoteRecord): void {
  if (typeof window === 'undefined') return;
  const payload = { ...note, synced: false };
  localStorage.setItem(storageKey(note.case_id), JSON.stringify(payload));
  const q = readSyncQueue();
  if (!q.includes(note.case_id)) {
    writeSyncQueue([...q, note.case_id]);
  }
}

async function fetchRemoteNotes(caseId: string): Promise<ExpertNoteRecord | null> {
  try {
    const res = await gatewayClient.get(
      `/cases/${encodeURIComponent(caseId)}/expert-notes`
    );
    const d = res.data as { notes?: Array<Record<string, unknown>> };
    const first = d.notes?.[0];
    if (!first) return null;
    return {
      case_id: caseId,
      content: String(first.body ?? ''),
      status: (first.status as NoteStatus) ?? 'draft',
      author: String(first.author_display_name ?? first.author_user_id ?? ''),
      timestamp:
        typeof first.updated_at === 'number'
          ? first.updated_at * 1000
          : Date.now(),
      synced: true,
    };
  } catch (err: unknown) {
    if (isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
}

async function pushRemoteNotes(note: ExpertNoteRecord): Promise<void> {
  await gatewayClient.put(`/cases/${encodeURIComponent(note.case_id)}/expert-notes`, {
    notes: [
      {
        body: note.content,
        status: note.status,
      },
    ],
  });
}

/** Load note: remote when available, else local. */
export async function loadExpertNote(caseId: string): Promise<ExpertNoteRecord | null> {
  try {
    const remote = await fetchRemoteNotes(caseId);
    if (remote) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey(caseId), JSON.stringify({ ...remote, synced: true }));
      }
      return remote;
    }
  } catch {
    /* fall through to local */
  }
  return loadExpertNoteLocal(caseId);
}

/** Save locally and best-effort push to API. */
export async function saveExpertNote(note: ExpertNoteRecord): Promise<void> {
  saveExpertNoteLocal(note);
  try {
    await pushRemoteNotes(note);
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        storageKey(note.case_id),
        JSON.stringify({ ...note, synced: true, timestamp: Date.now() })
      );
      writeSyncQueue(readSyncQueue().filter((id) => id !== note.case_id));
    }
  } catch {
    /* queued for later via SYNC_QUEUE_KEY */
  }
}

/** Export all local notes for backup/migration. */
export function exportExpertNotesJson(): string {
  if (typeof window === 'undefined') return '[]';
  const out: ExpertNoteRecord[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith('expert_note_')) continue;
    try {
      const parsed = JSON.parse(
        localStorage.getItem(key) ?? '{}'
      ) as ExpertNoteRecord;
      if (parsed.case_id) out.push(parsed);
    } catch {
      /* skip */
    }
  }
  return JSON.stringify(out, null, 2);
}

/** Flush sync queue when backend becomes available. */
export async function flushExpertNotesSyncQueue(): Promise<number> {
  const ids = readSyncQueue();
  let synced = 0;
  for (const caseId of ids) {
    const local = loadExpertNoteLocal(caseId);
    if (!local) continue;
    try {
      await pushRemoteNotes(local);
      synced += 1;
    } catch {
      /* keep in queue */
    }
  }
  if (synced > 0) {
    writeSyncQueue(ids.filter((id) => !loadExpertNoteLocal(id)?.synced));
  }
  return synced;
}

