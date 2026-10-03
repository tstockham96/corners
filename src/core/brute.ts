/**
 * Brute-force solution counter (independent of the logical solver). Row-by-row search over
 * bitmasks: each row picks exactly rows[r] columns; any two rows may share at most one column.
 */
import type { Puzzle } from './model';

const pc = (x: number) => { let c = 0; while (x) { x &= x - 1; c++; } return c; };

export function countSolutions(p: Pick<Puzzle, 'n' | 'rows' | 'cols' | 'givens'>, limit = 2, forbid: number[] = []): { count: number; first?: string } {
  const { n, rows, cols } = p;
  const giv = new Array(n).fill(0), ban = new Array(n).fill(0);
  for (const i of p.givens) giv[Math.floor(i / n)] |= 1 << (i % n);
  for (const i of forbid) ban[Math.floor(i / n)] |= 1 << (i % n);
  const byCount: number[][] = Array.from({ length: n + 1 }, () => []);
  for (let m = 0; m < 1 << n; m++) byCount[pc(m)].push(m);
  const chosen: number[] = [];
  const colCnt = new Array(n).fill(0);
  let count = 0;
  let first: string | undefined;
  const rec = (r: number): boolean => {
    if (r === n) {
      for (let c = 0; c < n; c++) if (colCnt[c] !== cols[c]) return false;
      count++;
      if (!first) first = chosen.map((m) => Array.from({ length: n }, (_, c) => ((m >> c) & 1 ? '1' : '0')).join('')).join('');
      return count >= limit;
    }
    const left = n - r - 1;
    outer: for (const m of byCount[rows[r]]) {
      if ((m & giv[r]) !== giv[r] || m & ban[r]) continue;
      for (const q of chosen) { const s = m & q; if (s & (s - 1)) continue outer; }
      for (let c = 0; c < n; c++) {
        const v = colCnt[c] + ((m >> c) & 1);
        if (v > cols[c] || v + left < cols[c]) continue outer;
      }
      for (let c = 0; c < n; c++) colCnt[c] += (m >> c) & 1;
      chosen.push(m);
      const stop = rec(r + 1);
      chosen.pop();
      for (let c = 0; c < n; c++) colCnt[c] -= (m >> c) & 1;
      if (stop) return true;
    }
    return false;
  };
  rec(0);
  return { count, first };
}
