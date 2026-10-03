import { describe, expect, it } from 'vitest';
import { countSolutions } from '../src/core/brute';
import { allPuzzles, levelOf, poolSizes, puzzleFor, totalPuzzles } from '../src/core/daily';
import { weekdayOf } from '../src/core/date';
import { getHint } from '../src/core/hint';
import { LEVELS, SOLVE } from '../src/core/levels';
import { DOT, rectangles, startGrid, UNK, X, type Puzzle } from '../src/core/model';
import { makeRng } from '../src/core/rng';
import { solveLogically } from '../src/core/solver';

const ALL = allPuzzles();
const byLevel = (k: number) => ALL.filter((p) => p.level === k);

describe('stored puzzle set', () => {
  it('has at least 365 puzzles, at least 52 per weekday', () => {
    expect(totalPuzzles()).toBeGreaterThanOrEqual(365);
    for (const s of poolSizes()) expect(s).toBeGreaterThanOrEqual(52);
  });
  it('no duplicate puzzles', () => {
    const keys = new Set(ALL.map((p) => p.sol + p.givens.join(',')));
    expect(keys.size).toBe(ALL.length);
  });
  it('every daily number maps to its weekday level and size', () => {
    for (let num = 1; num <= 400; num++) {
      const p = puzzleFor(num);
      const lv = levelOf(num);
      expect(LEVELS[(weekdayOf(num) + 6) % 7].key).toBe(lv.key);
      expect(p.level).toBe(lv.key);
      expect(p.n).toBe(lv.n);
    }
    expect(levelOf(1).day).toBe('Saturday'); // #1 = Sat Oct 3, 2026
  });
});

function checkShape(p: Puzzle) {
  const n = p.n;
  const sol = Uint8Array.from(p.sol, (c) => (c === '1' ? DOT : UNK));
  expect(p.sol.length).toBe(n * n);
  expect(rectangles(n, sol)).toHaveLength(0);
  for (let r = 0; r < n; r++) expect([...p.sol.slice(r * n, r * n + n)].filter((c) => c === '1').length).toBe(p.rows[r]);
  for (let c = 0; c < n; c++) { let k = 0; for (let r = 0; r < n; r++) if (p.sol[r * n + c] === '1') k++; expect(k).toBe(p.cols[c]); }
  for (const i of p.givens) expect(p.sol[i]).toBe('1');
}

for (const L of LEVELS) {
  describe(`${L.day} puzzles (${L.n}x${L.n})`, () => {
    it('each is valid, has exactly one solution (brute force), and the logical solver reaches it without guessing', () => {
      expect(byLevel(L.key).length).toBeGreaterThanOrEqual(52);
      for (const p of byLevel(L.key)) {
        expect(p.n).toBe(L.n);
        checkShape(p);
        const b = countSolutions(p, 3);
        expect(b.count).toBe(1);
        expect(b.first).toBe(p.sol);
        const r = solveLogically(p, SOLVE);
        expect(r.solved).toBe(true);
        expect(Array.from(r.grid, (v) => (v === DOT ? '1' : '0')).join('')).toBe(p.sol);
        // every single deduction agrees with the unique solution
        for (const s of r.steps) for (const [i, v] of s.set) expect(v === DOT).toBe(p.sol[i] === '1');
      }
    }, 600_000);
    it('difficulty matches the weekday', () => {
      for (const p of byLevel(L.key)) {
        const easy = solveLogically(p, { maxTech: 'corner' }).solved;
        const noWhatif = solveLogically(p, { maxTech: 'pair' }).solved;
        if (L.key === 1 || L.key === 2) expect(easy).toBe(true); // Mon/Tue: basic rules only
        if (L.key >= 3) expect(easy).toBe(false); // Wed+: needs at least a squeeze
        if (L.key === 4 || L.key === 5) { expect(noWhatif).toBe(true); expect(solveLogically(p, { maxTech: 'squeeze' }).solved).toBe(false); }
        if (L.key >= 6) expect(noWhatif).toBe(false); // Sat/Sun: a what-if is needed
      }
    }, 600_000);
  });
}

describe('hints', () => {
  it('following hints from the start always solves the puzzle, and every hinted mark is correct', () => {
    let total = 0;
    for (const p of ALL.filter((_, k) => k % 3 === 0)) {
      const g = startGrid(p);
      for (let guard = 0; guard < 200; guard++) {
        if ([...g].every((v, i) => (v === DOT) === (p.sol[i] === '1') && (v !== UNK || p.sol[i] === '0'))) break;
        const h = getHint(p, g);
        if (h === null) break; // only "line is full" crosses left: dots are complete
        expect(h!.kind).toBe('step');
        if (h!.kind === 'step') expect(h!.step.tech).not.toBe('full');
        if (h!.kind !== 'step') break;
        expect(h!.text.length).toBeGreaterThan(20);
        for (const [i, v] of h!.step.set) { expect(v === DOT).toBe(p.sol[i] === '1'); g[i] = v; }
        if (![...g].includes(UNK)) break;
      }
      expect([...g].map((v) => (v === DOT ? '1' : '0')).join('')).toBe(p.sol);
      total++;
    }
    expect(total).toBeGreaterThan(100);
  }, 600_000);
  it('from random correct partial positions, the hint is a valid deduction', () => {
    const rng = makeRng('hint-fuzz');
    for (const p of ALL.filter((_, k) => k % 5 === 0)) {
      const g = startGrid(p);
      for (let i = 0; i < p.n * p.n; i++) if (g[i] === UNK && rng.chance(0.35)) g[i] = p.sol[i] === '1' ? DOT : X;
      const h = getHint(p, g);
      if ([...g].includes(UNK) && [...g].some((v, i) => v !== DOT && p.sol[i] === '1')) {
        expect(h).not.toBeNull();
        expect(['step', 'reveal']).toContain(h!.kind);
        if (h!.kind === 'step' || h!.kind === 'reveal') for (const [i, v] of h!.step.set) expect(v === DOT).toBe(p.sol[i] === '1');
      }
    }
  }, 600_000);
  it('a wrong mark is pointed out, and a rectangle is flagged as a conflict', () => {
    const p = ALL[0];
    const g = startGrid(p);
    const wrong = [...p.sol].findIndex((c) => c === '0');
    g[wrong] = DOT;
    const h = getHint(p, g)!;
    expect(['wrong', 'conflict']).toContain(h.kind);
    if (h.kind === 'wrong') expect(h.cells).toContain(wrong);
  });
});
