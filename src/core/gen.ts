/** Puzzle generator: random rectangle-free solution -> counts -> givens until unique & logically solvable -> minimise. */
import { countSolutions } from './brute';
import { DOT, UNK, type Grade, type Puzzle } from './model';
import { makeRng, type Rng } from './rng';
import { solveLogically, TECH_RANK, type SolveOpts, type Step, type Tech } from './solver';

export function randomSolution(n: number, rng: Rng, density: number): string {
  const g = new Uint8Array(n * n);
  const order = rng.shuffle([...Array(n * n).keys()]);
  const target = Math.round(density * n * n);
  let placed = 0;
  for (const i of order) {
    if (placed >= target) break;
    const r = Math.floor(i / n), c = i % n;
    let ok = true;
    for (let r2 = 0; r2 < n && ok; r2++) {
      if (r2 === r || g[r2 * n + c] !== DOT) continue;
      for (let c2 = 0; c2 < n; c2++) if (c2 !== c && g[r * n + c2] === DOT && g[r2 * n + c2] === DOT) { ok = false; break; }
    }
    if (ok) { g[i] = DOT; placed++; }
  }
  return Array.from(g, (v) => (v === DOT ? '1' : '0')).join('');
}

export function countsOf(n: number, sol: string) {
  const rows = new Array(n).fill(0), cols = new Array(n).fill(0);
  for (let i = 0; i < n * n; i++) if (sol[i] === '1') { rows[Math.floor(i / n)]++; cols[i % n]++; }
  return { rows, cols };
}

const W: Record<Tech, number> = { full: 0, fill: 0.5, corner: 1, squeeze: 4, pair: 6, whatif: 10 };
export function grade(steps: Step[]): Grade {
  const counts: Record<string, number> = {};
  let top: Tech = 'full', score = 0;
  for (const s of steps) {
    counts[s.tech] = (counts[s.tech] ?? 0) + 1;
    if (TECH_RANK[s.tech] > TECH_RANK[top]) top = s.tech;
    score += W[s.tech] + (s.tech === 'whatif' ? 2 * (s.depth ?? 1) : 0);
  }
  return { steps: steps.length, counts, top, score: Math.round(score * 10) / 10 };
}

export interface GenOpts { n: number; density: number; solve: SolveOpts; minimise?: boolean; greedy?: boolean; noHelp?: boolean }
export function generate(seed: number | string, o: GenOpts): Puzzle | null {
  const rng = makeRng(seed);
  const { n } = o;
  const sol = randomSolution(n, rng, o.density);
  const { rows, cols } = countsOf(n, sol);
  if (rows.some((x) => x === 0) || cols.some((x) => x === 0)) return null;
  const dots = [...sol].flatMap((ch, i) => (ch === '1' ? [i] : []));
  const givens: number[] = [];
  const base = { n, rows, cols, sol };
  const ok = (gv: number[]) => {
    const p: Puzzle = { ...base, givens: gv };
    if (countSolutions(p, 2).count !== 1) return false;
    return solveLogically(p, o.solve).solved;
  };
  // add givens until unique and solvable within the allowed techniques
  for (let guard = 0; guard < n * n; guard++) {
    const p: Puzzle = { ...base, givens };
    const cnt = countSolutions(p, 2).count;
    if (cnt === 1) {
      const r = solveLogically(p, o.solve);
      if (r.solved) break;
      if (o.noHelp) return null;
      // help the solver: reveal a solution dot it could not reach
      const cand = dots.filter((i) => r.grid[i] === UNK);
      if (!cand.length) return null;
      givens.push(rng.pick(cand));
    } else {
      if (o.noHelp && guard > 3 * n) return null;
      const cand = dots.filter((i) => !givens.includes(i));
      if (!cand.length) return null;
      if (o.greedy) {
        // pick the given that leaves the fewest solutions (ties broken by the rng order)
        let best = cand[0], bc = Infinity;
        for (const i of rng.shuffle(cand)) {
          const c = countSolutions({ ...base, givens: [...givens, i] }, 60).count;
          if (c < bc) { bc = c; best = i; }
        }
        givens.push(best);
      } else givens.push(rng.pick(cand));
    }
  }
  if (!ok(givens)) return null;
  if (o.minimise !== false) {
    for (const i of rng.shuffle([...givens])) {
      const t = givens.filter((x) => x !== i);
      if (ok(t)) givens.splice(givens.indexOf(i), 1);
    }
  }
  const p: Puzzle = { ...base, givens: givens.sort((a, b) => a - b) };
  p.grade = grade(solveLogically(p, o.solve).steps);
  return p;
}
