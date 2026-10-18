// Drives the app in a phone-sized browser: seeds a Push/Pull rotation with six weeks of Push,
// follows the rotation, logs a workout with a suggested weight and a PR, finishes it, imports a
// Hevy CSV, then screenshots each screen to screenshots/. Needs `npm run serve` on PORT (default 8093).
//   node scripts/check.mjs            (ENGINE=webkit for Safari's engine)
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('../../kitchen/node_modules/playwright'); }
const engine = pw[process.env.ENGINE || 'chromium'];
const URL_ = `http://localhost:${process.env.PORT || 8093}/lift/`;
mkdirSync('screenshots', { recursive: true });
const out = `screenshots/${process.env.ENGINE || 'chromium'}-`;
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails++; };

// A one-finger vertical swipe (dy > 0 = down) starting in the middle of `sel`, as touch events.
async function swipe(page, sel, dy) {
  await page.evaluate(async ([sel, dy]) => {
    const el = document.querySelector(sel);
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + Math.min(r.height / 2, 120);
    // Desktop WebKit has no Touch constructor: fake the touch list on a plain event there.
    const fire = (type, cy) => {
      const t = { identifier: 1, target: el, clientX: x, clientY: cy };
      const touches = type === 'touchend' ? [] : [t];
      let ev;
      try {
        const real = new Touch(t);
        ev = new TouchEvent(type, { bubbles: true, cancelable: true, touches: touches.length ? [real] : [], changedTouches: [real] });
      } catch {
        ev = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperties(ev, { touches: { value: touches }, changedTouches: { value: [t] } });
      }
      el.dispatchEvent(ev);
    };
    fire('touchstart', y);
    for (let i = 1; i <= 8; i++) { fire('touchmove', y + (dy * i) / 8); await new Promise((r) => setTimeout(r, 16)); }
    fire('touchend', y + dy);
  }, [sel, dy]);
  await page.waitForTimeout(400);
}

const browser = await engine.launch();
const ctxOpts = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', hasTouch: true, isMobile: process.env.ENGINE !== 'firefox' };
const errors = [];
const watch = (page) => {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|jsdelivr|ERR_/.test(m.text())) errors.push(m.text()); });
};

// First launch: nothing saved yet.
{
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  watch(page);
  await page.goto(URL_);
  await page.waitForSelector('[data-hevy]');
  ok(await page.locator('[data-newroutine]').isVisible(), 'first launch offers to build a routine');
  await page.screenshot({ path: out + '0-first-launch.png' });
  await ctx.close();
}

const ctx = await browser.newContext(ctxOpts);
const page = await ctx.newPage();
watch(page);

// Six weeks of Push. Bench hit 8 on every set last time (range 6–8), so it goes up today.
const DAY = 86400000, now = Date.now();
const workouts = [];
for (let i = 6; i >= 1; i--) {
  const start = now - i * 7 * DAY + 3600000;
  const w = 80 + (6 - i) * 2.5;
  workouts.push({ id: 'seed' + i, name: 'Push', start, end: start + 58 * 60000, routineId: 'r1', exercises: [
    { exId: 'bench-bb', note: '', sets: [{ type: 'w', w: 40, r: 10 }, { type: 'n', w, r: 8 }, { type: 'n', w, r: 8 }, { type: 'n', w, r: 8 }] },
    { exId: 'ohp-bb', note: '', sets: [{ type: 'n', w: 40, r: 8 }, { type: 'n', w: 40, r: 8 }] },
    { exId: 'pull-up', note: '', sets: [{ type: 'n', r: 8 + (6 - i) }, { type: 'n', r: 7 }] },
    { exId: 'plank', note: '', sets: [{ type: 'n', t: 60 + (6 - i) * 5 }] },
  ] });
}
const seed = {
  custom: [], workouts, active: null, restFor: {}, settings: { unit: 'kg', rest: 90 }, lastBackup: null,
  routines: [
    { id: 'r1', name: 'Push', items: [{ exId: 'bench-bb', sets: 3, lo: 6, hi: 8 }, { exId: 'ohp-bb', sets: 2, lo: 8, hi: 10 }, { exId: 'pull-up', sets: 2 }, { exId: 'plank', sets: 1 }] },
    { id: 'r2', name: 'Pull', items: [{ exId: 'lat-pulldown', sets: 3, lo: 8, hi: 10 }, { exId: 'row-bb', sets: 3, lo: 6, hi: 8 }, { exId: 'face-pull', sets: 3, lo: 12, hi: 15 }] },
  ],
  plan: { days: [true, false, true, false, true, true, false], pick: null },
};
await page.addInitScript((s) => { if (!localStorage.getItem('lift.v1')) localStorage.setItem('lift.v1', s); }, JSON.stringify(seed));
// paul-hub stand-in: keep what Lift sends.
const sent = [];
await page.route('https://paul-hub.paul-o-a04.workers.dev/api/lift/**', async (route) => {
  sent.push({ url: route.request().url(), body: JSON.parse(route.request().postData() || '{}') });
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ok: true, xp: 1, feed: 1 }) });
});
await page.goto(URL_ + '?c=abcdefgh23456789');
await page.waitForSelector('.next-name');
ok((await page.textContent('.next-name')) === 'Pull', 'rotation: Pull comes after Push');
await page.waitForTimeout(1200); // photos
await page.screenshot({ path: out + '1-today.png' });
await page.screenshot({ path: out + '1b-today-full.png', fullPage: true });

// Gym day toggle
const tue = page.locator('[data-day="1"]');
await tue.click();
ok(await page.locator('[data-day="1"]').getAttribute('aria-pressed') === 'true', 'tapping a day makes it a gym day');
await page.locator('[data-day="1"]').click();

// Do Push instead: it becomes next and shows today's weights.
await page.click('[data-pick]');
await page.locator('.sheet .menu button', { hasText: 'Push' }).click();
await page.waitForTimeout(300);
ok((await page.textContent('.next-name')) === 'Push', 'picking another routine makes it next');
const benchLine = await page.locator('.t-row').first().textContent();
ok(/95\s*kg/.test(benchLine.replace(/\s+/g, ' ')), `bench shows 95 kg today (${benchLine.replace(/\s+/g, ' ').trim()})`);
ok(await page.locator('.t-row').first().locator('.upc').count() === 1, 'bench is marked going up');

// Start it
await page.click('[data-startnext]');
await page.waitForSelector('.ex');
ok(await page.locator('.ex').count() === 4, 'routine starts with 4 exercises');
const bench = page.locator('.ex').first();
ok((await bench.locator('.sug').textContent()).includes('Going up to 95 kg'), 'bench says it is going up');
ok(await bench.locator('[data-f="w"]').nth(1).getAttribute('placeholder') === '95', 'weight hint is the suggested 95');
ok((await page.locator('.ex').nth(1).locator('.sug').textContent()).includes('Staying at 40 kg'), 'press holds at 40');
await bench.locator('[data-tick]').nth(1).click();
ok(await bench.locator('.set-row').nth(1).evaluate((n) => n.classList.contains('done')), 'tick with empty fields uses the hint');
ok(await bench.locator('.set-row').nth(1).locator('.pr').count() === 1, 'beating 92.5 lights a PR');
ok(await page.locator('#rest').isVisible(), 'rest timer starts after a set');
await bench.locator('.set-row').nth(2).locator('[data-f="w"]').fill('97.5');
await bench.locator('.set-row').nth(2).locator('[data-f="r"]').fill('8');
await bench.locator('.set-row').nth(2).locator('[data-tick]').click();
const vol = await page.textContent('#a-vol');
ok(vol === '1,540 kg', `volume counts ticked sets (${vol})`);
const plank = page.locator('.ex').nth(3);
await plank.locator('[data-f="t"]').fill('130');
await plank.locator('[data-f="t"]').blur();
await plank.locator('[data-tick]').click();
ok(await plank.locator('[data-f="t"]').inputValue() === '1:30', 'time "130" reads 1:30');
await page.evaluate(() => scrollTo(0, 0));
await page.screenshot({ path: out + '2-active.png' });
await page.screenshot({ path: out + '2b-active-full.png', fullPage: true });

// Picker: own list first, the database once you search
await page.click('[data-addex]');
await page.waitForSelector('.pick-row');
await page.click('[data-m="Chest"]');
await page.fill('[data-q]', 'pulldown');
await page.waitForTimeout(200);
ok(await page.locator('[data-m=""].on').count() === 1 && await page.locator('.pick-row').count() > 1, 'typing a search drops the Chest filter and searches everything');
await page.waitForTimeout(200);
ok(await page.locator('.pick-sec').count() === 1, 'search shows More exercises from the database');
await page.screenshot({ path: out + '3-picker.png' });
await page.fill('[data-q]', 'lateral');
// Look before adding: the photo opens photos + steps, Add from there selects it
await page.locator('.pick-peek').first().click();
await page.waitForSelector('.peek-body .steps li');
await page.waitForTimeout(400);
ok(await page.locator('.peek-body .flip img').count() >= 1, 'preview shows the exercise photos');
await page.screenshot({ path: out + '3b-peek.png' });
await page.click('.peek-go [data-yes]');
await page.waitForTimeout(300);
ok(await page.locator('.pick-row.on').count() === 1, 'Add in the preview selects the exercise');
await page.locator('.pick-peek').first().click();
await page.waitForSelector('.peek-body .steps li');
await page.waitForTimeout(300);
await swipe(page, '.peek-body .steps', 260);
ok(await page.locator('.sheet-wrap').count() === 1, 'swiping down closes the preview, the picker stays');
await swipe(page, '.pick-list', -200);
ok(await page.locator('.sheet-wrap').count() === 1, 'swiping up in the list does not close the picker');
await page.click('[data-go]');
await page.waitForTimeout(300);
ok(await page.locator('.ex').count() === 5, 'picker adds an exercise');
await page.click('[data-addex]');
await page.waitForSelector('.pick-row');
await page.waitForTimeout(300);
await swipe(page, '.pick-list', 260);
ok(await page.locator('.sheet-wrap').count() === 0, 'swiping down on the list closes the picker');

// Minimise, resume, reload
await page.click('[data-min]');
await page.waitForSelector('#resume:not([hidden])');
await page.click('#resume');
await page.waitForSelector('.ex');
await page.reload();
await page.waitForSelector('.ex');
ok(await page.locator('.set-row.done').count() === 3, 'reload keeps ticked sets');

// Finish
await page.click('[data-finish]');
await page.click('[data-yes]');
await page.waitForSelector('.summary');
ok((await page.locator('.prs').textContent().catch(() => '')).includes('Bench Press'), 'summary shows a bench record');
const nt = (await page.locator('.nt').textContent().catch(() => '')).replace(/\s+/g, ' ');
ok(nt.includes('97.5 → 100 kg'), `next time: bench 97.5 → 100 kg (${nt.trim()})`);
ok((await page.locator('.upnext').textContent()).includes('Pull'), 'summary says Pull is next');
await page.waitForTimeout(400);
await page.screenshot({ path: out + '4-summary.png' });
await page.screenshot({ path: out + '4b-summary-full.png', fullPage: true });
await page.waitForTimeout(3500);
const last = sent[sent.length - 1];
ok(last && last.url.endsWith('/api/lift/abcdefgh23456789'), 'finishing sends to paul-hub with the code from the link');
ok(last && last.body.summary.workouts.length === 7 && last.body.summary.workouts[0].name === 'Push' && last.body.summary.workouts[0].prs >= 1, 'the summary has the new workout and its records');
ok(last && last.body.summary.next.name === 'Pull' && last.body.backup.workouts.length === 7 && !('hub' in last.body.backup.settings), 'next up is Pull; the backup has every workout and not the code');
ok(!page.url().includes('c='), 'the code is taken out of the address bar');
await page.click('[data-done]');
await page.waitForSelector('.next-name');
ok((await page.textContent('.next-name')) === 'Pull', 'Today moves on to Pull');
ok(await page.locator('#resume').isHidden(), 'no resume bar after finishing');

// Routines, editor
await page.click('[data-tab="routines"]');
await page.waitForSelector('.routine');
ok(await page.locator('.routine .badge').count() === 1, 'one routine marked Next');
await page.screenshot({ path: out + '5-routines.png' });
await page.locator('.routine').nth(1).locator('[data-rmenu]').click();
await page.locator('.sheet .menu button', { hasText: 'Edit routine' }).click();
await page.waitForSelector('[data-range]');
ok(await page.locator('[data-range]').first().inputValue() === '8-10', 'editor shows the rep range');
await page.waitForTimeout(800);
await page.screenshot({ path: out + '6-editor.png' });
await page.click('[data-cancel]');

// History
await page.click('[data-tab="history"]');
await page.waitForSelector('.wk');
ok(await page.locator('.wk').count() === 7, 'history lists 7 workouts');
await page.screenshot({ path: out + '7-history.png' });

// Exercise: summary chart, then how-to with photos and steps
await page.click('[data-tab="profile"]');
await page.click('[data-exlib]');
await page.fill('[data-exq]', 'bench barbell');
await page.locator('[data-open="bench-bb"]').click();
await page.waitForSelector('.chart svg');
const box = await page.locator('.chart svg').boundingBox();
await page.mouse.move(box.x + box.width - 20, box.y + 60);
await page.waitForTimeout(100);
ok(await page.locator('.chart .tip').isVisible(), 'chart tooltip shows');
await page.screenshot({ path: out + '8-exercise.png' });
await page.click('[data-xtab="how"]');
await page.waitForSelector('.steps li');
ok(await page.locator('.steps li').count() >= 3, 'how-to lists steps');
ok((await page.locator('a', { hasText: 'Watch on YouTube' }).getAttribute('href')).includes('youtube.com/results'), 'YouTube button links to a search');
await page.waitForTimeout(1200);
await page.screenshot({ path: out + '9-howto.png' });
await page.goBack();
await page.goBack();

// Hevy import: two Upper days become a routine
const csv = ['"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"'];
for (const [d, w] of [[3, 60], [10, 62.5]]) {
  const day = new Date(now - d * DAY);
  const s = `${day.getDate()} ${day.toLocaleString('en-GB', { month: 'short' })} ${day.getFullYear()}, 07:30`;
  const e = `${day.getDate()} ${day.toLocaleString('en-GB', { month: 'short' })} ${day.getFullYear()}, 08:25`;
  csv.push(`"Upper","${s}","${e}","","Bench Press (Barbell)",,"",0,"normal",${w},10,,,`);
  csv.push(`"Upper","${s}","${e}","","Bench Press (Barbell)",,"",1,"normal",${w},9,,,`);
  csv.push(`"Upper","${s}","${e}","","Cable Pec Fly",,"",0,"normal",20,12,,,`);
}
writeFileSync('screenshots/hevy-test.csv', csv.join('\n'));
await page.waitForSelector('[data-hevyfile]', { state: 'attached' });
await page.setInputFiles('[data-hevyfile]', 'screenshots/hevy-test.csv');
await page.waitForSelector('.sheet [data-yes]');
const msg = await page.locator('.sheet-text').textContent();
ok(msg.includes('1 matched to Lift') && msg.includes('1 added as your own'), `import matches names (${msg})`);
await page.waitForTimeout(300);
await page.screenshot({ path: out + '10-hevy.png' });
await page.click('.sheet [data-yes]');
await page.waitForSelector('.sheet-title >> text=Make these your rotation?');
await page.waitForTimeout(300);
await page.screenshot({ path: out + '11-hevy-rotation.png' });
await page.click('.sheet [data-yes]');
await page.waitForSelector('.next-name');
const r = await page.evaluate(() => JSON.parse(localStorage.getItem('lift.v1')).routines.map((x) => x.name));
ok(r.join(',') === 'Push,Pull,Upper', `Upper added to the rotation (${r})`);
await page.click('[data-tab="history"]');
ok(await page.locator('.wk').count() === 9, 'history has the 2 imported workouts');

await page.click('[data-tab="profile"]');
await page.waitForSelector('[data-bars] svg');
await page.screenshot({ path: out + '12-profile.png' });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
ok(!overflow, 'no sideways scroll');
ok(!errors.length, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
