/** Tiny synthesized sounds (WebAudio, no assets). Starts on the first gesture. */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
export function setSound(on: boolean) { enabled = on; if (master && ctx) master.gain.setTargetAtTime(on ? 0.7 : 0, ctx.currentTime, 0.02); }
export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') void ctx.resume(); return; }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  try { ctx = new AC(); } catch { return; }
  master = ctx.createGain(); master.gain.value = enabled ? 0.7 : 0; master.connect(ctx.destination);
}
function tone(freq: number, t0: number, dur: number, gain: number, type: OscillatorType = 'sine', glideTo?: number) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
}
export function dot() { if (ctx) tone(660, ctx.currentTime, 0.09, 0.08, 'triangle'); }
export function cross() { if (ctx) tone(330, ctx.currentTime, 0.06, 0.05, 'triangle'); }
export function bad() { if (ctx) tone(220, ctx.currentTime, 0.22, 0.09, 'sine', 140); }
export function line() { if (ctx) { const t = ctx.currentTime; tone(784, t, 0.25, 0.06); tone(1175, t + 0.05, 0.25, 0.04); } }
export function fanfare() { if (!ctx) return; const t = ctx.currentTime; [0, 4, 7, 12, 16].forEach((s, i) => { const f = 392 * 2 ** (s / 12); tone(f, t + i * 0.08, 1.2, 0.1); tone(f * 2, t + i * 0.08, 0.6, 0.03); }); }
