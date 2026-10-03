import { generate } from '../src/core/gen';
import { solveLogically } from '../src/core/solver';
import { DOT, X, startGrid } from '../src/core/model';
const [seed, n, d, wd] = [process.argv[2] ?? 'x', Number(process.argv[3] ?? 6), Number(process.argv[4] ?? 0.4), Number(process.argv[5] ?? 4)];
const p = generate(seed, { n, density: d, solve: { whatifDepth: wd } })!;
const draw = (g: ArrayLike<number>, mark?: number[]) => {
  let s = '    ' + p.cols.join(' ') + '\n';
  for (let r = 0; r < n; r++) { s += ` ${p.rows[r]}  `; for (let c = 0; c < n; c++) { const i = r * n + c; s += (mark?.includes(i) ? '*' : g[i] === DOT ? (p.givens.includes(i) ? '@' : '●') : g[i] === X ? '·' : '_') + ' '; } s += '\n'; }
  return s;
};
console.log(JSON.stringify(p.grade));
console.log(draw(startGrid(p)));
const r = solveLogically(p, { whatifDepth: wd });
const g = startGrid(p);
for (const s of r.steps) {
  if (s.tech !== 'full' && s.tech !== 'fill' || process.env.ALL) { console.log(`[${s.tech}] ${s.text}`); console.log(draw(g, s.set.map(([i]) => i))); }
  for (const [i, v] of s.set) g[i] = v;
}
console.log(draw(g));
