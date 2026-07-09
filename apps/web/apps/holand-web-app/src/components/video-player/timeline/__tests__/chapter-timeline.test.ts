import { describe, it, expect } from 'vitest';

describe('chapter timeline math', () => {
  const chapters = [
    { id: '1', title: 'Intro', start: 0 },
    { id: '2', title: 'Scene', start: 120 },
  ];

  it('computes marker positions as percentage of duration', () => {
    const duration = 600;
    const positions = chapters.map((ch) => (ch.start / duration) * 100);
    expect(positions[0]).toBe(0);
    expect(positions[1]).toBe(20);
  });

  it('detects active chapter from current time', () => {
    const currentTime = 150;
    const active = chapters.find(
      (ch, i) =>
        currentTime >= ch.start &&
        (chapters[i + 1] ? currentTime < chapters[i + 1]!.start : true)
    );
    expect(active?.id).toBe('2');
  });
});
