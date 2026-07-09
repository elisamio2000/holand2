import { describe, it, expect } from 'vitest';
import { vpTokens } from '../../helpers/variant-visual-tokens';

describe('variant-visual-tokens', () => {
  it('exports core layout class bundles', () => {
    expect(vpTokens.listRow).toContain('rounded-xl');
    expect(vpTokens.miniCard).toContain('border-muted');
    expect(vpTokens.playFab).toContain('rounded-full');
    expect(vpTokens.pipShell).toContain('fixed');
  });
});
