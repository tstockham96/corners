import { formatTime } from './date';
export const NAME = 'CORNERS';
export interface Result { secs: number; hints: number; mistakes: number }
export const flawless = (r: Result) => r.hints === 0 && r.mistakes === 0;
export function headline(n: number, r: Result): string {
  const parts = [`${NAME} #${n} ${flawless(r) ? '⭐' : '✓'} ${formatTime(r.secs)}`, r.hints ? `${r.hints} hint${r.hints === 1 ? '' : 's'}` : 'no hints'];
  if (r.mistakes) parts.push(`${r.mistakes} slip${r.mistakes === 1 ? '' : 's'}`);
  return parts.join(' · ');
}
/** Spoiler-free: never shows the board, only time, hints and slips. */
export function shareText(n: number, day: string, levelKey: number, r: Result, link: string, streak = 0): string {
  const pips = '●'.repeat(levelKey) + '○'.repeat(7 - levelKey);
  const lines = [headline(n, r), `${day} ${pips}${streak > 1 ? ` · 🔥${streak}` : ''}`];
  if (link) lines.push(link);
  return lines.join('\n');
}
/** Positive if a beats b: fewer hints, then fewer slips, then faster. */
export const compare = (a: Result, b: Result) => b.hints - a.hints || b.mistakes - a.mistakes || b.secs - a.secs;
