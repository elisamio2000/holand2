// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { ImageHitCard } from '../image-hit-card';
import type { OneSearchHit } from '@/types/one-search.types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));

vi.mock('../search-hit-thumbnail', () => ({
  SearchHitThumbnail: () => <div data-testid="thumb" />,
}));

vi.mock('../hit-match-badges', () => ({
  HitMatchBadges: () => null,
}));

const hit: OneSearchHit = {
  id: 'img-1',
  title: 'Sample image',
  href: '/files/1',
  score: 0.82,
  meta: { width: 800, height: 600, mime_type: 'image/jpeg', size_bytes: 1024 },
};

function overlayAriaHidden(container: HTMLElement): string | null {
  return container.querySelector('[aria-hidden]')?.getAttribute('aria-hidden') ?? null;
}

describe('ImageHitCard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps metadata overlay hidden until 400ms hover', () => {
    const { container } = render(<ImageHitCard hit={hit} />);
    expect(overlayAriaHidden(container)).toBe('true');

    const button = container.querySelector('button')!;
    fireEvent.mouseEnter(button);

    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(overlayAriaHidden(container)).toBe('true');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(overlayAriaHidden(container)).toBe('false');
  });

  it('hides overlay on mouse leave', () => {
    const { container } = render(<ImageHitCard hit={hit} />);
    const button = container.querySelector('button')!;
    fireEvent.mouseEnter(button);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(overlayAriaHidden(container)).toBe('false');

    fireEvent.mouseLeave(button);
    expect(overlayAriaHidden(container)).toBe('true');
  });
});
