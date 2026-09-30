// Drives the app in a phone-sized browser: seeds history, logs a workout, finishes it,
// then screenshots each screen to screenshots/. Needs `npm run serve` on PORT (default 8093).
//   node scripts/check.mjs            (ENGINE=webkit for Safari's engine, SCHEME=light)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('../../kitchen/node_modules/playwright'); }
const engine = pw[process.env.ENGINE || 'chromium'];
const URL_ = `http://localhost:${process.env.PORT || 8093}/lift/`;
const scheme = process.env.SCHEME || 'dark';
const out = `screenshots/${process.env.ENGINE || 'chromium'}-${scheme}-`;
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails++; };

const browser = await engine.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, hasTouch: true, isMobile: process.env.ENGINE !== 'firefox' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('fonts.g')) errors.push(m.text()); });

// Seed six weeks of Push days so Previous, records and charts have something to show.
const DAY = 86400000, now = Date.now();
const workouts = [];
for (let i = 6; i >= 1; i--) {
  const start = now - i * 7 * DAY + 3600000;
  const w = 80 + (6 - i) * 2.5;
  workouts.push({ id: 'seed' + i, name: 'Push', start, end: start + 58 * 60000, routineId: 'r1', exercises: [
    { exId: 'bench-bb', note: '', sets: [{ type: 'w', w: 40, r: 10 }, { type: 'n', w, r: 8 }, { type: 'n', w, r: 8 }, { type: 'n', w, r: 7 }] },
    { exId: 'ohp-bb', note: '', sets: [{ type: 'n', w: 40 + i, r: 8 }, { type: 'n', w: 40, r: 8 }] },
    { exId: 'pull-up', note: '', sets: [{ type: 'n', r: 8 + (6 - i) }, { type: 'n', r: 7 }] },
    { exId: 'plank', note: '', sets: [{ type: 'n', t: 60 + (6 - i) * 5 }] },
  ] });
}
const seed = { custom: [], routines: [{ id: 'r1', name: 'Push', items: [{ exId: 'bench-bb', sets: 4 }, { exId: 'ohp-bb', sets: 2 }, { exId: 'pull-up', sets: 2 }, { exId: 'plank', sets: 1 }] }], workouts, active: null, restFor: {}, settings: { unit: 'kg', rest: 90 }, lastBackup: null };
await page.addInitScript((s) => { if (!localStorage.getItem('lift.v1')) localStorage.setItem('lift.v1', s); }, JSON.stringify(seed));
await page.goto(URL_);
await page.waitForSelector('.head h1');
await page.screenshot({ path: out + '1-workout.png' });

// Start the routine: previous values show as hints.
await page.click('[data-rstart]');
await page.waitForSelector('.ex');
ok(await page.locator('.ex').count() === 4, 'routine starts with 4 exercises');
const bench = page.locator('.ex').first();
const prevTxt = await bench.locator('.prev').nth(1).textContent();
ok(prevTxt.includes('92.5 kg × 8'), `previous shows last session (${prevTxt})`);
// Set 2 of bench from the hint, set 3 typed heavier.
await bench.locator('[data-tick]').nth(1).click();
ok(await bench.locator('.set-row').nth(1).evaluate((n) => n.classList.contains('done')), 'tick with empty fields uses the hint');
ok(await page.locator('#rest').isVisible(), 'rest timer starts after a set');
await bench.locator('.set-row').nth(2).locator('[data-f="w"]').fill('95');
await bench.locator('.set-row').nth(2).locator('[data-f="r"]').fill('8');
await bench.locator('.set-row').nth(2).locator('[data-tick]').click();
const vol = await page.textContent('#a-vol');
ok(vol === '1,500 kg', `volume counts ticked sets (${vol})`);
// Plank time typed microwave-style.
const plank = page.locator('.ex').nth(3);
await plank.locator('[data-f="t"]').fill('130');
await plank.locator('[data-f="t"]').blur();
await plank.locator('[data-tick]').click();
ok(await plank.locator('[data-f="t"]').inputValue() === '1:30', 'time "130" reads 1:30');
await page.evaluate(() => scrollTo(0, 0));
await page.screenshot({ path: out + '2-active.png' });
await page.screenshot({ path: out + '2b-active-full.png', fullPage: true });

// Set menu
await bench.locator('[data-setmenu]').first().click();
await page.waitForSelector('.sheet .menu');
await page.waitForTimeout(300);
await page.screenshot({ path: out + '2c-setmenu.png' });
await page.locator('.sheet .menu button', { hasText: 'Cancel' }).count();
await page.click('.sheet [data-cancel]');
await page.waitForTimeout(300);

// Picker
await page.click('[data-addex]');
await page.waitForSelector('.pick-row');
await page.fill('[data-q]', 'lateral');
await page.locator('.pick-row').first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: out + '3-picker.png' });
await page.click('[data-go]');
await page.waitForTimeout(300);
ok(await page.locator('.ex').count() === 5, 'picker adds an exercise');

// Minimise and resume
await page.click('[data-min]');
await page.waitForSelector('#resume:not([hidden])');
ok(true, 'minimise shows the resume bar');
await page.screenshot({ path: out + '4-resume.png' });
await page.click('#resume');
await page.waitForSelector('.ex');

// Reload keeps the workout
await page.reload();
await page.waitForSelector('.ex');
ok(await page.locator('.set-row.done').count() === 3, 'reload keeps ticked sets');

// Finish
await page.click('[data-finish]');
await page.click('[data-yes]');
await page.waitForSelector('.summary');
const prText = await page.locator('.prs').textContent().catch(() => '');
ok(prText.includes('Bench Press'), 'summary shows a bench record');
await page.waitForTimeout(400);
await page.screenshot({ path: out + '5-summary.png' });
await page.click('[data-done]');
await page.waitForSelector('.head h1');
ok(await page.locator('#resume').isHidden(), 'no resume bar after finishing');
ok(await page.locator('#tabs').isVisible(), 'tabs back after finishing');

// History, detail, exercise, profile
await page.click('[data-tab="history"]');
await page.waitForSelector('.wk');
ok(await page.locator('.wk').count() === 7, 'history lists 7 workouts');
await page.screenshot({ path: out + '6-history.png' });
await page.locator('.wk').first().click();
await page.waitForSelector('.d-ex');
await page.screenshot({ path: out + '7-detail.png' });
await page.goBack();
await page.waitForSelector('.wk');
await page.click('[data-tab="exercises"]');
await page.fill('[data-exq]', 'bench barbell');
await page.locator('[data-open="bench-bb"]').click();
await page.waitForSelector('.chart svg');
const box = await page.locator('.chart svg').boundingBox();
await page.mouse.move(box.x + box.width - 20, box.y + 60);
await page.waitForTimeout(100);
ok(await page.locator('.chart .tip').isVisible(), 'chart tooltip shows');
await page.screenshot({ path: out + '8-exercise.png' });
await page.click('[data-tab="profile"]');
await page.waitForSelector('[data-bars] svg');
await page.screenshot({ path: out + '9-profile.png' });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
ok(!overflow, 'no sideways scroll');
ok(!errors.length, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
