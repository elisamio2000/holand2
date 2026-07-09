// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

import { StatusBadge } from '../status-badge';

describe('StatusBadge', () => {
  it('renders localized status key', () => {
    render(<StatusBadge status="in_review" />);
    expect(screen.getByTestId('status-badge').textContent).toBe('expertLab.status.in_review');
  });
});
