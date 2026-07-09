import { describe, expect, it } from 'vitest';
import { maskSensitiveData } from '../interceptors/network-interceptor';

describe('network-interceptor PII masking', () => {
  it('masks sensitive object keys', () => {
    const masked = maskSensitiveData(
      { username: 'alex', password: 'secret123', token: 'abc' },
      true
    ) as Record<string, string>;
    expect(masked.username).toBe('alex');
    expect(masked.password).toBe('***');
    expect(masked.token).toBe('***');
  });

  it('returns data unchanged when masking disabled', () => {
    const input = { password: 'secret123' };
    expect(maskSensitiveData(input, false)).toEqual(input);
  });
});
