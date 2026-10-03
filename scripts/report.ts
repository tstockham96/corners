// Depth numbers for depth.md: stored daily set (per weekday) + the unfiltered generator.
import { allPuzzles } from '../src/core/daily';
import { generate } from '../src/core/gen';
import { LEVELS, SOLVE } from '../src/core/levels';
import { solveLogically, TECHS, type Tech } from '../src/core/solver';
import type { Puzzle } from '../src/core/model';

function stats(ps: Puzzle[]) {
  const rows = ps.map((p) => {
    const r = solveLogically(p, SOLVE);
    const c: Record<string, number> = {};
    for (const s of r.steps) c[s.tech] = (c[s.tech] ?? 0) + 1;
    const wd = Math.max(0, ...r.steps.filter((s) => s.tech === 'whatif').map((s) => s.depth ?? 0));
    const nontriv = r.steps.filter((s) => !['full', 'fill'].includes(s.tech)).length;
    const aha = (c.squeeze ?? 0) + (c.pair ?? 0) + (c.whatif ?? 0);
    const distinct = Object.keys(c).length;
    const ent = (() => { const t = r.steps.length; let h = 0; for (const k in c) { const q = c[k] / t; h -= q * Math.log2(q); } return h; })();
    return { c, wd, nontriv, aha, distinct, steps: r.steps.length, givens: p.givens.length, dots: p.rows.reduce((a, b) => a + b, 0), ent,
      needs: { corner: !solveLogically(p, { maxTech: 'fill' }).solved, squeeze: !solveLogically(p, { maxTech: 'corner' }).solved, pair: !solveLogically(p, { maxTech: 'squeeze' }).solved, whatif: !solveLogically(p, { maxTech: 'pair' }).solved } };
  });
  const avg = (f: (r: any) => number) => (rows.reduce((a, r) => a + f(r), 0) / rows.length).toFixed(1);
  const pct = (f: (r: any) => boolean) => `${Math.round((100 * rows.filter(f).length) / rows.length)}%`;
  return { k: rows.length, givens: avg((r) => r.givens), dots: avg((r) => r.dots), steps: avg((r) => r.steps), nontriv: avg((r) => r.nontriv), aha: avg((r) => r.aha), distinct: avg((r) => r.distinct), ent: avg((r) => r.ent), wd: avg((r) => r.wd),
    uses: Object.fromEntries(TECHS.map((t) => [t, pct((r) => (r.c[t] ?? 0) > 0)])), avgc: Object.fromEntries(TECHS.map((t) => [t, avg((r) => r.c[t] ?? 0)])),
    needCorner: pct((r) => r.needs.corner), needSqueeze: pct((r) => r.needs.squeeze), needPair: pct((r) => r.needs.pair), needWhatif: pct((r) => r.needs.whatif) };
}
const all = allPuzzles();
console.log('## Stored daily set');
console.log('| Day | n | puzzles | dots | givens | steps | non-trivial steps | aha steps (squeeze+pair+what-if) | distinct techniques | full/fill/corner/squeeze/pair/whatif avg | max what-if depth |');
for (const L of LEVELS) {
  const s = stats(all.filter((p) => p.level === L.key));
  console.log(`| ${L.day} | ${L.n} | ${s.k} | ${s.dots} | ${s.givens} | ${s.steps} | ${s.nontriv} | ${s.aha} | ${s.distinct} | ${TECHS.map((t) => s.avgc[t]).join(' / ')} | ${s.wd} |`);
}
const S = stats(all);
console.log('all', JSON.stringify(S));
console.log('\n## Unfiltered generator (no weekday filter, help-givens allowed)');
for (const [n, d] of [[5, 0.42], [6, 0.4], [7, 0.42]] as const) {
  const ps: Puzzle[] = [];
  for (let s = 0; ps.length < 100; s++) { const p = generate(`rep-${n}-${s}`, { n, density: d, solve: SOLVE }); if (p) ps.push(p); }
  const r = stats(ps);
  console.log(`${n}x${n}:`, JSON.stringify(r));
}
