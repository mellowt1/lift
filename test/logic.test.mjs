import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtClock, fmtDuration, parseTime, parseNum, e1rm, bests, prsFor, previousSets, weekStart, weeklyCounts, streakWeeks, progression, fmtW } from '../app/logic.js';

const DAY = 86400000;
const wk = (id, start, exId, sets) => ({ id, name: id, start, end: start + 3600000, exercises: [{ exId, note: '', sets }] });
const S = (w, r, type = 'n') => ({ type, w, r, t: null });

test('clock and duration', () => {
  assert.equal(fmtClock(90), '1:30');
  assert.equal(fmtClock(3725), '1:02:05');
  assert.equal(fmtDuration(65 * 60000), '1h 5m');
  assert.equal(fmtDuration(42 * 60000), '42m');
});

test('parsing', () => {
  assert.equal(parseTime('1:30'), 90);
  assert.equal(parseTime('abc'), null);
  assert.equal(parseNum('62,5'), 62.5);
  assert.equal(parseNum(''), null);
  assert.equal(parseNum('-3'), null);
});

test('units round trip', () => {
  assert.equal(fmtW(100, 'kg'), '100');
  assert.equal(fmtW(100 / 2.20462, 'lb'), '100');
});

test('e1rm', () => {
  assert.equal(e1rm(100, 1), 100);
  assert.equal(Math.round(e1rm(100, 10)), 133);
});

test('bests leave out warm-ups', () => {
  const b = bests([wk('a', 0, 'x', [S(200, 1, 'w'), S(100, 5)])], 'x');
  assert.equal(b.weight, 100);
});

test('records: first session sets none, beating it sets some', () => {
  const kind = () => 'wr';
  const a = wk('a', 0, 'x', [S(100, 5)]);
  const b = wk('b', DAY, 'x', [S(105, 5)]);
  const c = wk('c', 2 * DAY, 'x', [S(90, 5)]);
  const all = [a, b, c];
  assert.equal(prsFor(all, a, kind).length, 0);
  assert.deepEqual(prsFor(all, b, kind).map((p) => p.key), ['weight', 'e1rm', 'volume']);
  assert.equal(prsFor(all, c, kind).length, 0);
});

test('previous sets come from the latest earlier workout', () => {
  const a = wk('a', 0, 'x', [S(100, 5)]);
  const b = wk('b', DAY, 'x', [S(110, 3), S(110, 3)]);
  assert.equal(previousSets([a, b], 'x').length, 2);
  assert.equal(previousSets([a, b], 'x', 'b')[0].w, 100);
});

test('weeks and streak', () => {
  const now = new Date(2026, 8, 30, 12).getTime(); // Wed 30 Sep 2026
  assert.equal(new Date(weekStart(now)).getDate(), 28);
  const list = [wk('a', now - 7 * DAY, 'x', [S(1, 1)]), wk('b', now - 14 * DAY, 'x', [S(1, 1)])];
  assert.equal(streakWeeks(list, now), 2);
  const weeks = weeklyCounts(list, 4, now);
  assert.deepEqual(weeks.map((w) => w.count), [0, 1, 1, 0]);
  assert.equal(progression(list, 'x', 'wr').length, 2);
});
