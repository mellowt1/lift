import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtClock, fmtDuration, parseTime, parseNum, e1rm, bests, prsFor, previousSets, weekStart, weeklyCounts, streakWeeks, progression, fmtW } from '../app/logic.js';
import { muscleWeek, suggest, rangeFor, nextRoutine, nextGymDay, parseCSV, parseHevyDate, hevyWorkouts, matchExercise, routinesFromHistory, daysFromHistory, stepFor } from '../app/logic.js';

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

test('suggested weight goes up only when every set hits the top', () => {
  const step = stepFor('Cable', 'kg');
  assert.deepEqual(suggest([S(30, 12, 'w'), S(55, 10), S(55, 10), S(55, 10)], 8, 10, step), { w: 57.5, up: true, last: 55 });
  assert.deepEqual(suggest([S(70, 8), S(70, 7), S(70, 6)], 6, 8, step), { w: 70, up: false, last: 70 });
  assert.equal(suggest([S(14, 12), S(14, 12)], 10, 12, stepFor('Dumbbell', 'kg')).w, 16);
  assert.equal(suggest([S(60, 10), S(40, 15, 'd')], 8, 10, step).up, true, 'drop sets do not block going up');
  assert.equal(suggest([], 8, 10, step), null);
});

test('rep range from reps done', () => {
  assert.deepEqual(rangeFor([10, 10, 9]), [8, 10]);
  assert.deepEqual(rangeFor([12, 12, 12]), [10, 12]);
  assert.deepEqual(rangeFor([8, 6, 7]), [6, 8]);
  assert.deepEqual(rangeFor([]), [8, 12]);
});

test('rotation goes on from the last routine done', () => {
  const R = [{ id: 'push' }, { id: 'pull' }, { id: 'legs' }];
  assert.equal(nextRoutine(R, [], null).id, 'push');
  const done = [{ start: 1, routineId: 'push' }, { start: 2, routineId: 'pull' }];
  assert.equal(nextRoutine(R, done, null).id, 'legs');
  assert.equal(nextRoutine(R, [...done, { start: 3, routineId: 'legs' }], null).id, 'push');
  assert.equal(nextRoutine(R, done, 'push').id, 'push', 'a picked routine wins');
  assert.equal(nextRoutine([], done, null), null);
  assert.equal(nextRoutine(R, [{ start: 1, routineId: 'push', routineIds: ['push', 'pull'] }], null).id, 'legs', 'two routines in one workout skip past both');
  assert.equal(nextRoutine(R, [{ start: 1, routineId: 'push', routineIds: ['push', 'legs'] }], null).id, 'pull', 'a routine skipped over is still next');
  assert.equal(nextRoutine(R, [{ start: 1, routineId: 'pull', routineIds: ['pull', 'legs', 'push'] }], null).id, 'legs', 'all three done: round again');
});

test('sets per muscle per week', () => {
  const now = new Date(2026, 9, 19, 12).getTime();
  const muscle = (id) => ({ bench: 'Chest', row: 'Back' })[id];
  const w = (daysAgo, exId, sets) => ({ start: now - daysAgo * DAY, exercises: [{ exId, sets }] });
  const ws = [w(40, 'bench', [S(60, 8)]), w(20, 'bench', [S(40, 10, 'w'), S(60, 8), S(60, 8)]), w(6, 'bench', [S(60, 8), S(60, 8)]), w(6, 'row', [S(50, 10)])];
  const out = muscleWeek(ws, muscle, now);
  assert.equal(out.workouts, 3, 'only the last four weeks');
  assert.deepEqual(out.sets, { Chest: 1, Back: 0.3 }, 'warm-ups left out, per week over four weeks');
  assert.equal(muscleWeek([w(14, 'row', [S(50, 10), S(50, 10), S(50, 10), S(50, 10)])], muscle, now).sets.Back, 2, 'two weeks of history count as two weeks');
  assert.deepEqual(muscleWeek([], muscle, now), { weeks: 0, sets: {}, workouts: 0 });
});

test('next gym day', () => {
  const wed = new Date(2026, 9, 21, 9).getTime(); // Wed 21 Oct 2026
  const days = [true, false, true, false, true, true, false];
  assert.equal(new Date(nextGymDay(days, [], wed)).getDate(), 21, 'today when nothing logged');
  assert.equal(new Date(nextGymDay(days, [{ start: wed - 3600000 }], wed)).getDate(), 23, 'Friday after training today');
  assert.equal(nextGymDay([false, false, false, false, false, false, false], [], wed), null);
});

test('csv and Hevy dates', () => {
  assert.deepEqual(parseCSV('a,"b, c","d ""q"""\n1,2,3\n'), [['a', 'b, c', 'd "q"'], ['1', '2', '3']]);
  const d = new Date(parseHevyDate('18 Oct 2026, 08:30'));
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()], [2026, 9, 18, 8, 30]);
  assert.equal(new Date(parseHevyDate('Oct 18, 2026, 8:30 PM')).getHours(), 20);
  assert.equal(parseHevyDate('junk'), null);
});

const HEVY = [
  '"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"',
  '"Pull","14 Oct 2026, 18:00","14 Oct 2026, 18:55","","Lat Pulldown (Cable)",,"seat 4",0,"warmup",30,12,,,',
  '"Pull","14 Oct 2026, 18:00","14 Oct 2026, 18:55","","Lat Pulldown (Cable)",,"seat 4",1,"normal",55,10,,,',
  '"Pull","14 Oct 2026, 18:00","14 Oct 2026, 18:55","","Lat Pulldown (Cable)",,"seat 4",2,"normal",55,9,,,',
  '"Pull","14 Oct 2026, 18:00","14 Oct 2026, 18:55","","Pull Up",,"",0,"normal",,8,,,',
  '"Pull","14 Oct 2026, 18:00","14 Oct 2026, 18:55","","Dead Hang",,"",0,"normal",,,,45,',
  '"Push","16 Oct 2026, 18:00","16 Oct 2026, 19:00","good one","Bench Press (Barbell)",,"",0,"normal",80,8,,,',
].join('\n');

test('Hevy export becomes workouts', () => {
  const list = hevyWorkouts(HEVY);
  assert.equal(list.length, 2);
  const pull = list[0];
  assert.equal(pull.name, 'Pull');
  assert.equal(pull.end - pull.start, 55 * 60000);
  assert.deepEqual(pull.exercises.map((e) => e.title), ['Lat Pulldown (Cable)', 'Pull Up', 'Dead Hang']);
  assert.deepEqual(pull.exercises[0].sets.map((s) => s.type), ['w', 'n', 'n']);
  assert.equal(pull.exercises[0].note, 'seat 4');
  assert.equal(pull.exercises[2].sets[0].t, 45);
  assert.equal(list[1].note, 'good one');
});

test('Hevy names match Lift exercises', () => {
  const lib = [{ name: 'Pull-up' }, { name: 'Lat Pulldown (Cable)' }, { name: 'Face Pull (Cable)' }, { name: 'Bench Press (Barbell)' }, { name: 'Bench Press (Dumbbell)' }];
  assert.equal(matchExercise('Pull Up', lib).name, 'Pull-up');
  assert.equal(matchExercise('Face Pull', lib).name, 'Face Pull (Cable)');
  assert.equal(matchExercise('Bench Press', lib), null, 'two bench presses: no guess');
  assert.equal(matchExercise('Dead Hang', lib), null);
});

test('routines and gym days from history', () => {
  const at = (d, h = 18) => new Date(2026, 9, d, h).getTime();
  const mk = (name, d, w) => ({ name, start: at(d), exercises: [{ exId: 'x', sets: [S(w, 10), S(w, 10), S(w, 9)] }] });
  const hist = [mk('Pull', 5, 50), mk('Push', 7, 80), mk('Pull', 12, 55), mk('Push', 14, 82.5), mk('Legs', 15, 100)];
  const r = routinesFromHistory(hist, at(1), () => 'wr');
  assert.deepEqual(r.map((x) => x.name), ['Pull', 'Push'], 'Legs only once; Pull done longest ago comes first');
  assert.deepEqual(r[0].items[0], { exId: 'x', sets: 3, lo: 8, hi: 10 });
  assert.deepEqual(daysFromHistory(hist, at(16)), [false, false, false, false, false, false, false], 'two weeks is not a pattern');
  const mondays = [5, 12, 19, 26].map((d) => ({ start: new Date(2026, 9, d, 18).getTime() }));
  assert.deepEqual(daysFromHistory(mondays, at(27)), [true, false, false, false, false, false, false], 'four Mondays is');
});

test('rep range ignores one odd set', () => {
  assert.deepEqual(rangeFor([12, 10, 8, 3]), [8, 10]);
  assert.deepEqual(rangeFor([40, 40, 40]), [35, 40]);
});

test('Hevy names: plurals match, different equipment does not', () => {
  const lib = [{ name: 'Chest Fly (Dumbbell)' }, { name: 'Cable Fly Crossover' }, { name: 'Scapular Pull-Up' }];
  assert.equal(matchExercise('Chest Fly (Machine)', lib), null);
  assert.equal(matchExercise('Cable Fly Crossovers', lib).name, 'Cable Fly Crossover');
  assert.equal(matchExercise('Scapular Pull Ups', lib, { exactOnly: true }).name, 'Scapular Pull-Up');
});

import { plan, sessionsOf, breakCut, warmups } from '../app/logic.js';

test('break cut steps: none under 2 weeks, then 10, 20, 30 %', () => {
  assert.equal(breakCut(13), 0);
  assert.equal(breakCut(14), 0.1);
  assert.equal(breakCut(21), 0.2);
  assert.equal(breakCut(41), 0.2);
  assert.equal(breakCut(42), 0.3);
});

test('plan: no break behaves like suggest', () => {
  const now = 100 * DAY;
  const s = sessionsOf([wk('a', now - 5 * DAY, 'x', [S(100, 12), S(100, 12)])], 'x');
  assert.deepEqual(plan(s, 8, 12, 2.5, now), { w: 102.5, up: true, last: 100 });
  assert.equal(plan(s, null, null, 2.5, now), null);
});

test('plan: 3 weeks off drops 20 % from what was lifted, rounded down to the step', () => {
  const now = 100 * DAY;
  const s = sessionsOf([wk('a', now - 22 * DAY, 'x', [S(105, 12), S(105, 12)])], 'x');
  const p = plan(s, 8, 12, 2.5, now);
  assert.equal(p.w, 82.5);
  assert.equal(p.up, false);
  assert.deepEqual(p.back, { days: 22, cut: 0.2, to: 105 });
  assert.equal(plan(s, null, null, 2.5, now).w, 82.5, 'no range still drops after a break');
});

test('plan: climbs back half the gap per session, never past the old weight', () => {
  const now = 100 * DAY;
  const hist = [wk('a', 50 * DAY, 'x', [S(100, 10)]), wk('b', 80 * DAY, 'x', [S(80, 10)])];
  assert.deepEqual(plan(sessionsOf(hist, 'x'), 8, 12, 2.5, hist.at(-1).start + 3 * DAY), { w: 90, up: true, last: 80, climb: { to: 100 } });
  hist.push(wk('c', 84 * DAY, 'x', [S(90, 10)]));
  assert.equal(plan(sessionsOf(hist, 'x'), 8, 12, 2.5, hist.at(-1).start + 3 * DAY).w, 95);
  hist.push(wk('d', 88 * DAY, 'x', [S(97.5, 9)]));
  assert.equal(plan(sessionsOf(hist, 'x'), 8, 12, 2.5, hist.at(-1).start + 3 * DAY).w, 100);
  hist.push(wk('e', 92 * DAY, 'x', [S(100, 9)]));
  assert.deepEqual(plan(sessionsOf(hist, 'x'), 8, 12, 2.5, hist.at(-1).start + 3 * DAY), { w: 100, up: false, last: 100 }, 'back at the old weight: normal again');
});

test('plan: no climb when last time missed the bottom of the range', () => {
  const now = 100 * DAY;
  const hist = [wk('a', 50 * DAY, 'x', [S(100, 10)]), wk('b', 80 * DAY, 'x', [S(80, 6)])];
  assert.deepEqual(plan(sessionsOf(hist, 'x'), 8, 12, 2.5, hist.at(-1).start + 3 * DAY), { w: 80, up: false, last: 80 });
});

test('warm-ups: two normally, three after a break, none under 20 kg, bar minimum', () => {
  assert.deepEqual(warmups(100, 2.5), [{ w: 50, r: 10 }, { w: 75, r: 5 }]);
  assert.deepEqual(warmups(100, 2.5, { back: true }), [{ w: 40, r: 10 }, { w: 60, r: 6 }, { w: 80, r: 3 }]);
  assert.deepEqual(warmups(18, 2), []);
  assert.deepEqual(warmups(30, 2.5, { min: 20 }), [{ w: 20, r: 10 }, { w: 22.5, r: 5 }]);
  assert.deepEqual(warmups(22, 2, { min: 20 }), [{ w: 20, r: 10 }], 'the bar once, no repeats');
});

import { hrStats, hrPerExercise, kcalPerMin } from '../app/logic.js';

test('heart rate: time-weighted average, peak, calories, gaps capped', () => {
  const t0 = 1_000_000;
  const s = [[t0, 100], [t0 + 60000, 140], [t0 + 120000, 120], [t0 + 900000, 100]];
  const h = hrStats(s, t0, t0 + 905000, { kg: 77, age: 27 });
  // 100 for 60 s, 140 for 60 s, 120 for 120 s (capped), 100 for 5 s
  assert.equal(h.avg, Math.round((100 * 60 + 140 * 60 + 120 * 120 + 100 * 5) / 245));
  assert.equal(h.max, 140);
  const k = kcalPerMin(100, 77, 27) * 1 + kcalPerMin(140, 77, 27) + kcalPerMin(120, 77, 27) * 2 + kcalPerMin(100, 77, 27) * 5 / 60;
  assert.equal(h.kcal, Math.round(k));
  assert.equal(hrStats(s, t0, t0 + 905000).kcal, null, 'no weight or age: no calories');
  assert.equal(hrStats(s.slice(0, 2), t0, t0 + 1e6), null, 'too few samples');
  assert.ok(h.line.length >= 3 && h.line.length <= 15 && h.line.every(([sec, b]) => sec >= 0 && b >= 100));
});

test('heart rate per exercise uses the ticks', () => {
  const s = [[0, 90], [50000, 130], [100000, 150], [400000, 100]];
  const ex = [{ exId: 'a', sets: [{ at: 60000 }, { at: 100000 }] }, { exId: 'b', sets: [{}] }];
  assert.deepEqual(hrPerExercise(s, ex), { a: { avg: Math.round((90 + 130 + 150) / 3), max: 150 } });
});
