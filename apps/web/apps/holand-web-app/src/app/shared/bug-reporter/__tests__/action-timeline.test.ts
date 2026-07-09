import { describe, expect, it } from 'vitest';
import type { BugReportAction } from '../types';

describe('BugReportAction types', () => {
  it('note action has correct shape', () => {
    const note: BugReportAction = {
      type: 'note',
      text: 'This is a note',
      timestamp: Date.now(),
    };

    expect(note.type).toBe('note');
    expect(note.text).toBe('This is a note');
    expect(typeof note.timestamp).toBe('number');
  });

  it('all action types are discriminated correctly', () => {
    const actions: BugReportAction[] = [
      { type: 'click', target: 'button', timestamp: 1 },
      { type: 'navigation', from: '/a', to: '/b', timestamp: 2 },
      { type: 'error', message: 'oops', timestamp: 3 },
      { type: 'api_call', id: 'api-1', url: '/api/test', endpoint: '/api/test', method: 'GET', status: 200, timestamp: 4 },
      { type: 'state_change', component: 'Button', change: 'disabled', timestamp: 5 },
      { type: 'note', text: 'user note', timestamp: 6 },
    ];

    expect(actions).toHaveLength(6);
    expect(actions.map((a) => a.type)).toEqual([
      'click',
      'navigation',
      'error',
      'api_call',
      'state_change',
      'note',
    ]);
  });

  it('can filter and remove actions by index', () => {
    const actions: BugReportAction[] = [
      { type: 'click', target: 'btn', timestamp: 1 },
      { type: 'navigation', from: '/a', to: '/b', timestamp: 2 },
      { type: 'note', text: 'my note', timestamp: 3 },
    ];

    const withoutFirst = actions.filter((_, i) => i !== 0);
    expect(withoutFirst).toHaveLength(2);
    expect(withoutFirst[0].type).toBe('navigation');
  });

  it('can add a note action to existing list', () => {
    const actions: BugReportAction[] = [
      { type: 'click', target: 'btn', timestamp: 1 },
    ];

    const note: BugReportAction = { type: 'note', text: 'something important', timestamp: 2 };
    const updated = [...actions, note];

    expect(updated).toHaveLength(2);
    expect(updated[1].type).toBe('note');
    expect((updated[1] as Extract<BugReportAction, { type: 'note' }>).text).toBe('something important');
  });
});

describe('BugReportCaptureMode', () => {
  it('manual captureMode is a valid string literal', () => {
    const mode = 'manual' as 'manual' | 'rolling_buffer';
    expect(mode).toBe('manual');
  });
});
