// End-to-end check in headless Chrome at 390x844 with REAL touch input (CDP touch events -> pointer events).
// Solves a full puzzle by tapping, shows a conflict, undoes it, takes a hint, reloads mid-solve, wins,
// shares, and opens the challenge link as a second player.
// Usage: npm run build && node scripts/play.mjs   -> shots/*.png, shots/e2e.json
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFileSync, mkdirSync } from 'node:fs';

const SHOTS = resolve('shots');
mkdirSync(SHOTS, { recursive: true });
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const report = { steps: [], errors: [], asserts: 0, failed: 0 };
const log = (k, v) => { report.steps.push({ k, v }); console.log('•', k, typeof v === 'string' ? v : JSON.stringify(v)); };
const assert = (c, msg) => { report.asserts++; if (!c) { report.failed++; report.errors.push('ASSERT ' + msg); console.log('✗', msg); } else console.log('✓', msg); };

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true });
const device = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function player(label, url, ctx) {
  ctx = ctx ?? (await browser.newContext(device));
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.errors.push(`${label} pageerror ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && report.errors.push(`${label} console ${m.text()}`));
  await page.goto(url);
  await page.waitForFunction(() => !!window.__corners);
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp, label };
}
const touch = (P, type, x, y) => P.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
const shot = async (P, name) => { await P.page.screenshot({ path: `${SHOTS}/${name}` }); log('screenshot', name); };
const tapXY = async (P, x, y) => { await touch(P, 'touchStart', x, y); await P.page.waitForTimeout(40); await touch(P, 'touchEnd', 0, 0); await P.page.waitForTimeout(90); };
const tapCell = async (P, i) => { const c = await P.page.evaluate((i) => window.__corners.cellCenter(i), i); await tapXY(P, c.x + (Math.random() - 0.5) * 8, c.y + (Math.random() - 0.5) * 8); };
const tapSel = async (P, sel) => {
  const b = await P.page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
  await tapXY(P, b.x, b.y); await P.page.waitForTimeout(120);
};
const G = (P) => P.page.evaluate(() => window.__corners.grid());
const info = (P) => P.page.evaluate(() => ({ won: window.__corners.won(), hints: window.__corners.hints(), mistakes: window.__corners.mistakes(), elapsed: window.__corners.elapsed() }));

// ============================================================ Player A: first open of today's puzzle
const A = await player('A', FILE + '?reset');
const P0 = await A.page.evaluate(() => ({ num: window.__corners.num, level: window.__corners.level, ...window.__corners.puzzle }));
log('puzzle', { num: P0.num, level: P0.level, n: P0.n, rows: P0.rows.join(''), cols: P0.cols.join(''), givens: P0.givens.length });
const n = P0.n, sol = P0.sol;
assert(await A.page.isVisible('#sheet-intro.open'), 'first open shows the one-line rule with a tiny animated example');
const rule = (await A.page.textContent('[data-testid=rule]')).trim();
assert(/Give every row and column its number of dots\. Never let four dots form a rectangle\./.test(rule), `rule is one short line: "${rule}"`);
await A.page.waitForTimeout(2900); // the demo reaches its "four dots make a rectangle" moment
assert(await A.page.isVisible('#mini .rect'), 'the animated example shows a rectangle being flagged');
await shot(A, '00-intro.png');
await tapSel(A, '#intro-go');
await A.page.waitForTimeout(400);
assert(!(await A.page.isVisible('#sheet-intro.open')), 'Start closes the intro');
const t0 = (await info(A)).elapsed;
await shot(A, '01-start.png');

// a tap on a given dot does nothing
const before = await G(A);
await tapCell(A, P0.givens[0]);
assert(JSON.stringify(await G(A)) === JSON.stringify(before), 'given dots cannot be changed');

const todo = [...sol].flatMap((c, i) => (c === '1' && !P0.givens.includes(i) ? [i] : []));
const firstHalf = todo.slice(0, Math.floor(todo.length * 0.4));
for (const i of firstHalf) await tapCell(A, i);
let g = await G(A);
assert(firstHalf.every((i) => g[i] === 1), `tapping places dots (${firstHalf.length} placed)`);
// tap cycles: dot -> cross -> empty on a scratch cell
const scratch = [...sol].findIndex((c, i) => c === '0' && g[i] === 0);
await tapCell(A, scratch); const s1 = (await G(A))[scratch];
await tapCell(A, scratch); const s2 = (await G(A))[scratch];
await tapCell(A, scratch); const s3 = (await G(A))[scratch];
assert(s2 === 2 && s3 === 0, `tap cycles dot → ✕ → empty (${s1},${s2},${s3})`);
await A.page.waitForTimeout(2700);
const mAfterCycle = (await info(A)).mistakes;
assert(mAfterCycle === 0, 'cycling a cell through a dot to ✕ is not counted as a slip');

// drag paints ✕ across empty cells
{
  g = await G(A);
  let run = null;
  for (let r = 0; r < n && !run; r++) for (let c = 0; c + 2 < n && !run; c++) {
    const ids = [0, 1, 2].map((k) => r * n + c + k);
    if (ids.every((i) => sol[i] === '0' && g[i] === 0)) run = ids;
  }
  if (run) {
    const a = await A.page.evaluate((i) => window.__corners.cellCenter(i), run[0]);
    const b = await A.page.evaluate((i) => window.__corners.cellCenter(i), run[2]);
    await touch(A, 'touchStart', a.x, a.y);
    for (let k = 1; k <= 10; k++) { await touch(A, 'touchMove', a.x + ((b.x - a.x) * k) / 10, a.y + (Math.random() - 0.5) * 4); await A.page.waitForTimeout(16); }
    await touch(A, 'touchEnd', 0, 0); await A.page.waitForTimeout(150);
    g = await G(A);
    assert(run.every((i) => g[i] === 2), 'dragging across three empty cells marks them all ✕');
    await tapSel(A, '#btn-undo');
    g = await G(A);
    assert(run.every((i) => g[i] === 0), 'one undo removes the whole drag');
  } else log('skip', 'no 3-run of empty cells for the drag test');
}

// a deliberate mistake: a dot that closes a rectangle -> instant red rectangle
const bad = await A.page.evaluate(() => {
  const { puzzle: p } = window.__corners; const g = window.__corners.grid(); const n = p.n;
  for (let i = 0; i < n * n; i++) {
    if (g[i] !== 0) continue;
    const r = Math.floor(i / n), c = i % n;
    for (let r2 = 0; r2 < n; r2++) for (let c2 = 0; c2 < n; c2++) if (r2 !== r && c2 !== c && g[r2 * n + c] === 1 && g[r * n + c2] === 1 && g[r2 * n + c2] === 1) return i;
  }
  return -1;
});
assert(bad >= 0, 'found a cell that would complete a rectangle');
await tapCell(A, bad);
await A.page.waitForTimeout(250);
const rects = await A.page.$$eval('.overlay .rect', (e) => e.length);
const redCells = await A.page.$$eval('.cell.bad', (e) => e.length);
assert(rects >= 1 && redCells >= 4, `the rectangle is outlined in red at once (${rects} outline, ${redCells} red dots)`);
assert((await info(A)).mistakes === mAfterCycle + 1, 'the slip is counted');
await shot(A, '02-conflict.png');
await tapSel(A, '#btn-undo');
assert((await A.page.$$eval('.overlay .rect', (e) => e.length)) === 0, 'undo clears the conflict');

// a hint: explains the next deduction in plain words, highlights it, and "Show me" applies it
await tapSel(A, '#btn-hint');
await A.page.waitForTimeout(250);
const ht = (await A.page.textContent('[data-testid=hint-text]')).trim();
const title = (await A.page.textContent('[data-testid=hint-title]')).trim();
assert(await A.page.isVisible('[data-testid=hintbox]'), 'hint box opens');
assert(ht.length > 30, `hint explains a deduction: [${title}] ${ht}`);
const targets = await A.page.$$eval('.cell.target', (e) => e.map((x) => Number(x.dataset.i)));
assert(targets.length >= 1, `hint highlights ${targets.length} target cell(s)`);
await shot(A, '03-hint.png');
await tapSel(A, '#hint-apply');
g = await G(A);
assert(targets.every((i) => (g[i] === 1) === (sol[i] === '1')), 'the hinted marks are correct');
assert((await info(A)).hints === 1, 'hint counted');

// reload mid-solve: progress and the timer survive
const mid = await G(A);
await A.page.waitForTimeout(1200);
const tBefore = (await info(A)).elapsed;
await A.page.reload();
await A.page.waitForFunction(() => !!window.__corners);
await A.page.waitForTimeout(300);
assert(JSON.stringify(await G(A)) === JSON.stringify(mid), 'reload restores the grid');
const tAfter = (await info(A)).elapsed;
assert(tAfter >= tBefore - 3.5 && tAfter > t0, `timer carries over (${tBefore.toFixed(1)}s → ${tAfter.toFixed(1)}s)`);
assert(!(await A.page.isVisible('#sheet-intro.open')), 'intro does not reappear');

// finish by tapping the remaining dots
g = await G(A);
for (const i of todo) if (g[i] !== 1) { if (g[i] === 2) await tapCell(A, i); await tapCell(A, i); }
await A.page.waitForTimeout(600);
const fin = await info(A);
assert(fin.won, 'puzzle solved by touch');
await A.page.waitForSelector('#sheet-results.open', { timeout: 4000 });
await A.page.waitForTimeout(500);
const share = (await A.page.textContent('[data-testid=share-text]')).trim();
log('share', share);
assert(/^CORNERS #\d+ [⭐✓] \d+:\d\d · (no hints|\d+ hints?)( · \d+ slips?)?\n\w+day [●○]{7}/.test(share), 'spoiler-free share text: "NAME #N ⭐/✓ m:ss · hints"');
assert(share.includes('1 hint') && share.includes(`${fin.mistakes} slip`) && fin.mistakes >= 1, `share reflects the hint and the slip(s) (${fin.mistakes})`);
assert(!/[●○]{8,}|[01]{6,}/.test(share.split('\n')[0]), 'share does not leak the board');
await shot(A, '04-results.png');

// challenge link
await tapSel(A, '#r-chal');
await A.page.waitForTimeout(400);
let chal = await A.page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
const url = (chal.match(/https?:\S+#c=[\w-]+/) || [])[0];
assert(!!url, `challenge text carries a link: ${chal.replace(/\n/g, ' | ')}`);
const code = url ? url.split('#c=')[1] : '';

// stats sheet
await tapXY(A, 195, 60); // tap the dimmed area above the sheet to close it
await A.page.waitForTimeout(450);
await tapSel(A, '#btn-stats');
await A.page.waitForTimeout(400);
assert((await A.page.textContent('#sheet-stats')).includes('Streak'), 'stats sheet shows the streak');
await shot(A, '06-stats.png');

// ============================================================ Player B: opens the challenge link fresh
const B = await player('B', FILE + '?reset#c=' + code);
await B.page.waitForSelector('#sheet-intro.open'); await B.page.waitForTimeout(600);
await tapSel(B, '#intro-go'); await B.page.waitForTimeout(400);
const banner = (await B.page.textContent('[data-testid=challenge-banner]')).trim();
assert(/solved #\d+ in \d+:\d\d/.test(banner), `challenge banner: "${banner}"`);
await shot(B, '05-challenge.png');

// ============================================================ Player C: a Monday, solved straight through by touch
const C = await player('C', FILE + '?reset&dev&p=3');
await C.page.waitForSelector('#sheet-intro.open'); await C.page.waitForTimeout(600);
await tapSel(C, '#intro-go'); await C.page.waitForTimeout(400);
const PC = await C.page.evaluate(() => window.__corners.puzzle);
for (const [i, ch] of [...PC.sol].entries()) if (ch === '1' && !PC.givens.includes(i)) await tapCell(C, i);
await C.page.waitForTimeout(600);
const ci = await info(C);
assert(ci.won && ci.hints === 0 && ci.mistakes === 0, 'Monday solved flawlessly by touch');
await C.page.waitForSelector('#sheet-results.open', { timeout: 4000 });
await C.page.waitForTimeout(400);
assert((await C.page.textContent('[data-testid=share-text]')).includes('⭐'), 'flawless solve earns the ⭐');
await shot(C, '07-monday-flawless.png');

// ============================================================ Player D: Sunday, hints until an "aha" deduction shows up
const D = await player('D', FILE + '?reset&dev&p=2');
await D.page.waitForSelector('#sheet-intro.open'); await D.page.waitForTimeout(600);
await tapSel(D, '#intro-go'); await D.page.waitForTimeout(400);
const seen = [];
for (let k = 0; k < 40; k++) {
  await tapSel(D, '#btn-hint');
  const t = (await D.page.textContent('[data-testid=hint-title]')).trim();
  seen.push(t.replace('Hint · ', ''));
  if (/Pair count/.test(t)) { await D.page.waitForTimeout(200); await shot(D, '03b-hint-aha.png'); break; }
  await tapSel(D, '#hint-apply');
}
log('sunday hint sequence', seen.join(' → '));
assert(seen.some((t) => /Pair count/.test(t)), 'a Sunday hint teaches the "pair count" aha');
// keep going to the end using only hints: they must always find the next deduction
for (let k = 0; k < 60 && !(await info(D)).won; k++) {
  if (!(await D.page.isVisible('#hint-apply'))) await tapSel(D, '#btn-hint');
  const t = (await D.page.textContent('[data-testid=hint-title]')).trim();
  seen.push(t.replace('Hint · ', ''));
  await tapSel(D, '#hint-apply');
}
assert((await info(D)).won, `hints alone carry the Sunday puzzle to the end (${seen.length} hints: ${[...new Set(seen)].join(', ')})`);

report.summary = { asserts: report.asserts, failed: report.failed, errors: report.errors.length };
writeFileSync(`${SHOTS}/e2e.json`, JSON.stringify(report, null, 2));
console.log(report.failed || report.errors.length ? `FAILED ${report.failed} / errors ${report.errors.length}` : `ALL ${report.asserts} ASSERTIONS PASSED`);
if (report.errors.length) console.log(report.errors);
await browser.close();
process.exit(report.failed || report.errors.length ? 1 : 0);
