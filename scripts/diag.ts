import { generate } from '../src/core/gen';
import { solveLogically } from '../src/core/solver';
const n = Number(process.argv[2]), d = Number(process.argv[3]), K = Number(process.argv[4]), noHelp = process.argv[5] === '1', greedy = process.argv[6] !== '0';
let nul = 0; const t0 = Date.now();
for (let s = 0; s < K; s++) {
  const p = generate(`diag-${n}-${d}-${s}`, { n, density: d, solve: { whatifDepth: 3 }, greedy, noHelp });
  if (!p) { nul++; continue; }
  const steps = solveLogically(p, { whatifDepth: 3 }).steps;
  const w = steps.filter((x) => x.tech === 'whatif').map((x) => x.depth);
  console.log(s, p.givens.length, JSON.stringify(p.grade!.counts), 'score', p.grade!.score, 'whatif depths', w.join(','));
}
console.log('null', nul, 'time', (Date.now() - t0) / 1000);
