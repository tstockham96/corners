/**
 * Puzzle numbering. The puzzle flips at the player's LOCAL midnight, but puzzle #N is the
 * same board for everyone. #1 = Saturday Oct 3, 2026.
 */
export const EPOCH = { y: 2026, m: 10, d: 3 };
const DAY_MS = 86_400_000;
const epochUtc = () => Date.UTC(EPOCH.y, EPOCH.m - 1, EPOCH.d);
export function puzzleNumberFor(date: Date = new Date()): number {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((local - epochUtc()) / DAY_MS) + 1;
}
export const dateForPuzzle = (n: number) => new Date(epochUtc() + (n - 1) * DAY_MS);
/** 0 = Sunday ... 6 = Saturday, for puzzle n. */
export const weekdayOf = (n: number) => dateForPuzzle(n).getUTCDay();
export function formatPuzzleDate(n: number): string {
  const d = dateForPuzzle(n);
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
export function msUntilLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
export function formatTime(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}
