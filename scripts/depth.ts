// Depth study: generate many puzzles per size/density and report technique mix.
import { generate } from '../src/core/gen';
import { solveLogically, TECHS, type Tech } from '../src/core/solver';

const N = Number(process.argv[2] ?? 6), DENS = Number(process.argv[3] ?? 0.4), K = Number(process.argv[4] ?? 60), WD = Number(process.argv[5] ?? 6);
const out: any[] = [];
let nulls = 0;
const t0 = Date.now();
for (let s = 0; s < K; s++) {
  const p = generate(`d${N}-${DENS}-${s}`, { n: N, density: DENS, solve: { whatifDepth: WD } });
  if (!p) { nulls++; continue; }
  // also: can it be solved without what-if? without pair? without squeeze?
  const lv = (['corner', 'squeeze', 'pair'] as Tech[]).map((t) => solveLogically(p, { maxTech: t }).solved);
  const wd = Math.max(0, ...solveLogically(p, { whatifDepth: WD }).steps.filter((x) => x.tech === 'whatif').map((x) => x.depth ?? 0));
  out.push({ g: p.grade!, givens: p.givens.length, dots: p.rows.reduce((a, b) => a + b, 0), lv, wd });
}
const pct = (f: (o: any) => boolean) => ((100 * out.filter(f).length) / out.length).toFixed(0) + '%';
console.log(`n=${N} dens=${DENS} ok=${out.length} null=${nulls} time=${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log('avg dots', (out.reduce((a, o) => a + o.dots, 0) / out.length).toFixed(1), 'avg givens', (out.reduce((a, o) => a + o.givens, 0) / out.length).toFixed(1), 'avg steps', (out.reduce((a, o) => a + o.g.steps, 0) / out.length).toFixed(1));
console.log('top tech:', TECHS.map((t) => `${t} ${pct((o) => o.g.top === t)}`).join(' | '));
console.log('uses   :', TECHS.map((t) => `${t} ${pct((o) => (o.g.counts[t] ?? 0) > 0)}`).join(' | '));
console.log('avg cnt:', TECHS.map((t) => `${t} ${(out.reduce((a, o) => a + (o.g.counts[t] ?? 0), 0) / out.length).toFixed(1)}`).join(' | '));
console.log('needs >corner', pct((o) => !o.lv[0]), ' needs >squeeze', pct((o) => !o.lv[1]), ' needs whatif', pct((o) => !o.lv[2]));
console.log('distinct techs/puzzle', (out.reduce((a, o) => a + Object.keys(o.g.counts).length, 0) / out.length).toFixed(2), ' max whatif depth avg', (out.reduce((a, o) => a + o.wd, 0) / out.length).toFixed(1));
console.log('score min/med/max', (() => { const s = out.map((o) => o.g.score).sort((a, b) => a - b); return [s[0], s[s.length >> 1], s[s.length - 1]].join(' / '); })());
