import { describe, expect, it } from 'vitest';
import {
  EMPTY_TASKS_PARAMS,
  stableParamsKey,
  tasksCacheKey,
} from '@/app/shared/projects/utils/stable-params';
import { emitProjectsEvent, subscribeProjectsEvents } from '@/app/shared/projects/realtime/projects-event-bus';

describe('stableParamsKey', () => {
  it('produces stable keys regardless of key order', () => {
    expect(stableParamsKey({ a: 1, b: 2 })).toBe(stableParamsKey({ b: 2, a: 1 }));
  });

  it('omits empty values', () => {
    expect(stableParamsKey({ q: '', status: undefined })).toBe('{}');
  });

  it('EMPTY_TASKS_PARAMS has stable cache key', () => {
    const a = tasksCacheKey(EMPTY_TASKS_PARAMS);
    const b = tasksCacheKey({});
    expect(a).toBe(b);
  });
});

describe('projects-event-bus', () => {
  it('delivers emitted events to subscribers', () => {
    const received: string[] = [];
    const unsub = subscribeProjectsEvents((e) => received.push(e.type));
    emitProjectsEvent({ type: 'task.updated', taskId: 't1' });
    unsub();
    expect(received).toContain('task.updated');
  });
});
