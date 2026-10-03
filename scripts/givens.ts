// Experiment: how few givens can we get? random vs greedy selection, dots-only vs dots+holes.
import { countSolutions } from '../src/core/brute';
import { countsOf, randomSolution } from '../src/core/gen';
import { makeRng } from '../src/core/rng';
const n = Number(process.argv[2] ?? 6), dens = Number(process.argv[3] ?? 0.4), K = 25;
for (const mode of ['random', 'greedy', 'greedy+holes']) {
  let tot = 0, totDots = 0, k = 0;
  for (let s = 0; s < K; s++) {
    const rng = makeRng(`g${s}`);
    const sol = randomSolution(n, rng, dens);
    const { rows, cols } = countsOf(n, sol);
    if (rows.includes(0) || cols.includes(0)) continue;
    const dots = [...sol].flatMap((ch, i) => (ch === '1' ? [i] : []));
    const holes = [...sol].flatMap((ch, i) => (ch === '0' ? [i] : []));
    const gd: number[] = [], gh: number[] = [];
    const cnt = (d: number[], h: number[], lim = 300) => countSolutions({ n, rows, cols, givens: d }, lim, h).count;
    while (cnt(gd, gh, 2) > 1) {
      if (mode === 'random') { gd.push(rng.pick(dots.filter((i) => !gd.includes(i)))); continue; }
      let best: [number, 'd' | 'h'] | null = null, bc = 1e9;
      for (const i of dots) if (!gd.includes(i)) { const c = cnt([...gd, i], gh); if (c < bc) { bc = c; best = [i, 'd']; } }
      if (mode === 'greedy+holes') for (const i of holes) if (!gh.includes(i)) { const c = cnt(gd, [...gh, i]); if (c < bc) { bc = c; best = [i, 'h']; } }
      if (best![1] === 'd') gd.push(best![0]); else gh.push(best![0]);
    }
    // minimise
    for (const i of [...gd]) { const t = gd.filter((x) => x !== i); if (cnt(t, gh, 2) === 1) gd.splice(gd.indexOf(i), 1); }
    for (const i of [...gh]) { const t = gh.filter((x) => x !== i); if (cnt(gd, t, 2) === 1) gh.splice(gh.indexOf(i), 1); }
    tot += gd.length + gh.length; totDots += dots.length; k++;
  }
  console.log(n, dens, mode, 'avg givens', (tot / k).toFixed(1), 'of avg dots', (totDots / k).toFixed(1));
}
