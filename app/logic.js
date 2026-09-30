// Pure helpers: numbers, time, records and stats. No DOM here, so node --test can load it.

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const LB = 2.20462;
export const toUnit = (kg, unit) => (unit === 'lb' ? kg * LB : kg);
export const fromUnit = (v, unit) => (unit === 'lb' ? v / LB : v);

// Weight as the lifter reads it: at most one decimal, no trailing ".0".
export function fmtNum(n) {
  if (n == null || Number.isNaN(n)) return '';
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
export const fmtW = (kg, unit) => fmtNum(toUnit(kg, unit));

export function fmtBig(n) {
  return Math.round(n).toLocaleString('en-US');
}

// Seconds as m:ss (or h:mm:ss past an hour).
export function fmtClock(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

// Workout length as "1h 5m" / "42m" / "40s".
export function fmtDuration(ms) {
  const min = Math.round(ms / 60000);
  if (min < 1) return `${Math.max(0, Math.round(ms / 1000))}s`;
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

// "90", "1:30" or "1:02:00" → seconds. Empty or junk → null.
export function parseTime(text) {
  const t = String(text ?? '').trim();
  if (!t) return null;
  if (!/^\d+(:\d{1,2}){0,2}$/.test(t)) return null;
  return t.split(':').reduce((acc, p) => acc * 60 + Number(p), 0);
}

export function parseNum(text) {
  const t = String(text ?? '').trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Epley. One rep is the lift itself.
export function e1rm(w, r) {
  if (!w || !r) return 0;
  return r === 1 ? w : w * (1 + r / 30);
}

export const isWork = (s) => s.type !== 'w';

export function setVolume(s) {
  return (s.w || 0) * (s.r || 0);
}

export function workoutVolume(wk) {
  let v = 0;
  for (const ex of wk.exercises) for (const s of ex.sets) v += setVolume(s);
  return v;
}

export function workoutSetCount(wk) {
  return wk.exercises.reduce((n, ex) => n + ex.sets.length, 0);
}

// Best numbers for one exercise across the given workouts (warm-ups left out).
export function bests(workouts, exId) {
  const b = { weight: 0, e1rm: 0, volume: 0, reps: 0, time: 0 };
  for (const wk of workouts) {
    for (const ex of wk.exercises) {
      if (ex.exId !== exId) continue;
      for (const s of ex.sets) {
        if (!isWork(s)) continue;
        if (s.w) b.weight = Math.max(b.weight, s.w);
        if (s.w && s.r) b.e1rm = Math.max(b.e1rm, e1rm(s.w, s.r));
        b.volume = Math.max(b.volume, setVolume(s));
        if (s.r) b.reps = Math.max(b.reps, s.r);
        if (s.t) b.time = Math.max(b.time, s.t);
      }
    }
  }
  return b;
}

const PR_KEYS = { wr: ['weight', 'e1rm', 'volume'], r: ['reps'], t: ['time'] };
export const PR_LABEL = { weight: 'Heaviest weight', e1rm: 'Best est. 1RM', volume: 'Best set volume', reps: 'Most reps', time: 'Longest time' };

// Records set by `wk` compared with every workout that started before it.
// A first-ever session sets no records: there was nothing to beat.
export function prsFor(workouts, wk, kindOf) {
  const before = workouts.filter((o) => o.id !== wk.id && o.start < wk.start);
  const out = [];
  for (const ex of wk.exercises) {
    const had = before.some((o) => o.exercises.some((e) => e.exId === ex.exId));
    if (!had) continue;
    const old = bests(before, ex.exId);
    const now = bests([{ exercises: [ex] }], ex.exId);
    for (const key of PR_KEYS[kindOf(ex.exId)] || []) {
      if (now[key] > old[key] + 1e-9) out.push({ exId: ex.exId, key, value: now[key], was: old[key] });
    }
  }
  return out;
}

// Sets from the most recent earlier workout that had this exercise.
export function previousSets(workouts, exId, skipId) {
  let best = null;
  for (const wk of workouts) {
    if (wk.id === skipId) continue;
    if (!wk.exercises.some((e) => e.exId === exId)) continue;
    if (!best || wk.start > best.start) best = wk;
  }
  if (!best) return [];
  return best.exercises.filter((e) => e.exId === exId).flatMap((e) => e.sets);
}

// Monday 00:00 local time of the week `ts` falls in.
export function weekStart(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

// Workouts per week for the last `n` weeks, oldest first.
export function weeklyCounts(workouts, n, now = Date.now()) {
  const thisWeek = weekStart(now);
  const weeks = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(thisWeek);
    d.setDate(d.getDate() - 7 * i);
    weeks.push({ start: d.getTime(), count: 0, volume: 0 });
  }
  for (const wk of workouts) {
    const ws = weekStart(wk.start);
    const row = weeks.find((w) => w.start === ws);
    if (row) { row.count++; row.volume += workoutVolume(wk); }
  }
  return weeks;
}

// Weeks in a row with at least one workout, counting back from this week.
// An empty current week does not break the streak until it is over.
export function streakWeeks(workouts, now = Date.now()) {
  const have = new Set(workouts.map((w) => weekStart(w.start)));
  const d = new Date(weekStart(now));
  if (!have.has(d.getTime())) d.setDate(d.getDate() - 7);
  let n = 0;
  while (have.has(d.getTime())) { n++; d.setDate(d.getDate() - 7); }
  return n;
}

// One point per session for the exercise chart: best e1RM, reps or time.
export function progression(workouts, exId, kind) {
  const pts = [];
  for (const wk of [...workouts].sort((a, b) => a.start - b.start)) {
    const sets = wk.exercises.filter((e) => e.exId === exId).flatMap((e) => e.sets).filter(isWork);
    if (!sets.length) continue;
    let v = 0;
    for (const s of sets) {
      if (kind === 'wr') v = Math.max(v, e1rm(s.w, s.r));
      else if (kind === 'r') v = Math.max(v, s.r || 0);
      else v = Math.max(v, s.t || 0);
    }
    if (v > 0) pts.push({ t: wk.start, v });
  }
  return pts;
}
