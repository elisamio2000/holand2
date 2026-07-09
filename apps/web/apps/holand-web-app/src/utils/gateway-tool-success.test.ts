import { describe, expect, it } from 'vitest';
import {
  assertGatewayToolSuccess,
  GatewayToolError,
  isGatewayToolError,
} from './gateway-tool-success';

describe('assertGatewayToolSuccess', () => {
  it('does not throw for successful response', () => {
    const response = { data: { result: { ok: true } } };
    expect(() => assertGatewayToolSuccess(response)).not.toThrow();
  });

  it('does not throw when data is undefined', () => {
    expect(() => assertGatewayToolSuccess({})).not.toThrow();
  });

  it('throws for error field in 200 body', () => {
    const response = {
      data: {
        error: 'HTTP_ERROR',
        status_code: 401,
        message: 'Unauthorized',
      },
    };
    expect(() => assertGatewayToolSuccess(response)).toThrow(GatewayToolError);
    expect(() => assertGatewayToolSuccess(response)).toThrow('Unauthorized');
  });

  it('throws for status_code >= 400 without error field', () => {
    const response = {
      data: { status_code: 500, message: 'Server error' },
    };
    expect(() => assertGatewayToolSuccess(response)).toThrow('Server error');
  });

  it('uses default message when body has no message', () => {
    const response = { data: { error: 'TOOL_ERROR', status_code: 403 } };
    try {
      assertGatewayToolSuccess(response);
      expect.fail('expected throw');
    } catch (err) {
      expect(isGatewayToolError(err)).toBe(true);
      if (isGatewayToolError(err)) {
        expect(err.message).toBe('TOOL_ERROR');
        expect(err.statusCode).toBe(403);
      }
    }
  });
});

describe('isGatewayToolError', () => {
  it('returns true for GatewayToolError', () => {
    expect(isGatewayToolError(new GatewayToolError('x', 401))).toBe(true);
  });

  it('returns false for generic Error', () => {
    expect(isGatewayToolError(new Error('x'))).toBe(false);
  });
});
