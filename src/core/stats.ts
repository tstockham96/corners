export interface DayResult { secs: number; hints: number; mistakes: number; level: number; at: number }
export interface Stats { played: number; streak: number; maxStreak: number; flawless: number; best: (number | null)[] /* per level 1..7 */ }
/** Streak = consecutive puzzle numbers solved, ending today (or yesterday if today isn't solved yet). */
export function computeStats(results: Record<string, DayResult>, today: number): Stats {
  const nums = Object.keys(results).map(Number).sort((a, b) => a - b);
  let maxStreak = 0, run = 0, prev = -10, fl = 0;
  const best: (number | null)[] = new Array(7).fill(null);
  for (const n of nums) {
    const r = results[n];
    if (!r.hints && !r.mistakes) fl++;
    const k = r.level - 1;
    if (k >= 0 && k < 7 && !r.hints && (best[k] === null || r.secs < best[k]!)) best[k] = r.secs;
    run = n === prev + 1 ? run + 1 : 1;
    prev = n;
    maxStreak = Math.max(maxStreak, run);
  }
  let streak = 0;
  let k = results[today] ? today : today - 1;
  while (results[k]) { streak++; k--; }
  return { played: nums.length, streak, maxStreak, flawless: fl, best };
}
