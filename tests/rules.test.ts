import { describe, expect, it } from 'vitest';
import { decodeChallenge, encodeChallenge } from '../src/core/challenge';
import { formatTime, puzzleNumberFor, weekdayOf } from '../src/core/date';
import { conflicts, DOT, rectangles, satisfies, X, type Puzzle } from '../src/core/model';
import { headline, shareText } from '../src/core/share';
import { computeStats } from '../src/core/stats';
import { solveLogically, nextStep } from '../src/core/solver';

// The tiny example from the intro: 3x3, every count 2.
const tiny: Puzzle = { n: 3, rows: [2, 2, 2], cols: [2, 2, 2], givens: [], sol: '110101011' };
const G = (s: string) => Uint8Array.from(s, (c) => (c === '1' ? DOT : c === 'x' ? X : 0));

describe('rule', () => {
  it('detects rectangles of any size', () => {
    expect(rectangles(3, G('110110000'))).toHaveLength(1);
    expect(rectangles(3, G('101000101'))).toHaveLength(1); // corners of the whole board
    expect(rectangles(3, G('110101011'))).toHaveLength(0);
  });
  it('the intro example is a valid solution; a rectangle version is not', () => {
    expect(satisfies(tiny, G('110101011'))).toBe(true);
    expect(satisfies(tiny, G('110110011'))).toBe(false);
  });
  it('conflicts: rectangle corners, over-full lines, and lines that can no longer fit', () => {
    const c = conflicts(tiny, G('110110000'));
    expect(c.rects).toHaveLength(1);
    expect([...c.cells].sort()).toEqual([0, 1, 3, 4]);
    expect(conflicts(tiny, G('111000000')).over).toContain(0);
    expect(conflicts(tiny, G('xx0000000')).short).toContain(0);
    expect(conflicts(tiny, G('110000000')).cells.size).toBe(0);
  });
  it('the logical solver explains a corner deduction', () => {
    const g = G('110100000');
    const s = nextStep(tiny, g)!;
    expect(['full', 'corner', 'fill']).toContain(s.tech);
    expect(solveLogically({ ...tiny, givens: [0, 1, 3] }).solved).toBe(true);
  });
});

describe('share, challenge, streaks, dates', () => {
  it('share text is spoiler-free and in the agreed format', () => {
    expect(headline(12, { secs: 221, hints: 0, mistakes: 0 })).toBe('CORNERS #12 ⭐ 3:41 · no hints');
    expect(headline(12, { secs: 302, hints: 2, mistakes: 1 })).toBe('CORNERS #12 ✓ 5:02 · 2 hints · 1 slip');
    const t = shareText(12, 'Sunday', 7, { secs: 221, hints: 0, mistakes: 0 }, 'https://x.y/', 4);
    expect(t.split('\n')).toEqual(['CORNERS #12 ⭐ 3:41 · no hints', 'Sunday ●●●●●●● · 🔥4', 'https://x.y/']);
    expect(t).not.toMatch(/[01]{5}/);
  });
  it('challenge links round-trip and reject junk', () => {
    const c = { n: 7, secs: 245, hints: 1, mistakes: 0, by: 'Thomas' };
    expect(decodeChallenge(encodeChallenge(c))).toEqual(c);
    expect(decodeChallenge('garbage!!')).toBeNull();
  });
  it('streak counts consecutive solved days ending today or yesterday', () => {
    const r = (level = 1) => ({ secs: 100, hints: 0, mistakes: 0, level, at: 0 });
    expect(computeStats({ 3: r(), 4: r(), 5: r() }, 5).streak).toBe(3);
    expect(computeStats({ 3: r(), 4: r() }, 5).streak).toBe(2);
    expect(computeStats({ 1: r(), 3: r(), 4: r() }, 4).maxStreak).toBe(2);
  });
  it('dates: #1 is Saturday Oct 3, 2026', () => {
    expect(puzzleNumberFor(new Date(2026, 9, 3, 12))).toBe(1);
    expect(puzzleNumberFor(new Date(2026, 9, 4, 0, 1))).toBe(2);
    expect(weekdayOf(1)).toBe(6);
    expect(weekdayOf(2)).toBe(0);
    expect(formatTime(221)).toBe('3:41');
  });
});
