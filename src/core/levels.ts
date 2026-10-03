/** Weekday difficulty ladder (like the NYT crossword: Monday gentle, Sunday hardest). */
import type { Grade } from './model';
import type { SolveOpts } from './solver';

export interface Level { key: number; day: string; n: number; density: number; label: string; noHelp: boolean; accept: (g: Grade, whatifMax: number) => boolean }
const c = (g: Grade, t: string) => g.counts[t] ?? 0;
export const SOLVE: SolveOpts = { whatifDepth: 3 };
// key: 1 = Monday ... 7 = Sunday
export const LEVELS: Level[] = [
  { key: 1, day: 'Monday', n: 5, density: 0.42, label: 'Gentle', noHelp: false, accept: (g) => (g.top === 'corner' || g.top === 'fill') && c(g, 'corner') >= 1 },
  { key: 2, day: 'Tuesday', n: 6, density: 0.4, label: 'Easy', noHelp: false, accept: (g) => g.top === 'corner' && c(g, 'corner') >= 3 },
  { key: 3, day: 'Wednesday', n: 6, density: 0.4, label: 'Medium', noHelp: false, accept: (g) => g.top === 'squeeze' && c(g, 'squeeze') >= 1 },
  { key: 4, day: 'Thursday', n: 6, density: 0.45, label: 'Tricky', noHelp: false, accept: (g) => g.top === 'pair' && c(g, 'squeeze') + c(g, 'pair') >= 2 },
  { key: 5, day: 'Friday', n: 7, density: 0.4, label: 'Hard', noHelp: false, accept: (g) => g.top === 'pair' && c(g, 'pair') >= 1 && c(g, 'squeeze') + c(g, 'pair') >= 3 },
  { key: 6, day: 'Saturday', n: 7, density: 0.42, label: 'Harder', noHelp: false, accept: (g, w) => g.top === 'whatif' && c(g, 'whatif') <= 2 && w <= 2 && c(g, 'pair') + c(g, 'squeeze') >= 2 },
  { key: 7, day: 'Sunday', n: 7, density: 0.44, label: 'Hardest', noHelp: true, accept: (g, w) => g.top === 'whatif' && c(g, 'pair') >= 2 && c(g, 'whatif') >= 1 && w <= 3 && g.score >= 35 },
];
export const levelForWeekday = (jsDay: number) => LEVELS[(jsDay + 6) % 7]; // JS: 0 = Sunday
