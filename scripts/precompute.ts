// Usage: tsx scripts/precompute.ts <levelKey 1-7> <count> [seedOffset] -> scripts/pool-L<k>.json
import { writeFileSync } from 'node:fs';
import { generate } from '../src/core/gen';
import { LEVELS, SOLVE } from '../src/core/levels';
import { solveLogically } from '../src/core/solver';
const key = Number(process.argv[2]), want = Number(process.argv[3] ?? 60), off = Number(process.argv[4] ?? 0);
const L = LEVELS[key - 1];
const out: any[] = [];
const seen = new Set<string>();
let tries = 0;
const t0 = Date.now();
for (let s = off; out.length < want; s++) {
  tries++;
  const p = generate(`corners-L${key}-${s}`, { n: L.n, density: L.density, solve: SOLVE, greedy: true, noHelp: L.noHelp });
  if (!p || seen.has(p.sol)) continue;
  const steps = solveLogically(p, SOLVE).steps;
  const wmax = Math.max(0, ...steps.filter((x) => x.tech === 'whatif').map((x) => x.depth ?? 0));
  if (!L.accept(p.grade!, wmax)) continue;
  seen.add(p.sol);
  out.push({ n: p.n, rows: p.rows, cols: p.cols, givens: p.givens, sol: p.sol, level: key, grade: p.grade, wmax, seed: s });
  if (out.length % 10 === 0) console.log(`L${key}: ${out.length}/${want} after ${tries} tries, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
writeFileSync(`scripts/pool-L${key}.json`, JSON.stringify(out));
console.log(`L${key} done: ${out.length} puzzles from ${tries} tries in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
