/** Runtime config. Override the public URL with VITE_PUBLIC_URL, or `window.CORNERS_CONFIG = { publicUrl }`. */
export interface CornersConfig { publicUrl: string }
declare global { interface Window { CORNERS_CONFIG?: Partial<CornersConfig> } }
export const DEFAULT_PUBLIC_URL = 'https://tstockham96.github.io/corners/';
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const runtime = (typeof window !== 'undefined' && window.CORNERS_CONFIG) || {};
export const CONFIG: CornersConfig = { publicUrl: runtime.publicUrl ?? env.VITE_PUBLIC_URL ?? DEFAULT_PUBLIC_URL };
export function baseUrl(): string {
  if (CONFIG.publicUrl) return CONFIG.publicUrl.replace(/#.*$/, '');
  if (typeof location === 'undefined' || location.protocol === 'file:') return DEFAULT_PUBLIC_URL;
  return location.href.replace(/[?#].*$/, '');
}
