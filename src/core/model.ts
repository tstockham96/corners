/**
 * CORNERS core model.
 * Rule: every row and column gets exactly its number of dots, and no four dots may form
 * the corners of a rectangle (any size, sides along the grid).
 * Cells are indexed i = r * n + c. Cell states: 0 = unknown/empty, 1 = dot, 2 = cross (marked empty).
 */
export const UNK = 0, DOT = 1, X = 2;
export type Cell = 0 | 1 | 2;

export interface Puzzle {
  n: number;
  rows: number[]; // dots needed per row
  cols: number[]; // dots needed per column
  givens: number[]; // pre-placed dots (cell indices)
  sol: string; // solution, '1' = dot, '0' = empty, row-major
  level?: number; // 1 (Mon) .. 7 (Sun)
  grade?: Grade;
}
export interface Grade { steps: number; counts: Record<string, number>; top: string; score: number }

export const rc = (n: number, i: number) => [Math.floor(i / n), i % n] as const;
/** Lines: 0..n-1 are rows, n..2n-1 are columns. */
export const lineCells = (n: number, L: number): number[] => {
  const out: number[] = [];
  for (let k = 0; k < n; k++) out.push(L < n ? L * n + k : k * n + (L - n));
  return out;
};
export const lineNeed = (p: Pick<Puzzle, 'n' | 'rows' | 'cols'>, L: number) => (L < p.n ? p.rows[L] : p.cols[L - p.n]);
export const lineName = (n: number, L: number) => (L < n ? `row ${L + 1}` : `column ${L - n + 1}`);
export const LineName = (n: number, L: number) => (L < n ? `Row ${L + 1}` : `Column ${L - n + 1}`);

export interface Rect { r1: number; r2: number; c1: number; c2: number }
/** All rectangles whose four corners are dots. */
export function rectangles(n: number, g: ArrayLike<number>): Rect[] {
  const out: Rect[] = [];
  for (let r1 = 0; r1 < n; r1++)
    for (let r2 = r1 + 1; r2 < n; r2++) {
      const common: number[] = [];
      for (let c = 0; c < n; c++) if (g[r1 * n + c] === DOT && g[r2 * n + c] === DOT) common.push(c);
      for (let a = 0; a < common.length; a++) for (let b = a + 1; b < common.length; b++) out.push({ r1, r2, c1: common[a], c2: common[b] });
    }
  return out;
}

export interface Conflicts {
  rects: Rect[];
  over: number[]; // lines with too many dots
  short: number[]; // lines that can no longer reach their count (too many crosses)
  cells: Set<number>; // cells to paint red
}
/** Instant rule-violation feedback: only things that are wrong no matter what (never reveals the solution). */
export function conflicts(p: Puzzle, g: ArrayLike<number>): Conflicts {
  const { n } = p;
  const rects = rectangles(n, g);
  const over: number[] = [], short: number[] = [];
  const cells = new Set<number>();
  for (const R of rects) for (const i of [R.r1 * n + R.c1, R.r1 * n + R.c2, R.r2 * n + R.c1, R.r2 * n + R.c2]) cells.add(i);
  for (let L = 0; L < 2 * n; L++) {
    const cs = lineCells(n, L);
    let d = 0, x = 0;
    for (const i of cs) { if (g[i] === DOT) d++; else if (g[i] === X) x++; }
    const need = lineNeed(p, L);
    if (d > need) { over.push(L); for (const i of cs) if (g[i] === DOT) cells.add(i); }
    else if (n - x < need) short.push(L);
  }
  return { rects, over, short, cells };
}

export function isSolved(p: Puzzle, g: ArrayLike<number>): boolean {
  for (let i = 0; i < p.n * p.n; i++) if ((g[i] === DOT) !== (p.sol[i] === '1')) return false;
  return true;
}
/** Any grid that satisfies all the rules counts as solved (puzzles are unique, so this equals the solution). */
export function satisfies(p: Puzzle, g: ArrayLike<number>): boolean {
  const { n } = p;
  for (let L = 0; L < 2 * n; L++) {
    let d = 0;
    for (const i of lineCells(n, L)) if (g[i] === DOT) d++;
    if (d !== lineNeed(p, L)) return false;
  }
  for (const i of p.givens) if (g[i] !== DOT) return false;
  return rectangles(n, g).length === 0;
}

export function startGrid(p: Puzzle): Uint8Array {
  const g = new Uint8Array(p.n * p.n);
  for (const i of p.givens) g[i] = DOT;
  return g;
}
