/** Friend challenge links: `#c=<code>`. Carries the puzzle number and the sender's result only. */
export interface Challenge { n: number; secs: number; hints: number; mistakes: number; by: string }
function b64url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(s: string): string {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return new TextDecoder().decode(Uint8Array.from(atob(pad), (c) => c.charCodeAt(0)));
}
export function encodeChallenge(c: Challenge): string {
  return b64url(`k1|${c.n}|${Math.round(c.secs)}|${c.hints}|${c.mistakes}|${c.by.replace(/[|]/g, '').slice(0, 16)}`);
}
export function decodeChallenge(code: string): Challenge | null {
  try {
    const [v, n, secs, hints, mistakes, ...name] = unb64url(code).split('|');
    if (v !== 'k1' || ![n, secs, hints, mistakes].every((x) => /^\d{1,6}$/.test(x))) return null;
    return { n: +n, secs: +secs, hints: +hints, mistakes: +mistakes, by: name.join('|').slice(0, 16) };
  } catch { return null; }
}
