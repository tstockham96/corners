/** Daily puzzle lookup: puzzle #N uses its weekday's pool (Mon gentle ... Sun hardest). */
import { weekdayOf } from './date';
import { LEVELS, levelForWeekday } from './levels';
import type { Puzzle } from './model';
import POOLS from './puzzles.json';

interface Stored { n: number; r: string; c: string; g: number[]; s: string; w?: number }
const pools = POOLS as unknown as Stored[][]; // index 0 = Monday ... 6 = Sunday
const hexToBits = (hex: string, len: number) => [...hex].map((h) => parseInt(h, 16).toString(2).padStart(4, '0')).join('').slice(0, len);
export function decode(s: Stored, level: number): Puzzle {
  return { n: s.n, rows: [...s.r].map(Number), cols: [...s.c].map(Number), givens: s.g, sol: hexToBits(s.s, s.n * s.n), level };
}
export const poolSizes = () => pools.map((p) => p.length);
export const totalPuzzles = () => pools.reduce((a, p) => a + p.length, 0);
export function allPuzzles(): Puzzle[] { return pools.flatMap((pool, k) => pool.map((s) => decode(s, k + 1))); }
export function puzzleFor(num: number): Puzzle {
  const lv = levelForWeekday(weekdayOf(num));
  const pool = pools[lv.key - 1];
  const idx = (((Math.floor((num - 1) / 7)) % pool.length) + pool.length) % pool.length;
  return decode(pool[idx], lv.key);
}
export const levelOf = (num: number) => levelForWeekday(weekdayOf(num));
export { LEVELS };
