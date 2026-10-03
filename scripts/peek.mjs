import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('ERR', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
for (const [q, name] of process.argv.slice(2).map((a) => a.split('|'))) {
  await page.goto(FILE + q);
  await page.waitForTimeout(900); if (name !== 'intro' && await page.isVisible('#intro-go')) { await page.click('#intro-go'); await page.waitForTimeout(500); }
  await page.screenshot({ path: `/tmp/${name}.png` });
  console.log('shot', name);
}
await b.close();
