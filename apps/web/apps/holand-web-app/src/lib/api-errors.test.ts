import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { classifyApiError } from './api-errors';
import { GatewayToolError } from '@/utils/gateway-tool-success';

function makeAxiosError(status: number, data?: unknown): AxiosError {
  const err = new AxiosError('fail', undefined, undefined, undefined, {
    status,
    data,
    headers: {},
    statusText: '',
    config: { headers: new AxiosHeaders() },
  });
  return err;
}

describe('classifyApiError', () => {
  it('classifies 429 as rate_limited and retryable', () => {
    const c = classifyApiError(makeAxiosError(429));
    expect(c.category).toBe('rate_limited');
    expect(c.retryable).toBe(true);
  });

  it('classifies 404 as not_found', () => {
    const c = classifyApiError(makeAxiosError(404, { detail: 'Not found' }));
    expect(c.category).toBe('not_found');
    expect(c.message).toContain('Not found');
  });

  it('classifies 500 as server retryable', () => {
    const c = classifyApiError(makeAxiosError(503));
    expect(c.category).toBe('server');
    expect(c.retryable).toBe(true);
  });

  it('classifies GatewayToolError 401 as unauthorized', () => {
    const c = classifyApiError(new GatewayToolError('tool-runner auth', 401));
    expect(c.category).toBe('unauthorized');
    expect(c.status).toBe(401);
    expect(c.message).toBe('tool-runner auth');
  });
});
