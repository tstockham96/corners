import type { DayResult } from '../core/stats';
export interface Progress { n: number; grid: number[]; elapsed: number; hints: number; mistakes: number; undo: [number, number, number][][] }
export interface Store {
  v: 1;
  results: Record<string, DayResult>;
  progress?: Progress;
  seenIntro: boolean;
  haptics: boolean;
  sound: boolean;
  name: string;
}
const KEY = 'corners:v1';
let mem: Store | null = null;
const fresh = (): Store => ({ v: 1, results: {}, seenIntro: false, haptics: true, sound: true, name: '' });
export function load(): Store {
  if (mem) return mem;
  try { const raw = localStorage.getItem(KEY); mem = raw ? { ...fresh(), ...(JSON.parse(raw) as Store) } : fresh(); } catch { mem = fresh(); }
  return mem!;
}
export function save(): void { try { localStorage.setItem(KEY, JSON.stringify(load())); } catch { /* private mode */ } }
export function reset(): void { mem = fresh(); save(); }
