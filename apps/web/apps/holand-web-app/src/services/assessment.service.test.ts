/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const postMock = vi.fn();
const getMock = vi.fn();

vi.mock('@/lib/api-client', () => ({
  gatewayClient: {
    post: (...args: unknown[]) => postMock(...args),
    get: (...args: unknown[]) => getMock(...args),
  },
}));

vi.mock('./assessment-mock-data', () => ({
  buildMockHistory: vi.fn(() => []),
  buildMockResult: vi.fn((sessionId: string) => ({
    sessionId,
    testType: 'combined',
    ageBand: '18-24',
    completedAt: '2026-01-01T00:00:00Z',
  })),
  buildMockSession: vi.fn((sessionId: string, testType: string, ageBand: string) => ({
    sessionId,
    testType,
    ageBand,
    status: 'in_progress',
    totalQuestions: 0,
    questions: [],
    createdAt: '2026-01-01T00:00:00Z',
  })),
  generateMockSessionId: vi.fn(() => 'mock-session-id'),
}));

vi.mock('@/store/assessment-history.store', () => ({
  useAssessmentHistoryStore: {
    getState: () => ({ entries: [] }),
  },
}));

import { assessmentService } from './assessment.service';

describe('assessmentService contract adapter', () => {
  beforeEach(() => {
    postMock.mockReset();
    getMock.mockReset();
  });

  it('maps startSession to /sessions/start and adapts shape', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        session_id: 's1',
        assessment_type: 'holland',
        started_at: '2026-01-01T00:00:00Z',
        status: 'in_progress',
        questions: [
          {
            id: 'q1',
            kind: 'likert',
            dimension: 'R',
            text: 'q',
            order_index: 0,
            options: [{ id: 'o1', label: '1', value: 1, pole: 'R', order_index: 0 }],
          },
        ],
      },
    });

    const session = await assessmentService.startSession({ testType: 'holland', ageBand: '18-24' });

    expect(postMock).toHaveBeenCalledWith('/sessions/start', { assessment_type: 'holland' });
    expect(session.sessionId).toBe('s1');
    expect(session.testType).toBe('holland');
    expect(session.questions[0].kind).toBe('likert5');
  });

  it('submits adapted answer payload to /sessions/{id}/answers', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        session_id: 's2',
        assessment_type: 'holland',
        started_at: '2026-01-01T00:00:00Z',
        status: 'in_progress',
        questions: [
          {
            id: 'q1',
            kind: 'likert',
            dimension: 'R',
            text: 'q',
            order_index: 0,
            options: [{ id: 'option-id-1', label: '1', value: 1, pole: 'R', order_index: 0 }],
          },
        ],
      },
    });
    await assessmentService.startSession({ testType: 'holland', ageBand: '18-24' });

    postMock.mockResolvedValueOnce({ data: {} });
    await assessmentService.submitAnswer({ sessionId: 's2', questionId: 'q1', value: 1 });

    expect(postMock).toHaveBeenNthCalledWith(2, '/sessions/s2/answers', {
      answers: [{ question_id: 'q1', option_id: 'option-id-1' }],
    });
  });

  it('maps completeSession /sessions result to assessment result shape', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        session_id: 's3',
        assessment_type: 'holland',
        started_at: '2026-01-01T00:00:00Z',
        status: 'in_progress',
        questions: [],
      },
    });
    await assessmentService.startSession({ testType: 'holland', ageBand: '18-24' });

    postMock.mockResolvedValueOnce({
      data: {
        session_id: 's3',
        assessment_type: 'holland',
        code: 'RIA',
        certainty: null,
        normalized_scores: { R: 55, I: 25, A: 20 },
        computed_at: '2026-01-01T00:10:00Z',
      },
    });

    const result = await assessmentService.completeSession('s3');
    expect(postMock).toHaveBeenNthCalledWith(2, '/sessions/s3/complete');
    expect(result.holland?.top3Code).toBe('RIA');
    expect(result.completedAt).toBe('2026-01-01T00:10:00Z');
  });

  it('uses mock path for combined testType', async () => {
    const session = await assessmentService.startSession({ testType: 'combined', ageBand: '18-24' });
    expect(postMock).not.toHaveBeenCalled();
    expect(session.sessionId).toBe('mock-session-id');
  });
});
