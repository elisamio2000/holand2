// ============================================
// One Search — temp federated adapter (parallel upstream calls)
// ============================================

import { adminService } from '@/services/admin.service';
import { chatService } from '@/services/chat.service';
import { graphService } from '@/services/graph-explorer.service';
import { messagesService } from '@/services/messages.service';
import { storageService } from '@/services/storage.service';
import type { Artifact } from '@/types/storage.types';
import type {
  OneSearchDataSourceCall,
  OneSearchLaneId,
  OneSearchLaneSourceMode,
  OneSearchMode,
  OneSearchSourceStatus,
} from '@/types/one-search.types';
import {
  getAllLaneSourceModes,
  getOneSearchFederatedConcurrency,
  isOneSearchLaneFallbackMockEnabled,
  ONE_SEARCH_DEFAULT_LIMIT,
  ONE_SEARCH_SOURCE_TIMEOUT_MS,
} from '../config/search-config';
import {
  FM_ENDPOINT,
  FM_TOOL,
  mapArtifactsToHits,
} from '../mappers/file-manager-to-hit';
import {
  GC_ENDPOINT,
  GC_TOOL,
  mapGraphCasesToHits,
} from '../mappers/graph-cases-to-hit';
import {
  GS_ENDPOINT,
  GS_TOOL,
  mapGraphSearchToHits,
} from '../mappers/graph-search-to-hit';
import {
  MEMORY_ENDPOINT,
  MEMORY_TOOL,
  mapMemoryToHits,
} from '../mappers/memory-to-hit';
import {
  MS_ENDPOINT,
  MS_TOOL,
  mapMessengerToHits,
} from '../mappers/messenger-to-hit';
import {
  USERS_ENDPOINT,
  USERS_TOOL,
  mapUsersToHits,
} from '../mappers/users-to-hit';
import { runMockOneSearch } from '../mock/mock-one-search';
import { runWithConcurrency } from '../utils/run-with-concurrency';

const TARGET_API = 'POST /search/query (federated lanes)';

function lanesForMode(mode: OneSearchMode): OneSearchLaneId[] {
  switch (mode) {
    case 'text':
      return ['chat', 'cases', 'graph', 'files'];
    case 'image':
    case 'audio':
    case 'video':
      return ['storage'];
    case 'file':
      return ['files'];
    case 'all':
    default:
      return ['chat', 'cases', 'files', 'storage', 'graph', 'users'];
  }
}

import { fileManagerArgsForMode } from '../utils/file-manager-search-args';

function filterArtifactsByMode(items: Artifact[], mode: OneSearchMode): Artifact[] {
  if (mode === 'all' || mode === 'file' || mode === 'text') return items;
  return items.filter((a) => {
    const mime = (a.mime_type || '').toLowerCase();
    if (mode === 'image') return mime.startsWith('image/') || a.media_type === 'image';
    if (mode === 'audio') return mime.startsWith('audio/') || a.media_type === 'audio';
    if (mode === 'video') return mime.startsWith('video/') || a.media_type === 'video';
    return true;
  });
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
    }),
  ]);
}

function callRecord(
  partial: Omit<OneSearchDataSourceCall, 'targetApi' | 'mode'> & {
    mode?: OneSearchMode | 'any';
  }
): OneSearchDataSourceCall {
  return {
    targetApi: TARGET_API,
    mode: partial.mode ?? 'any',
    lane: partial.lane,
    toolId: partial.toolId,
    endpoint: partial.endpoint,
    args: partial.args,
    status: partial.status,
    latencyMs: partial.latencyMs,
    error: partial.error,
    hitCount: partial.hitCount,
    notes: partial.notes,
  };
}

function statusFromError(err: unknown): OneSearchSourceStatus {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.startsWith('timeout:') ? 'timeout' : 'error';
}

async function fetchMockLaneHits(
  lane: OneSearchLaneId,
  query: string
): Promise<{ hits: ReturnType<typeof mapMessengerToHits>; status: OneSearchSourceStatus }> {
  const mockRes = await runMockOneSearch({ query, mode: 'all' });
  const laneResult = mockRes.lanes.find((l) => l.lane === lane);
  return { hits: (laneResult?.hits ?? []) as ReturnType<typeof mapMessengerToHits>, status: 'mock' };
}

async function applyLaneMockFallback(
  query: string,
  row: TempFederatedLaneResult
): Promise<TempFederatedLaneResult> {
  if (!isOneSearchLaneFallbackMockEnabled()) return row;
  if (row.call.status === 'mock' || row.call.status === 'skipped') return row;
  if (row.call.status === 'ok' && row.hits.length > 0) return row;

  const { hits } = await fetchMockLaneHits(row.lane, query);
  if (hits.length === 0) return row;

  const note = `Mock fallback after ${row.call.status}${row.call.error ? `: ${row.call.error}` : ''}`;
  return {
    ...row,
    hits,
    call: {
      ...row.call,
      status: 'mock',
      hitCount: hits.length,
      notes: row.call.notes ? `${row.call.notes} — ${note}` : note,
    },
  };
}

export interface TempFederatedLaneResult {
  lane: OneSearchLaneId;
  hits: ReturnType<typeof mapMessengerToHits>;
  call: OneSearchDataSourceCall;
}

export async function fetchTempFederatedLanes(params: {
  query: string;
  mode: OneSearchMode;
  limit?: number;
  userId?: string;
}): Promise<TempFederatedLaneResult[]> {
  const { query, mode, userId } = params;
  const limit = params.limit ?? ONE_SEARCH_DEFAULT_LIMIT;
  const laneModes = getAllLaneSourceModes();
  const activeLanes = lanesForMode(mode);
  const tasks: Array<Promise<TempFederatedLaneResult | TempFederatedLaneResult[]>> = [];

  const schedule = (
    lane: OneSearchLaneId,
    run: () => Promise<TempFederatedLaneResult | TempFederatedLaneResult[]>
  ) => {
    if (!activeLanes.includes(lane)) return;
    const sourceMode: OneSearchLaneSourceMode = laneModes[lane];
    if (sourceMode === 'off') {
      tasks.push(
        Promise.resolve({
          lane,
          hits: [],
          call: callRecord({
            lane,
            toolId: '—',
            endpoint: '—',
            status: 'skipped',
            hitCount: 0,
            notes: 'Lane disabled via env',
          }),
        })
      );
      return;
    }
    if (sourceMode === 'mock') {
      tasks.push(
        (async () => {
          const started = Date.now();
          try {
            const { hits } = await fetchMockLaneHits(lane, query);
            return {
              lane,
              hits,
              call: callRecord({
                lane,
                toolId: 'mock.unified_search',
                endpoint: 'local/mock-one-search.ts',
                status: 'mock',
                latencyMs: Date.now() - started,
                hitCount: hits.length,
                notes: 'Mock lane override',
              }),
            };
          } catch (err) {
            return {
              lane,
              hits: [],
              call: callRecord({
                lane,
                toolId: 'mock.unified_search',
                endpoint: 'local/mock-one-search.ts',
                status: 'error',
                latencyMs: Date.now() - started,
                error: err instanceof Error ? err.message : String(err),
                hitCount: 0,
              }),
            };
          }
        })()
      );
      return;
    }
    tasks.push(run());
  };

  schedule('chat', async () => {
    const args = { q: query, page: 1, limit };
    const results: TempFederatedLaneResult[] = [];
    const messengerStarted = Date.now();

    try {
      const res = await withTimeout(
        messagesService.search(query, undefined, 1, limit),
        ONE_SEARCH_SOURCE_TIMEOUT_MS,
        'messenger'
      );
      const messengerHits = mapMessengerToHits(res.data?.items ?? [], query, args);
      results.push({
        lane: 'chat',
        hits: messengerHits,
        call: callRecord({
          mode,
          lane: 'chat',
          toolId: MS_TOOL,
          endpoint: MS_ENDPOINT,
          args,
          status: 'ok',
          latencyMs: Date.now() - messengerStarted,
          hitCount: messengerHits.length,
        }),
      });
    } catch (err) {
      results.push({
        lane: 'chat',
        hits: [],
        call: callRecord({
          mode,
          lane: 'chat',
          toolId: MS_TOOL,
          endpoint: MS_ENDPOINT,
          args,
          status: statusFromError(err),
          latencyMs: Date.now() - messengerStarted,
          error: err instanceof Error ? err.message : String(err),
          hitCount: 0,
        }),
      });
    }

    if (userId && userId.trim()) {
      const memArgs = {
        query,
        user_id: userId.trim(),
        scope: 'combined',
        limit,
      };
      const memoryStarted = Date.now();
      try {
        const memories = await withTimeout(
          chatService.searchMemories(query, userId.trim(), undefined, 'combined', limit),
          ONE_SEARCH_SOURCE_TIMEOUT_MS,
          'memory'
        );
        const memoryHits = mapMemoryToHits(memories, query, memArgs);
        results.push({
          lane: 'chat',
          hits: memoryHits,
          call: callRecord({
            mode,
            lane: 'chat',
            toolId: MEMORY_TOOL,
            endpoint: MEMORY_ENDPOINT,
            args: memArgs,
            status: 'ok',
            latencyMs: Date.now() - memoryStarted,
            hitCount: memoryHits.length,
            notes: 'Session/user memory index',
          }),
        });
      } catch (err) {
        results.push({
          lane: 'chat',
          hits: [],
          call: callRecord({
            mode,
            lane: 'chat',
            toolId: MEMORY_TOOL,
            endpoint: MEMORY_ENDPOINT,
            args: memArgs,
            status: statusFromError(err),
            latencyMs: Date.now() - memoryStarted,
            error: err instanceof Error ? err.message : String(err),
            hitCount: 0,
            notes: 'Session/user memory index',
          }),
        });
      }
    }

    return results.length === 1 ? results[0] : results;
  });

  schedule('cases', async () => {
    const args = { search: query, limit };
    const started = Date.now();
    try {
      const res = await withTimeout(
        graphService.listCases({ search: query, limit }),
        ONE_SEARCH_SOURCE_TIMEOUT_MS,
        'graph_cases'
      );
      const hits = mapGraphCasesToHits(res.items, query, args);
      return {
        lane: 'cases',
        hits,
        call: callRecord({
          mode,
          lane: 'cases',
          toolId: GC_TOOL,
          endpoint: GC_ENDPOINT,
          args,
          status: 'ok',
          latencyMs: Date.now() - started,
          hitCount: hits.length,
        }),
      };
    } catch (err) {
      return {
        lane: 'cases',
        hits: [],
        call: callRecord({
          mode,
          lane: 'cases',
          toolId: GC_TOOL,
          endpoint: GC_ENDPOINT,
          args,
          status: statusFromError(err),
          latencyMs: Date.now() - started,
          error: err instanceof Error ? err.message : String(err),
          hitCount: 0,
        }),
      };
    }
  });

  schedule('graph', async () => {
    const args = { queries: [query], question: query };
    const started = Date.now();
    try {
      const res = await withTimeout(
        graphService.graphSearch([query], query),
        ONE_SEARCH_SOURCE_TIMEOUT_MS,
        'graph_search'
      );
      const hits = mapGraphSearchToHits(res.answer, res.ui, query, args);
      return {
        lane: 'graph',
        hits,
        call: callRecord({
          mode,
          lane: 'graph',
          toolId: GS_TOOL,
          endpoint: GS_ENDPOINT,
          args,
          status: 'ok',
          latencyMs: Date.now() - started,
          hitCount: hits.length,
        }),
      };
    } catch (err) {
      return {
        lane: 'graph',
        hits: [],
        call: callRecord({
          mode,
          lane: 'graph',
          toolId: GS_TOOL,
          endpoint: GS_ENDPOINT,
          args,
          status: statusFromError(err),
          latencyMs: Date.now() - started,
          error: err instanceof Error ? err.message : String(err),
          hitCount: 0,
        }),
      };
    }
  });

  const needsFileManagerReal =
    (activeLanes.includes('files') && laneModes.files === 'real') ||
    (activeLanes.includes('storage') && laneModes.storage === 'real') ||
    mode === 'image' ||
    mode === 'audio' ||
    mode === 'video' ||
    mode === 'file' ||
    mode === 'text';

  if (needsFileManagerReal) {
    tasks.push(
      (async (): Promise<TempFederatedLaneResult[]> => {
        const fmArgs = fileManagerArgsForMode(query, mode, limit);
        const started = Date.now();
        try {
          const res = await withTimeout(
            storageService.listFilesForExplorer(fmArgs),
            ONE_SEARCH_SOURCE_TIMEOUT_MS,
            'file_manager'
          );
          const filtered = filterArtifactsByMode(res.items, mode);
          const { files, storage } = mapArtifactsToHits(filtered, query, fmArgs);
          const latencyMs = Date.now() - started;
          const out: TempFederatedLaneResult[] = [];

          if (activeLanes.includes('files') && laneModes.files === 'real') {
            out.push({
              lane: 'files',
              hits: files,
              call: callRecord({
                mode,
                lane: 'files',
                toolId: FM_TOOL,
                endpoint: FM_ENDPOINT,
                args: fmArgs,
                status: 'ok',
                latencyMs,
                hitCount: files.length,
                notes: 'Non-media artifacts from file_manager.list',
              }),
            });
          }
          if (activeLanes.includes('storage') && laneModes.storage === 'real') {
            out.push({
              lane: 'storage',
              hits: storage,
              call: callRecord({
                mode,
                lane: 'storage',
                toolId: FM_TOOL,
                endpoint: FM_ENDPOINT,
                args: fmArgs,
                status: 'ok',
                latencyMs,
                hitCount: storage.length,
                notes: 'Media artifacts from file_manager.list',
              }),
            });
          }
          return out;
        } catch (err) {
          const errLane: OneSearchLaneId =
            mode === 'image' || mode === 'audio' || mode === 'video' ? 'storage' : 'files';
          return [
            {
              lane: errLane,
              hits: [],
              call: callRecord({
                mode,
                lane: errLane,
                toolId: FM_TOOL,
                endpoint: FM_ENDPOINT,
                args: fmArgs,
                status: statusFromError(err),
                latencyMs: Date.now() - started,
                error: err instanceof Error ? err.message : String(err),
                hitCount: 0,
              }),
            },
          ];
        }
      })().then((rows) => rows)
    );
  }

  if (laneModes.files === 'mock' && activeLanes.includes('files')) {
    schedule('files', async () => {
      const started = Date.now();
      const { hits } = await fetchMockLaneHits('files', query);
      return {
        lane: 'files',
        hits,
        call: callRecord({
          lane: 'files',
          toolId: 'mock.unified_search',
          endpoint: 'local/mock-one-search.ts',
          status: 'mock',
          latencyMs: Date.now() - started,
          hitCount: hits.length,
        }),
      };
    });
  }

  if (laneModes.storage === 'mock' && activeLanes.includes('storage')) {
    schedule('storage', async () => {
      const started = Date.now();
      const { hits } = await fetchMockLaneHits('storage', query);
      return {
        lane: 'storage',
        hits,
        call: callRecord({
          lane: 'storage',
          toolId: 'mock.unified_search',
          endpoint: 'local/mock-one-search.ts',
          status: 'mock',
          latencyMs: Date.now() - started,
          hitCount: hits.length,
        }),
      };
    });
  }

  schedule('users', async () => {
    const args = { search: query, limit };
    const started = Date.now();
    try {
      const users = await withTimeout(
        adminService.searchUsers(query, limit),
        ONE_SEARCH_SOURCE_TIMEOUT_MS,
        'users'
      );
      const hits = mapUsersToHits(users, query, args);
      return {
        lane: 'users',
        hits,
        call: callRecord({
          mode,
          lane: 'users',
          toolId: USERS_TOOL,
          endpoint: USERS_ENDPOINT,
          args,
          status: 'ok',
          latencyMs: Date.now() - started,
          hitCount: hits.length,
          notes: 'Client-side filter on GET /admin/users (no server search param)',
        }),
      };
    } catch (err) {
      return {
        lane: 'users',
        hits: [],
        call: callRecord({
          mode,
          lane: 'users',
          toolId: USERS_TOOL,
          endpoint: USERS_ENDPOINT,
          args,
          status: statusFromError(err),
          latencyMs: Date.now() - started,
          error: err instanceof Error ? err.message : String(err),
          hitCount: 0,
        }),
      };
    }
  });

  const settled = await runWithConcurrency(
    tasks.map((task) => () => task),
    getOneSearchFederatedConcurrency()
  );
  const flat = settled.flat();
  const out: TempFederatedLaneResult[] = [];
  for (const row of flat) {
    out.push(await applyLaneMockFallback(query, row));
  }
  return out;
}
