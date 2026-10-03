// Print a human-readable solve trace of stored puzzle #num: tsx scripts/trace.ts <num> [all]
import { puzzleFor, levelOf } from '../src/core/daily';
import { DOT, X, startGrid } from '../src/core/model';
import { solveLogically } from '../src/core/solver';
import { SOLVE } from '../src/core/levels';
const num = Number(process.argv[2]); const all = process.argv[3] === 'all';
const p = puzzleFor(num); const n = p.n;
const draw = (g: ArrayLike<number>, mark: number[] = []) => {
  let s = '      ' + p.cols.map((c, k) => String.fromCharCode(97 + k)).join(' ') + '\n      ' + p.cols.join(' ') + '\n';
  for (let r = 0; r < n; r++) { s += ` ${r + 1}: ${p.rows[r]}  `; for (let c = 0; c < n; c++) { const i = r * n + c; s += (mark.includes(i) ? (g[i] === DOT ? '◉' : '✕') : g[i] === DOT ? (p.givens.includes(i) ? '@' : '●') : g[i] === X ? '·' : '_') + ' '; } s += '\n'; }
  return s;
};
console.log(`#${num} ${levelOf(num).day}`, JSON.stringify(p.rows), JSON.stringify(p.cols));
console.log(draw(startGrid(p)));
const r = solveLogically(p, SOLVE);
const g = startGrid(p);
let k = 0;
for (const s of r.steps) {
  k++;
  for (const [i, v] of s.set) g[i] = v;
  const cells = s.set.map(([i]) => `${String.fromCharCode(97 + (i % n))}${Math.floor(i / n) + 1}`).join(' ');
  console.log(`${k}. [${s.tech}] -> ${s.set[0][1] === DOT ? 'dot' : 'empty'} ${cells}\n   ${s.text}`);
  if (all || !['full'].includes(s.tech)) console.log(draw(g, s.set.map(([i]) => i)));
}
