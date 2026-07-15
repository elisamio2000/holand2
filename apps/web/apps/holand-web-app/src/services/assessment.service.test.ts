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

  it('maps combined startSession to /sessions/start and tags question test type by kind', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        session_id: 's4',
        assessment_type: 'combined',
        started_at: '2026-01-01T00:00:00Z',
        status: 'in_progress',
        questions: [
          {
            id: 'q1',
            kind: 'likert',
            dimension: 'R',
            text: 'holland question',
            order_index: 0,
            options: [{ id: 'o1', label: '1', value: 1, pole: 'R', order_index: 0 }],
          },
          {
            id: 'q2',
            kind: 'forced_choice',
            dimension: 'EI',
            text: 'mbti question',
            order_index: 0,
            options: [{ id: 'o2', label: 'A', value: 1, pole: 'E', order_index: 0 }],
          },
        ],
      },
    });

    const session = await assessmentService.startSession({ testType: 'combined', ageBand: '18-24' });
    expect(postMock).toHaveBeenCalledWith('/sessions/start', { assessment_type: 'combined' });
    expect(session.testType).toBe('combined');
    expect(session.questions[0].testType).toBe('holland');
    expect(session.questions[1].testType).toBe('mbti');
  });

  it('maps combined completeSession result to dual holland/mbti sections', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        session_id: 's5',
        assessment_type: 'combined',
        started_at: '2026-01-01T00:00:00Z',
        status: 'in_progress',
        questions: [],
      },
    });
    await assessmentService.startSession({ testType: 'combined', ageBand: '18-24' });

    postMock.mockResolvedValueOnce({
      data: {
        session_id: 's5',
        assessment_type: 'combined',
        code: 'RIA-INTJ',
        certainty: { mbti: { EI: 60 } },
        normalized_scores: {
          holland: { R: 55, I: 25, A: 20 },
          mbti: { EI: 60, SN: 55, TF: 70, JP: 65 },
        },
        holland: {
          code: 'RIA',
          normalized_scores: { R: 55, I: 25, A: 20 },
        },
        mbti: {
          code: 'INTJ',
          normalized_scores: { EI: 60, SN: 55, TF: 70, JP: 65 },
          certainty: { EI: 60 },
        },
        computed_at: '2026-01-01T00:10:00Z',
      },
    });

    const result = await assessmentService.completeSession('s5');
    expect(postMock).toHaveBeenNthCalledWith(2, '/sessions/s5/complete');
    expect(result.holland?.top3Code).toBe('RIA');
    expect(result.mbti?.typeCode).toBe('INTJ');
  });
});

it('resumes session state from /sessions/{id}/resume and maps answers', async () => {
  // start to seed sessionMeta and questions mapping
  postMock.mockResolvedValueOnce({
    data: {
      session_id: 's10',
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
          options: [{ id: 'o1', label: '1', value: 1 }],
        },
      ],
    },
  });

  await assessmentService.startSession({ testType: 'holland', ageBand: '18-24' });

  // Mock questions and resume endpoints
  getMock.mockImplementation((url: string) => {
    if (url.endsWith('/questions')) {
      return Promise.resolve({ data: [
        { id: 'q1', kind: 'likert', dimension: 'R', text: 'q', order_index: 0, options: [{ id: 'o1', label: '1', value: 1 }] }
      ]});
    }
    if (url.endsWith('/resume')) {
      return Promise.resolve({ data: {
        session_id: 's10',
        assessment_type: 'holland',
        status: 'in_progress',
        started_at: '2026-01-01T00:00:00Z',
        total_questions: 1,
        answered_count: 1,
        answers: [ { question_id: 'q1', option_id: 'o1', answered_at: '2026-01-01T00:01:00Z', revision_count: 0 } ]
      }});
    }
    if (url.endsWith('/sessions/s10')) {
      return Promise.resolve({ data: { status: 'in_progress', started_at: '2026-01-01T00:00:00Z' } });
    }
    return Promise.resolve({ data: {} });
  });

  const session = await assessmentService.getSession('s10');
  expect(session.questions.length).toBe(1);
  const resume = await assessmentService.resume('s10');
  expect(resume).not.toBeNull();
  expect(resume?.answers[0].option_id).toBe('o1');
});

it('submits events to /sessions/{id}/events and returns server reply', async () => {
  postMock.mockResolvedValueOnce({ data: { accepted: true, session_id: 's20', server_seq_start: 1, server_seq_end: 1, stored: 1 } });
  const payload = [{ event_type: 'question_view', question_id: 'q1' }];
  const res = await assessmentService.submitEvents('s20', payload as any);
  expect(postMock).toHaveBeenCalledWith('/sessions/s20/events', { events: payload });
  expect(res).toMatchObject({ accepted: true, session_id: 's20' });
});
