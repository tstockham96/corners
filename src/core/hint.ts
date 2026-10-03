/**
 * Gentle hints. From the player's current marks:
 *  1. a visible rule break  -> point at it;
 *  2. a mark that disagrees with the (unique) solution -> point at it, gently;
 *  3. otherwise the easiest next logical deduction, in plain words (this teaches the techniques).
 */
import { conflicts, DOT, X, UNK, type Puzzle } from './model';
import { SOLVE } from './levels';
import { nextStep, TECH_NAME, type Step } from './solver';

export type Hint =
  | { kind: 'conflict'; cells: number[]; title: string; text: string }
  | { kind: 'wrong'; cells: number[]; title: string; text: string }
  | { kind: 'step'; cells: number[]; title: string; text: string; step: Step }
  | { kind: 'reveal'; cells: number[]; title: string; text: string; step: Step };

export function getHint(p: Puzzle, grid: ArrayLike<number>): Hint | null {
  const g = Uint8Array.from(grid as ArrayLike<number>);
  const cf = conflicts(p, g);
  if (cf.cells.size || cf.short.length) {
    if (cf.rects.length) return { kind: 'conflict', cells: [...cf.cells], title: 'Rectangle', text: 'Four of your dots form a rectangle. One of them has to go.' };
    if (cf.over.length) return { kind: 'conflict', cells: [...cf.cells], title: 'Too many dots', text: 'A line has more dots than its number. Remove one.' };
    return { kind: 'conflict', cells: [], title: 'Too many ✕', text: 'A line has too many ✕ marks to fit its dots. Clear one.' };
  }
  const wrong: number[] = [];
  for (let i = 0; i < p.n * p.n; i++) {
    if (g[i] === DOT && p.sol[i] !== '1') wrong.push(i);
    if (g[i] === X && p.sol[i] === '1') wrong.push(i);
  }
  if (wrong.length) {
    const i = wrong[0];
    return { kind: 'wrong', cells: [i], title: 'Check this one', text: g[i] === DOT ? 'This dot does not fit the solution. Try clearing it.' : 'This ✕ is hiding a dot. Try clearing it.' };
  }
  // Empty cells are unknown; the player's dots and crosses are known. ✕ marks are optional notes,
  // so lines that already have all their dots are treated as closed silently (no "row 3 is full" hints).
  const h = g.slice();
  for (let k = 0; k < 4 * p.n; k++) { const f = nextStep(p, h, { maxTech: 'full' }); if (!f) break; for (const [i, v] of f.set) h[i] = v; }
  if (h.every((v, i) => (v === DOT) === (p.sol[i] === '1') && (v !== UNK || p.sol[i] !== '1')) && !h.includes(UNK)) return null;
  const s = nextStep(p, h, SOLVE);
  if (s) {
    const fresh = s.set.filter(([i]) => g[i] === UNK);
    return { kind: 'step', cells: fresh.map(([i]) => i), title: TECH_NAME[s.tech], text: s.text, step: s };
  }
  // fallback (should not happen for stored puzzles): reveal one dot
  for (let i = 0; i < p.n * p.n; i++) if (g[i] !== DOT && p.sol[i] === '1') {
    const step: Step = { tech: 'fill', set: [[i, DOT]], focus: [i], lines: [], text: 'Here is a free dot.' };
    return { kind: 'reveal', cells: [i], title: 'Free dot', text: step.text, step };
  }
  return null;
}
