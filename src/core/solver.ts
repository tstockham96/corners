/**
 * Human-style logical solver for CORNERS. No search, no guessing: every step is one of the
 * named deductions below, each with a plain-words explanation (these double as the hints).
 *
 *   full    a line already has its dots            -> the rest of it is empty
 *   fill    a line's open cells exactly match need -> they are all dots
 *   corner  three corners of a rectangle are dots  -> the fourth cell is empty
 *   squeeze a line may use at most ONE of a parallel line's dot positions, so its other dots
 *           are forced into its few remaining cells
 *   pair    two parallel lines share at most one position, so together they need
 *           (a + b - 1) different positions; if that is all they have, every one is used
 *   whatif  a short "if this were a dot/empty..." chain of the easy rules hits a contradiction
 *
 * The solver always applies the easiest available deduction, so the list of steps is the
 * path a careful human would take, and its hardest step is the puzzle's difficulty.
 */
import { DOT, UNK, X, lineCells, lineNeed, lineName, LineName, type Puzzle } from './model';

export type Tech = 'full' | 'fill' | 'corner' | 'squeeze' | 'pair' | 'whatif';
export const TECHS: Tech[] = ['full', 'fill', 'corner', 'squeeze', 'pair', 'whatif'];
export const TECH_RANK: Record<Tech, number> = { full: 0, fill: 1, corner: 2, squeeze: 3, pair: 4, whatif: 5 };
export const TECH_NAME: Record<Tech, string> = {
  full: 'Full line', fill: 'Last spaces', corner: 'Corner', squeeze: 'Squeeze', pair: 'Pair count', whatif: 'What if',
};

export interface Step {
  tech: Tech;
  set: [number, 1 | 2][]; // cell, value
  focus: number[]; // cells that justify the step (highlight)
  lines: number[]; // lines involved (highlight)
  text: string; // plain-words explanation
  chain?: string[]; // for whatif: the short chain
  depth?: number; // for whatif: chain length
}

type G = Uint8Array;
const P = (p: Puzzle) => p;

function lineState(p: Puzzle, g: G, L: number) {
  const cs = lineCells(p.n, L);
  const dots: number[] = [], unk: number[] = [];
  for (const i of cs) { if (g[i] === DOT) dots.push(i); else if (g[i] === UNK) unk.push(i); }
  return { cs, dots, unk, need: lineNeed(p, L) };
}
const plural = (k: number, w: string) => `${k} ${w}${k === 1 ? '' : 's'}`;

// ------------------------------------------------------------------ the easy rules
function stepFull(p: Puzzle, g: G): Step | null {
  for (let L = 0; L < 2 * p.n; L++) {
    const s = lineState(p, g, L);
    if (s.unk.length && s.dots.length === s.need)
      return { tech: 'full', set: s.unk.map((i) => [i, X]), focus: s.dots, lines: [L],
        text: `${LineName(p.n, L)} already has its ${plural(s.need, 'dot')}, so the rest of it stays empty.` };
  }
  return null;
}
function stepFill(p: Puzzle, g: G): Step | null {
  for (let L = 0; L < 2 * p.n; L++) {
    const s = lineState(p, g, L);
    if (s.unk.length && s.dots.length + s.unk.length === s.need)
      return { tech: 'fill', set: s.unk.map((i) => [i, DOT]), focus: s.unk, lines: [L],
        text: `${LineName(p.n, L)} needs ${plural(s.need, 'dot')} and has exactly ${s.need === s.dots.length + s.unk.length && s.dots.length ? `${plural(s.unk.length, 'open cell')} left for the last ${s.unk.length}` : `${plural(s.need, 'open cell')}`}, so ${s.unk.length === 1 ? 'it is a dot' : 'they are all dots'}.` };
  }
  return null;
}
function stepCorner(p: Puzzle, g: G): Step | null {
  const { n } = p;
  for (let r1 = 0; r1 < n; r1++)
    for (let r2 = r1 + 1; r2 < n; r2++)
      for (let c1 = 0; c1 < n; c1++)
        for (let c2 = c1 + 1; c2 < n; c2++) {
          const q = [r1 * n + c1, r1 * n + c2, r2 * n + c1, r2 * n + c2];
          let d = 0, u = -1, nu = 0;
          for (const i of q) { if (g[i] === DOT) d++; else if (g[i] === UNK) { u = i; nu++; } }
          if (d === 3 && nu === 1)
            return { tech: 'corner', set: [[u, X]], focus: q.filter((i) => i !== u), lines: [],
              text: `These three dots are three corners of a rectangle. A dot here would complete it, so this cell stays empty.` };
        }
  return null;
}

// ------------------------------------------------------------------ squeeze & pair
/** Parallel line pairs: (A, B, position k) -> cells A[k], B[k]. */
function parallels(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (const base of [0, n]) for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (a !== b) out.push([base + a, base + b]);
  return out;
}
function stepSqueeze(p: Puzzle, g: G): Step | null {
  const { n } = p;
  for (const [A, B] of parallels(n)) {
    const ca = lineCells(n, A), cb = lineCells(n, B);
    const D: number[] = [];
    for (let k = 0; k < n; k++) if (g[ca[k]] === DOT) D.push(k);
    if (D.length < 2) continue;
    if (D.some((k) => g[cb[k]] === DOT)) continue; // then it is the corner rule
    const inOpen = D.filter((k) => g[cb[k]] === UNK);
    if (!inOpen.length) continue;
    const sb = lineState(p, g, B);
    const need = sb.need - sb.dots.length;
    const outOpen: number[] = [];
    for (let k = 0; k < n; k++) if (!D.includes(k) && g[cb[k]] === UNK) outOpen.push(k);
    if (outOpen.length && outOpen.length + 1 === need) {
      const kind = A < n ? 'column' : 'row';
      const nums = (ks: number[]) => ks.map((k) => k + 1);
      const and = (xs: number[]) => (xs.length === 1 ? `${xs[0]}` : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
      const rest = need - 1;
      return { tech: 'squeeze', set: outOpen.map((k) => [cb[k], DOT]), focus: D.map((k) => ca[k]), lines: [A, B],
        text: `${LineName(n, B)} can use at most one of ${lineName(n, A)}'s dot ${kind}s (${and(nums(D))}): two would make a rectangle. It still needs ${plural(need, 'dot')}, so ${rest === 1 ? 'the other one' : `the other ${rest}`} must go in ${outOpen.length === 1 ? `${kind} ${outOpen[0] + 1}, its only other open cell` : `${kind}s ${and(nums(outOpen))}, its only other open cells`}.` };
    }
  }
  return null;
}
function stepPair(p: Puzzle, g: G): Step | null {
  const { n } = p;
  for (const base of [0, n])
    for (let a = 0; a < n; a++)
      for (let b = a + 1; b < n; b++) {
        const A = base + a, B = base + b;
        const ca = lineCells(n, A), cb = lineCells(n, B);
        const na = lineNeed(p, A), nb = lineNeed(p, B);
        if (na < 2 || nb < 2) continue;
        let union = 0;
        const onlyA: number[] = [], onlyB: number[] = [];
        for (let k = 0; k < n; k++) {
          const oa = g[ca[k]] !== X, ob = g[cb[k]] !== X;
          if (oa || ob) union++;
          if (oa && !ob && g[ca[k]] === UNK) onlyA.push(ca[k]);
          if (ob && !oa && g[cb[k]] === UNK) onlyB.push(cb[k]);
        }
        if (union === na + nb - 1 && onlyA.length + onlyB.length) {
          const kind = A < n ? 'column' : 'row';
          const pos = (cells: number[]) => cells.map((i) => (A < n ? (i % n) + 1 : Math.floor(i / n) + 1));
          const list = (xs: number[]) => (xs.length === 1 ? `${kind} ${xs[0]}` : `${kind}s ${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
          const why: string[] = [];
          if (onlyB.length) why.push(`${LineName(n, A)} can't use ${list(pos(onlyB))}, so ${lineName(n, B)} must.`);
          if (onlyA.length) why.push(`${LineName(n, B)} can't use ${list(pos(onlyA))}, so ${lineName(n, A)} must.`);
          return { tech: 'pair', set: [...onlyA, ...onlyB].map((i) => [i, DOT]), focus: [], lines: [A, B],
            text: `${LineName(n, A)} and ${lineName(n, B)} need ${na} + ${nb} = ${na + nb} dots but can share at most one ${kind}, so together they must use ${na + nb - 1} different ${kind}s: every one of the ${union} still open to them. ${why.join(' ')}` };
        }
      }
  return null;
}

// ------------------------------------------------------------------ contradictions & what-if
export function contradiction(p: Puzzle, g: G): string | null {
  const { n } = p;
  for (let L = 0; L < 2 * n; L++) {
    const s = lineState(p, g, L);
    if (s.dots.length > s.need) return `${lineName(n, L)} would have too many dots`;
    if (s.dots.length + s.unk.length < s.need) return `${lineName(n, L)} could not get its ${plural(s.need, 'dot')}`;
  }
  for (let r1 = 0; r1 < n; r1++)
    for (let r2 = r1 + 1; r2 < n; r2++) {
      let common = 0;
      for (let c = 0; c < n; c++) if (g[r1 * n + c] === DOT && g[r2 * n + c] === DOT) common++;
      if (common >= 2) return `four dots would form a rectangle`;
    }
  return null;
}

const EASY = [stepFull, stepFill, stepCorner];
const short = (s: Step, n: number): string => {
  switch (s.tech) {
    case 'full': return `${lineName(n, s.lines[0])} is full`;
    case 'fill': return `${lineName(n, s.lines[0])} needs all its open cells`;
    case 'corner': return `a cell closes a rectangle`;
    case 'squeeze': return `${lineName(n, s.lines[1])} is squeezed`;
    default: return s.tech;
  }
};
/** Propagate with the given rules until stuck or broken. Returns chain + contradiction text. */
function propagate(p: Puzzle, g: G, rules: ((p: Puzzle, g: G) => Step | null)[], maxSteps: number) {
  const chain: Step[] = [];
  for (let t = 0; t < maxSteps; t++) {
    const bad = contradiction(p, g);
    if (bad) return { chain, bad };
    let s: Step | null = null;
    for (const r of rules) if ((s = r(p, g))) break;
    if (!s) return { chain, bad: null };
    for (const [i, v] of s.set) g[i] = v;
    chain.push(s);
  }
  return { chain, bad: contradiction(p, g) };
}
const posName = (n: number, i: number) => `row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}`;

function stepWhatIf(p: Puzzle, g: G, maxDepth: number, rules = EASY): Step | null {
  // depth = how many non-trivial deductions (anything but "line is full") the chain needs
  const { n } = p;
  let best: Step | null = null;
  for (let i = 0; i < n * n; i++) {
    if (g[i] !== UNK) continue;
    for (const v of [DOT, X] as const) {
      const h = g.slice();
      h[i] = v;
      const { chain, bad } = propagate(p, h, rules, 3 * maxDepth + 6);
      if (!bad) continue;
      const depth = chain.filter((s) => s.tech !== 'full').length;
      if (depth > maxDepth) continue;
      if (best && (depth > best.depth! || (depth === best.depth! && chain.length >= best.chain!.length))) continue;
      const other = v === DOT ? X : DOT;
      const parts = chain.map((s) => short(s, n));
      best = {
        tech: 'whatif', set: [[i, other]], focus: [i], lines: [], depth,
        chain: parts,
        text: `Suppose ${v === DOT ? 'this cell were a dot' : 'this cell stayed empty'}. ${parts.length ? `Then ${parts.join(', then ')}, and ` : 'Then '}${bad}. So it must be ${other === DOT ? 'a dot' : 'empty'}.`,
      };
    }
  }
  return best;
}

export interface SolveOpts { maxTech?: Tech; whatifDepth?: number }
/** The easiest available deduction from this position, or null if stuck. */
export function nextStep(p: Puzzle, g: G, opts: SolveOpts = {}): Step | null {
  const max = TECH_RANK[opts.maxTech ?? 'whatif'];
  const rules: [Tech, (p: Puzzle, g: G) => Step | null][] = [
    ['full', stepFull], ['fill', stepFill], ['corner', stepCorner], ['squeeze', stepSqueeze], ['pair', stepPair],
  ];
  for (const [t, r] of rules) {
    if (TECH_RANK[t] > max) break;
    const s = r(p, g);
    if (s) return s;
  }
  if (max >= TECH_RANK.whatif) return stepWhatIf(p, g, opts.whatifDepth ?? 3);
  return null;
}

export interface SolveResult { solved: boolean; steps: Step[]; grid: G; stuck?: boolean; broken?: string }
export function solveLogically(p: Puzzle, opts: SolveOpts = {}, start?: G): SolveResult {
  const g = start ? start.slice() : new Uint8Array(p.n * p.n);
  if (!start) for (const i of p.givens) g[i] = DOT;
  const steps: Step[] = [];
  for (let guard = 0; guard < 500; guard++) {
    const bad = contradiction(p, g);
    if (bad) return { solved: false, steps, grid: g, broken: bad };
    if (!g.includes(UNK)) return { solved: true, steps, grid: g };
    const s = nextStep(p, g, opts);
    if (!s) return { solved: false, steps, grid: g, stuck: true };
    for (const [i, v] of s.set) g[i] = v;
    steps.push(s);
  }
  return { solved: false, steps, grid: g, stuck: true };
}

export { P as _p };
