// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('../use-expert-lab', () => ({
  useExpertLab: () => ({
    drafts: [],
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    createDraft: vi.fn(),
    addRevision: vi.fn(),
    submitForReview: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    publish: vi.fn(),
  }),
}));

import { ExpertLabDashboard } from '../index';

describe('ExpertLabDashboard', () => {
  it('renders empty state', () => {
    render(<ExpertLabDashboard />);
    expect(screen.getByText('expertLab.title')).toBeTruthy();
    expect(screen.getByText('expertLab.empty')).toBeTruthy();
  });
});
