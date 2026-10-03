import { baseUrl } from '../config';
import { decodeChallenge, encodeChallenge, type Challenge } from '../core/challenge';
import { formatCountdown, formatPuzzleDate, formatTime, msUntilLocalMidnight, puzzleNumberFor } from '../core/date';
import { levelOf, puzzleFor } from '../core/daily';
import { getHint, type Hint } from '../core/hint';
import { LEVELS } from '../core/levels';
import { conflicts, DOT, lineCells, lineNeed, satisfies, startGrid, UNK, X, type Puzzle } from '../core/model';
import { compare, flawless, headline, shareText, type Result } from '../core/share';
import { computeStats } from '../core/stats';
import { TECH_NAME } from '../core/solver';
import * as sfx from '../game/audio';
import { buzz, setHaptics } from '../game/haptics';
import { load, reset, save } from '../state/storage';
import { copyText, nativeShare } from './clipboard';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const el = (tag: string, cls = '', html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

type Move = [number, number, number]; // cell, from, to

export function startApp() {
  const params = new URLSearchParams(location.search);
  if (params.has('reset')) {
    reset();
    params.delete('reset');
    const q = params.toString();
    try { history.replaceState(null, '', location.pathname + (q ? `?${q}` : '') + location.hash); } catch { /* file:// */ }
  }
  const store = load();
  setHaptics(store.haptics);
  sfx.setSound(store.sound);
  const today = puzzleNumberFor();

  // ---- challenge link
  let challenge: Challenge | null = null;
  const m = location.hash.match(/c=([\w-]+)/);
  if (m) { const c = decodeChallenge(m[1]); if (c && c.n >= 1 && c.n <= today) challenge = c; }

  let num = challenge ? challenge.n : today;
  const pq = Number(params.get('p'));
  if (pq >= 1 && (pq <= today || params.has('dev'))) num = pq;
  const P: Puzzle = puzzleFor(num);
  const LV = levelOf(num);
  const n = P.n;
  const givenSet = new Set(P.givens);

  // ---- state
  let grid = startGrid(P);
  let undo: Move[][] = [];
  let elapsed = 0, hints = 0, mistakes = 0;
  let mode: 'dot' | 'x' = 'dot';
  let won = false;
  let hint: Hint | null = null;
  let pending: { cell: number; timer: number } | null = null; // a rule break that may still be undone by cycling
  const prior = store.results[num];
  if (store.progress && store.progress.n === num && !prior) {
    const pr = store.progress;
    if (pr.grid.length === n * n) { grid = Uint8Array.from(pr.grid); for (const i of P.givens) grid[i] = DOT; }
    elapsed = pr.elapsed; hints = pr.hints; mistakes = pr.mistakes; undo = pr.undo ?? [];
  }
  if (prior) {
    grid = Uint8Array.from(P.sol, (ch) => (ch === '1' ? DOT : UNK));
    won = true; elapsed = prior.secs; hints = prior.hints; mistakes = prior.mistakes;
  }

  // ---- header
  $('[data-testid=sub]').textContent = `#${num} · ${formatPuzzleDate(num)}`;
  $('[data-testid=level]').innerHTML = `${LV.day} · ${LV.label}<div class="pips">${LEVELS.map((l) => `<i class="${l.key <= LV.key ? 'on' : ''}"></i>`).join('')}</div>`;
  if (challenge && challenge.n === num) {
    const b = $('[data-testid=challenge-banner]');
    b.classList.remove('hidden');
    b.innerHTML = `<b>${esc(challenge.by || 'A friend')}</b> solved #${num} in <b>${formatTime(challenge.secs)}</b> · ${challenge.hints ? `${challenge.hints} hint${challenge.hints > 1 ? 's' : ''}` : 'no hints'}. Beat it.`;
  }

  // ---- board DOM
  const board = $('#board'), overlay = $('#overlay'), frame = $('#frame');
  const vw = Math.min(window.innerWidth || 390, 480);
  const countW = 30;
  const cell = Math.max(36, Math.min(64, Math.floor((vw - 28 - countW - 4) / n)));
  board.style.setProperty('--cell', `${cell}px`);
  board.style.gridTemplateColumns = `${countW}px auto`;
  board.style.gridTemplateRows = `${countW}px auto`;
  board.appendChild(el('div', 'corner0'));
  const colWrap = el('div'); colWrap.style.display = 'grid'; colWrap.style.gridTemplateColumns = `repeat(${n}, ${cell + 1.5}px)`; colWrap.style.paddingLeft = '1.5px';
  const rowWrap = el('div'); rowWrap.style.display = 'grid'; rowWrap.style.gridTemplateRows = `repeat(${n}, ${cell + 1.5}px)`; rowWrap.style.paddingTop = '1.5px';
  const cntEls: HTMLElement[] = [];
  for (let c = 0; c < n; c++) { const e = el('div', 'cnt col', String(P.cols[c])); e.dataset.line = String(n + c); colWrap.appendChild(e); cntEls[n + c] = e; }
  for (let r = 0; r < n; r++) { const e = el('div', 'cnt row', String(P.rows[r])); e.dataset.line = String(r); rowWrap.appendChild(e); cntEls[r] = e; }
  const cellsWrap = el('div', 'cells');
  cellsWrap.style.gridTemplateColumns = `repeat(${n}, ${cell}px)`;
  const cellEls: HTMLElement[] = [];
  for (let i = 0; i < n * n; i++) {
    const e = el('div', 'cell');
    e.dataset.i = String(i);
    e.dataset.testid = `cell-${i}`;
    e.setAttribute('data-testid', `cell-${i}`);
    cellsWrap.appendChild(e);
    cellEls.push(e);
  }
  board.appendChild(colWrap);
  board.appendChild(rowWrap);
  board.appendChild(cellsWrap);

  // ---- rendering
  let lastDone = new Set<number>();
  function render(opts: { pop?: boolean } = {}) {
    const cf = conflicts(P, grid);
    for (let i = 0; i < n * n; i++) {
      const e = cellEls[i];
      e.classList.toggle('dot', grid[i] === DOT && !givenSet.has(i));
      e.classList.toggle('given', givenSet.has(i));
      e.classList.toggle('x', grid[i] === X);
      e.classList.toggle('bad', cf.cells.has(i));
    }
    const done = new Set<number>();
    for (let L = 0; L < 2 * n; L++) {
      let d = 0;
      for (const i of lineCells(n, L)) if (grid[i] === DOT) d++;
      const need = lineNeed(P, L);
      const e = cntEls[L];
      const bad = cf.over.includes(L) || cf.short.includes(L);
      e.classList.toggle('bad', bad);
      e.classList.toggle('done', !bad && d === need);
      if (!bad && d === need) done.add(L);
      if (opts.pop && d === need && !bad && !lastDone.has(L)) { e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); }
    }
    lastDone = done;
    // rectangle outlines
    overlay.innerHTML = '';
    const fr = frame.getBoundingClientRect();
    const box = (i: number) => cellEls[i].getBoundingClientRect();
    for (const R of cf.rects.slice(0, 6)) {
      const a = box(R.r1 * n + R.c1), b = box(R.r2 * n + R.c2);
      const pad = cell * 0.18;
      const d = el('div', 'rect');
      d.style.left = `${a.left - fr.left + pad}px`; d.style.top = `${a.top - fr.top + pad}px`;
      d.style.width = `${b.right - a.left - 2 * pad}px`; d.style.height = `${b.bottom - a.top - 2 * pad}px`;
      overlay.appendChild(d);
    }
    // hint highlights
    for (const e of cellEls) e.classList.remove('lhl', 'focus', 'target', 'wrong');
    for (const e of cntEls) e.classList.remove('hl');
    if (hint) {
      if (hint.kind === 'step' || hint.kind === 'reveal') {
        for (const L of hint.step.lines) { for (const i of lineCells(n, L)) cellEls[i].classList.add('lhl'); cntEls[L].classList.add('hl'); }
        for (const i of hint.step.focus) cellEls[i].classList.add('focus');
        for (const i of hint.cells) cellEls[i].classList.add('target');
      } else if (hint.kind === 'wrong') for (const i of hint.cells) cellEls[i].classList.add('wrong');
    }
    const sl = mistakes + (pending ? 1 : 0);
    $('[data-testid=marks]').innerHTML = `<b>${hints}</b> hint${hints === 1 ? '' : 's'}<br><b>${sl}</b> slip${sl === 1 ? '' : 's'}`;
    ($('#btn-undo') as HTMLButtonElement).disabled = won || !undo.length;
    ($('#btn-hint') as HTMLButtonElement).disabled = won;
    const mb = $('#btn-mode');
    mb.classList.toggle('xmode', mode === 'x');
    mb.querySelector('span')!.textContent = mode === 'x' ? '✕ mode' : 'Dot mode';
    $('[data-testid=timer]').textContent = formatTime(elapsed);
  }
  const badness = () => { const cf = conflicts(P, grid); return cf.rects.length + cf.over.length + cf.short.length; };

  // ---- moves
  function apply(changes: [number, number][], record = true) {
    const moves: Move[] = [];
    for (const [i, v] of changes) if (!givenSet.has(i) && grid[i] !== v) moves.push([i, grid[i], v]);
    if (!moves.length || won) return;
    const before = badness();
    for (const [i, , v] of moves) grid[i] = v;
    if (record) undo.push(moves);
    hint = null; hideHint();
    const after = badness();
    // A slip is a move that breaks a rule. Cycling a cell (dot -> ✕) passes through a dot, so a break
    // that is undone by the very next tap on the same cell within 2.5 s is forgiven.
    if (pending && (moves.length !== 1 || moves[0][0] !== pending.cell || after >= before)) commitSlip();
    else if (pending) { clearTimeout(pending.timer); pending = null; }
    if (after > before) {
      sfx.bad(); buzz([20, 40, 30]); for (const [i] of moves) shake(i);
      pending = { cell: moves.length === 1 ? moves[0][0] : -1, timer: window.setTimeout(commitSlip, 2500) };
    }
    else if (moves.some((mv) => mv[2] === DOT)) { sfx.dot(); buzz(8); }
    else sfx.cross();
    render({ pop: true });
    persist();
    if (satisfies(P, grid)) win();
  }
  function commitSlip() { if (!pending) return; clearTimeout(pending.timer); pending = null; mistakes++; render(); persist(); }
  function shake(i: number) { const e = cellEls[i]; e.classList.remove('nope'); void e.offsetWidth; e.classList.add('nope'); }
  function cycle(i: number) {
    if (givenSet.has(i)) { shake(i); buzz(15); return; }
    const v = grid[i];
    const next = mode === 'x' ? (v === X ? UNK : v === DOT ? UNK : X) : v === UNK ? DOT : v === DOT ? X : UNK;
    apply([[i, next]]);
  }

  // ---- pointer input: tap cycles; dragging across cells paints ✕ on empty cells
  let drag: { start: number; moved: boolean; painted: Set<number> } | null = null;
  const cellAt = (x: number, y: number) => { const t = document.elementFromPoint(x, y) as HTMLElement | null; const i = t?.closest?.('.cell') as HTMLElement | null; return i && i.dataset.i ? Number(i.dataset.i) : -1; };
  cellsWrap.addEventListener('pointerdown', (e) => {
    sfx.unlockAudio();
    if (won) return;
    const i = cellAt(e.clientX, e.clientY);
    if (i < 0) return;
    drag = { start: i, moved: false, painted: new Set() };
    try { cellsWrap.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
  });
  cellsWrap.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const i = cellAt(e.clientX, e.clientY);
    if (i < 0 || (i === drag.start && !drag.moved)) return;
    if (!drag.moved) { drag.moved = true; if (grid[drag.start] === UNK && !givenSet.has(drag.start)) drag.painted.add(drag.start); }
    if (grid[i] === UNK && !givenSet.has(i)) drag.painted.add(i);
    for (const j of drag.painted) cellEls[j].classList.add('x');
  });
  const end = () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.moved) cycle(d.start);
    else if (d.painted.size) apply([...d.painted].map((j) => [j, X] as [number, number]));
    else render();
  };
  cellsWrap.addEventListener('pointerup', end);
  cellsWrap.addEventListener('pointercancel', () => { drag = null; render(); });

  $('#btn-undo').addEventListener('click', () => {
    const mv = undo.pop();
    if (!mv || won) return;
    if (pending) commitSlip();
    for (const [i, from] of mv) grid[i] = from;
    hint = null; hideHint();
    render(); persist();
  });
  $('#btn-mode').addEventListener('click', () => { mode = mode === 'dot' ? 'x' : 'dot'; render(); });

  // ---- hints
  const hb = $('[data-testid=hintbox]');
  function hideHint() { hb.classList.add('hidden'); $('[data-testid=caption]').classList.remove('hidden'); }
  function showHint() {
    if (won) return;
    hint = getHint(P, grid);
    if (!hint) return;
    if (hint.kind !== 'conflict') hints++;
    $('[data-testid=hint-title]').textContent = hint.kind === 'step' ? `Hint · ${hint.title}` : hint.title;
    $('[data-testid=hint-text]').textContent = hint.text;
    $('#hint-apply').classList.toggle('hidden', !(hint.kind === 'step' || hint.kind === 'reveal'));
    hb.classList.remove('hidden');
    $('[data-testid=caption]').classList.add('hidden');
    render(); persist();
  }
  $('#btn-hint').addEventListener('click', showHint);
  $('#hint-close').addEventListener('click', () => { hint = null; hideHint(); render(); });
  $('#hint-apply').addEventListener('click', () => {
    if (!hint || !(hint.kind === 'step' || hint.kind === 'reveal')) return;
    const ch = hint.step.set.filter(([i]) => grid[i] === UNK).map(([i, v]) => [i, v] as [number, number]);
    apply(ch);
  });

  // ---- timer
  let last = performance.now();
  const running = () => !won && document.visibilityState === 'visible' && !document.querySelector('.sheet.open');
  setInterval(() => {
    const t = performance.now();
    if (running()) { elapsed += (t - last) / 1000; $('[data-testid=timer]').textContent = formatTime(elapsed); }
    $('[data-testid=timer]').classList.toggle('paused', !running() && !won);
    last = t;
  }, 250);
  let lastSave = 0;
  function persist(force = false) {
    if (won) return;
    const t = Date.now();
    if (!force && t - lastSave < 400) { setTimeout(() => persist(true), 450); return; }
    lastSave = t;
    store.progress = { n: num, grid: Array.from(grid), elapsed, hints, mistakes, undo: undo.slice(-200) };
    save();
  }
  setInterval(() => persist(true), 3000);
  document.addEventListener('visibilitychange', () => persist(true));

  // ---- win
  function win() {
    if (pending) commitSlip();
    won = true;
    elapsed = Math.max(1, Math.round(elapsed));
    hint = null; hideHint();
    const res = { secs: elapsed, hints, mistakes, level: LV.key, at: Date.now() };
    store.results[num] = res;
    store.progress = undefined;
    save();
    cellEls.forEach((e, i) => e.style.setProperty('--d', `${((i % n) + Math.floor(i / n)) * 0.04}s`));
    board.classList.add('win');
    sfx.fanfare(); buzz([30, 60, 30, 60, 80]);
    render();
    $('[data-testid=cta-results]').classList.remove('hidden');
    $('.tools').classList.add('hidden');
    setTimeout(() => openResults(), 1100);
  }

  // ---- sheets
  const scrim = $('#scrim');
  function openSheet(id: string) {
    document.querySelectorAll('.sheet.open').forEach((s) => s.classList.remove('open'));
    const s = $(id); s.classList.add('open'); s.setAttribute('aria-hidden', 'false'); scrim.classList.remove('hidden');
  }
  function closeSheets() {
    document.querySelectorAll('.sheet.open').forEach((s) => { s.classList.remove('open'); s.setAttribute('aria-hidden', 'true'); });
    scrim.classList.add('hidden');
    stopDemo();
  }
  scrim.addEventListener('click', closeSheets);

  const result = (): Result => ({ secs: Math.round(elapsed), hints, mistakes });
  const link = () => baseUrl();
  function streakNow() { return computeStats(store.results, today).streak; }

  function openResults() {
    const r = result();
    const st = computeStats(store.results, today);
    const s = $('#sheet-results');
    const text = shareText(num, LV.day, LV.key, r, link(), st.streak);
    let vs = '';
    if (challenge && challenge.n === num) {
      const c = compare(r, challenge);
      vs = `<div class="card"><h3>Challenge</h3><div class="vs"><div><b>${formatTime(r.secs)}</b>You · ${r.hints ? r.hints + ' hints' : 'no hints'}</div><div>${c > 0 ? '🏆' : c < 0 ? '—' : '='}</div><div><b>${formatTime(challenge.secs)}</b>${esc(challenge.by || 'Friend')} · ${challenge.hints ? challenge.hints + ' hints' : 'no hints'}</div></div><p class="foot">${c > 0 ? 'You win this one.' : c < 0 ? `${esc(challenge.by || 'Your friend')} takes it. Rematch tomorrow.` : 'Dead heat.'}</p></div>`;
    }
    s.innerHTML = `<div class="grab"></div>
      <h2>${flawless(r) ? 'Flawless.' : 'Solved.'}</h2>
      <div class="kicker">#${num} · ${LV.day} · ${LV.label}</div>
      <div class="res-big"><div><b data-testid="res-time">${formatTime(r.secs)}</b><small>Time</small></div><div><b>${r.hints}</b><small>Hints</small></div><div><b>${r.mistakes}</b><small>Slips</small></div></div>
      <pre class="share-pre" data-testid="share-text">${esc(text)}</pre>
      <div class="actions"><button class="btn" id="r-share" data-testid="share">Share</button><button class="btn ghost" id="r-chal" data-testid="challenge">Challenge a friend</button></div>
      ${vs}
      <div class="card"><h3>Your streak</h3><div class="statgrid"><div><b>${st.played}</b><small>Solved</small></div><div><b data-testid="streak">${st.streak}</b><small>Streak</small></div><div><b>${st.maxStreak}</b><small>Best</small></div><div><b>${st.flawless}</b><small>Flawless</small></div></div></div>
      <div class="countdown">Next puzzle in <b data-testid="countdown">${formatCountdown(msUntilLocalMidnight())}</b></div>`;
    $('#r-share').addEventListener('click', async () => {
      const t = shareText(num, LV.day, LV.key, result(), link(), streakNow());
      const ns = await nativeShare(t);
      if (ns === false) toast((await copyText(t)) ? 'Copied to clipboard' : 'Could not copy');
    });
    $('#r-chal').addEventListener('click', async () => {
      const by = store.name || 'A friend';
      const url = `${link()}#c=${encodeChallenge({ n: num, secs: r.secs, hints: r.hints, mistakes: r.mistakes, by })}`;
      const t = `${headline(num, r)}\nCan you beat me? ${url}`;
      const ns = await nativeShare(t);
      if (ns === false) toast((await copyText(t)) ? 'Challenge link copied' : 'Could not copy');
    });
    openSheet('#sheet-results');
  }
  $('#btn-results').addEventListener('click', openResults);

  function openStats() {
    const st = computeStats(store.results, today);
    const s = $('#sheet-stats');
    s.innerHTML = `<div class="grab"></div><h2>Stats</h2><div class="kicker">Streaks count days solved in a row</div>
      <div class="card"><div class="statgrid"><div><b>${st.played}</b><small>Solved</small></div><div><b>${st.streak}</b><small>Streak</small></div><div><b>${st.maxStreak}</b><small>Best</small></div><div><b>${st.flawless}</b><small>Flawless</small></div></div></div>
      <div class="card"><h3>Best time without hints</h3><div class="bests">${LEVELS.map((l, k) => `<div><small>${l.day.slice(0, 3).toUpperCase()}</small><b>${st.best[k] === null ? '–' : formatTime(st.best[k]!)}</b></div>`).join('')}</div></div>
      <div class="card"><h3>Settings</h3>
        <input class="name-in" id="s-name" maxlength="16" placeholder="Your name for challenge links" value="${esc(store.name)}" />
        <div class="toggle">Sound <button class="switch ${store.sound ? 'on' : ''}" id="s-sound" aria-label="Sound"></button></div>
        <div class="toggle">Haptics <button class="switch ${store.haptics ? 'on' : ''}" id="s-hap" aria-label="Haptics"></button></div>
      </div><p class="foot">Every puzzle has exactly one answer, reachable by logic alone.</p>`;
    ($('#s-name') as HTMLInputElement).addEventListener('input', (e) => { store.name = (e.target as HTMLInputElement).value.slice(0, 16); save(); });
    $('#s-sound').addEventListener('click', (e) => { store.sound = !store.sound; sfx.setSound(store.sound); (e.target as HTMLElement).classList.toggle('on', store.sound); save(); });
    $('#s-hap').addEventListener('click', (e) => { store.haptics = !store.haptics; setHaptics(store.haptics); (e.target as HTMLElement).classList.toggle('on', store.haptics); save(); });
    openSheet('#sheet-stats');
  }
  $('#btn-stats').addEventListener('click', openStats);

  // ---- intro / help with a tiny animated example
  let demoTimer: number | undefined;
  function stopDemo() { if (demoTimer) clearTimeout(demoTimer); demoTimer = undefined; }
  function openIntro(full: boolean) {
    const s = $('#sheet-intro');
    s.innerHTML = `<div class="grab"></div><h2>CORNERS</h2><div class="kicker">One rule · one answer · pure logic</div>
      <p class="rule" data-testid="rule">Give every row and column its number of dots. <b>Never let four dots form a rectangle.</b></p>
      <div class="demo"><div class="mini" id="mini"></div></div><div class="demo-cap" id="demo-cap">&nbsp;</div>
      <ul class="howto">
        <li><span class="ic">●</span><span><b>Tap</b> a cell: dot → ✕ → empty. Drag to ✕ many.</span></li>
        <li><span class="ic">✕</span><span>✕ is just a note: "no dot here".</span></li>
        <li><span class="ic">?</span><span>Stuck? A <b>hint</b> explains the next deduction in plain words.</span></li>
      </ul>
      ${full ? `<div class="card"><h3>Techniques you'll discover</h3><ul class="techs">
        <li><b>${TECH_NAME.full}</b> · a line with all its dots: the rest is empty.</li>
        <li><b>${TECH_NAME.corner}</b> · three corners of a rectangle: the fourth cell stays empty.</li>
        <li><b>${TECH_NAME.squeeze}</b> · a line can use at most one of another line's dot columns.</li>
        <li><b>${TECH_NAME.pair}</b> · two lines share at most one cell position, so they need a + b − 1 different ones.</li>
        <li><b>${TECH_NAME.whatif}</b> · "if this were a dot…" leads straight to a contradiction.</li>
      </ul><p class="foot">Monday is gentle. By Sunday you'll need all of them.</p></div>` : ''}
      <button class="btn wide" id="intro-go" data-testid="intro-go">${won ? 'Close' : store.seenIntro ? 'Back to the puzzle' : 'Start'}</button>`;
    $('#intro-go').addEventListener('click', () => { store.seenIntro = true; save(); closeSheets(); });
    openSheet('#sheet-intro');
    runDemo();
  }
  function runDemo() {
    stopDemo();
    const mini = $('#mini'); if (!mini) return;
    const cap = $('#demo-cap');
    mini.innerHTML = '';
    mini.appendChild(el('div'));
    const cnts: HTMLElement[] = [];
    for (let c = 0; c < 3; c++) { const e = el('div', 'cnt col', '2'); mini.appendChild(e); cnts[3 + c] = e; }
    const cells: HTMLElement[] = [];
    for (let r = 0; r < 3; r++) {
      const e = el('div', 'cnt row', '2'); mini.appendChild(e); cnts[r] = e;
      for (let c = 0; c < 3; c++) { const d = el('div', 'cell'); mini.appendChild(d); cells.push(d); }
    }
    const g = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const seq: { i: number; v: number; cap?: string; cls?: string; hold?: number; rect?: boolean }[] = [
      { i: 0, v: 1 }, { i: 1, v: 1 }, { i: 3, v: 1 },
      { i: 4, v: 1, cap: '✕ four dots make a rectangle', cls: 'bad', hold: 1500, rect: true },
      { i: 4, v: 0, cap: '' }, { i: 5, v: 1 }, { i: 7, v: 1 },
      { i: 8, v: 1, cap: '✓ every count met, no rectangle', cls: 'good', hold: 2200 },
    ];
    let k = 0;
    const paint = (rect: boolean) => {
      cells.forEach((d, i) => { d.classList.toggle('dot', g[i] === 1); d.classList.toggle('bad', rect && [0, 1, 3, 4].includes(i)); });
      for (let L = 0; L < 6; L++) { const idx = L < 3 ? [L * 3, L * 3 + 1, L * 3 + 2] : [L - 3, L, L + 3]; const dd = idx.filter((i) => g[i]).length; cnts[L].classList.toggle('done', dd === 2); cnts[L].classList.toggle('bad', dd > 2); }
      mini.querySelector('.rect')?.remove();
      if (rect) { const rr = el('div', 'rect'); rr.style.left = `${26 + 8}px`; rr.style.top = `${26 + 8}px`; rr.style.width = `${92 - 16}px`; rr.style.height = `${92 - 16}px`; mini.appendChild(rr); }
    };
    const stepF = () => {
      if (!document.querySelector('#sheet-intro.open')) return;
      if (k >= seq.length) { k = 0; g.fill(0); cap.textContent = '\u00a0'; cap.className = 'demo-cap'; paint(false); demoTimer = window.setTimeout(stepF, 700); return; }
      const s = seq[k++];
      g[s.i] = s.v;
      if (s.cap !== undefined) { cap.textContent = s.cap || '\u00a0'; cap.className = `demo-cap ${s.cls ?? ''}`; }
      paint(!!s.rect);
      demoTimer = window.setTimeout(stepF, s.hold ?? 650);
    };
    paint(false);
    demoTimer = window.setTimeout(stepF, 600);
  }
  $('#btn-help').addEventListener('click', () => openIntro(true));

  // ---- toast
  function toast(t: string) { const d = el('div', 'toast', esc(t)); document.body.appendChild(d); setTimeout(() => d.remove(), 1600); }

  // ---- go
  render();
  if (won) { board.classList.add('win'); $('[data-testid=cta-results]').classList.remove('hidden'); $('.tools').classList.add('hidden'); }
  if (!store.seenIntro) openIntro(false);
  window.addEventListener('resize', () => render());

  // test hook (used by the Playwright e2e)
  (window as unknown as { __corners: unknown }).__corners = {
    num, puzzle: P, level: LV.key,
    grid: () => Array.from(grid), won: () => won, hints: () => hints, mistakes: () => mistakes + (pending ? 1 : 0), elapsed: () => elapsed,
    cellCenter: (i: number) => { const r = cellEls[i].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
    hint: () => hint,
  };
}
function esc(s: string) { return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!); }
