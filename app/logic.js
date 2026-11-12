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

// ---------- Lift 2: rep ranges, suggested weights, rotation ----------

// Rep ranges the routine editor offers. A range drives the suggested weight.
export const RANGES = [[3, 5], [4, 6], [5, 8], [6, 8], [6, 10], [8, 10], [8, 12], [10, 12], [10, 15], [12, 15], [15, 20]];
export const DEFAULT_RANGE = [8, 12];

// Sets that count for progression: not warm-ups, not drop sets.
const counts = (s) => s.type !== 'w' && s.type !== 'd';

// One weight step: 2 kg for dumbbells, 2.5 kg for everything else, 5 lb in pounds.
export function stepFor(equip, unit) {
  if (unit === 'lb') return 5 / 2.20462;
  return equip === 'Dumbbell' ? 2 : 2.5;
}

// Next weight from last session's sets. Every counting set at the top of the
// range (or above) means one step up; anything less keeps the weight. Never down.
export function suggest(prev, lo, hi, step) {
  const work = prev.filter((s) => counts(s) && s.w);
  if (!work.length || !hi) return null;
  const top = Math.max(...work.map((s) => s.w));
  const up = work.every((s) => (s.r || 0) >= hi);
  return { w: Math.round((up ? top + step : top) * 1000) / 1000, up, last: top };
}

// ---------- Back after a break ----------
// A gap of two weeks or more on one exercise drops its weight: 2–3 weeks −10 %, 3–6 weeks −20 %,
// longer −30 %. The sessions after that climb back, each one closing about half of what is left.
export const BREAK_DAYS = 14;
export function breakCut(days) {
  if (days < BREAK_DAYS) return 0;
  if (days < 21) return 0.1;
  if (days < 42) return 0.2;
  return 0.3;
}
const r3 = (n) => Math.round(n * 1000) / 1000;
const topOf = (sets) => sets.filter((s) => counts(s) && s.w).reduce((m, s) => Math.max(m, s.w), 0);

// Sessions of one exercise, oldest first: [{ start, sets }].
export function sessionsOf(workouts, exId) {
  return workouts
    .filter((w) => w.exercises.some((e) => e.exId === exId))
    .sort((a, b) => a.start - b.start)
    .map((w) => ({ start: w.start, sets: w.exercises.filter((e) => e.exId === exId).flatMap((e) => e.sets) }));
}

// Weight for the next session of one exercise. Without a rep range there is only a number
// when a break changes it; the plain case keeps last time's weights per set.
export function plan(sessions, lo, hi, step, now = Date.now()) {
  if (!sessions.length) return null;
  const last = sessions[sessions.length - 1];
  const top = topOf(last.sets);
  if (!top) return null;
  const base = hi ? suggest(last.sets, lo, hi, step) : null;
  const days = Math.floor((now - last.start) / 86400000);
  const cut = breakCut(days);
  if (cut) {
    const w = Math.max(step, Math.floor((top * (1 - cut)) / step + 1e-9) * step);
    return w < top ? { w: r3(w), up: false, last: top, back: { days, cut, to: top } } : base;
  }
  // Climbing back: a break before one of the last four sessions, still under the weight from before it,
  // and last time every set reached the bottom of the range.
  for (let k = sessions.length - 1; k >= 1 && sessions.length - k <= 4; k--) {
    if ((sessions[k].start - sessions[k - 1].start) / 86400000 < BREAK_DAYS) continue;
    const to = topOf(sessions[k - 1].sets);
    if (!to || top >= to - 1e-9) break;
    const ok = !lo || last.sets.filter((s) => counts(s) && s.w).every((s) => (s.r || 0) >= lo);
    if (!ok) break;
    const w = Math.min(to, top + Math.ceil((to - top) / 2 / step - 1e-9) * step);
    if (w > (base?.w ?? top) + 1e-9) return { w: r3(w), up: true, last: top, climb: { to } };
    break;
  }
  return base;
}

// Warm-up sets before a heavy work weight: 50 % × 10 and 75 % × 5, or after a break
// 40 % × 10, 60 % × 6 and 80 % × 3. Rounded to the weight step, never under `min`
// (the empty bar), and a weight that repeats or reaches the work weight is left out.
export const HEAVY_KG = 20;
export function warmups(work, step, { back = false, min = 0 } = {}) {
  if (!work || work < HEAVY_KG) return [];
  const steps = back ? [[0.4, 10], [0.6, 6], [0.8, 3]] : [[0.5, 10], [0.75, 5]];
  const out = [];
  for (const [p, r] of steps) {
    const w = r3(Math.max(min, step, Math.round((work * p) / step) * step));
    if (w >= work - 1e-9 || out.some((o) => o.w === w)) continue;
    out.push({ w, r });
  }
  return out;
}

// Range for the reps someone usually does: the narrowest offered range around the
// median set, ties to the one whose top is nearest. One odd set (a 3-rep grinder
// or a 24-rep burnout) does not stretch it. Past 20 reps: the five below the median.
export function rangeFor(reps) {
  const r = reps.filter((n) => n > 0).sort((a, b) => a - b);
  if (!r.length) return DEFAULT_RANGE;
  const mid = r.length % 2 ? r[(r.length - 1) / 2] : (r[r.length / 2 - 1] + r[r.length / 2]) / 2;
  const fits = RANGES.filter(([lo, hi]) => lo <= mid && hi >= mid);
  if (!fits.length) { const m = Math.round(mid); return [Math.max(1, m - 5), m]; }
  fits.sort((a, b) => (a[1] - a[0]) - (b[1] - b[0]) || (a[1] - mid) - (b[1] - mid));
  return fits[0];
}

// Work sets per muscle per week over the last `days` days (warm-ups left out). Counted over the
// time since the first workout when that is shorter, so a new user is not marked low everywhere.
export function muscleWeek(workouts, muscleOf, now = Date.now(), days = 28) {
  const from = now - days * 86400000;
  const recent = workouts.filter((w) => w.start >= from && w.start <= now);
  if (!recent.length) return { weeks: 0, sets: {}, workouts: 0 };
  const first = Math.min(...workouts.map((w) => w.start));
  const weeks = Math.max(1, (now - Math.max(from, first)) / (7 * 86400000));
  const sets = {};
  for (const w of recent) for (const ex of w.exercises) {
    const m = muscleOf(ex.exId);
    sets[m] = (sets[m] || 0) + ex.sets.filter(isWork).length;
  }
  for (const m in sets) sets[m] = Math.round((sets[m] / weeks) * 10) / 10;
  return { weeks, sets, workouts: recent.length };
}

// Routine to do next: one picked by hand wins, else the one after the last
// routine finished, else the first. Missed days never move the rotation.
// A workout that did two routines (Back + Legs) skips past both.
export function nextRoutine(routines, workouts, pickedId) {
  if (!routines.length) return null;
  const picked = pickedId && routines.find((r) => r.id === pickedId);
  if (picked) return picked;
  let last = null;
  for (const w of workouts) {
    if (w.routineId && routines.some((r) => r.id === w.routineId) && (!last || w.start > last.start)) last = w;
  }
  if (!last) return routines[0];
  const did = new Set(last.routineIds || [last.routineId]);
  const i = routines.findIndex((r) => r.id === last.routineId);
  for (let k = 1; k < routines.length; k++) {
    const r = routines[(i + k) % routines.length];
    if (!did.has(r.id)) return r;
  }
  return routines[(i + 1) % routines.length];
}

// Monday = 0 … Sunday = 6.
export const dayIndex = (ts) => (new Date(ts).getDay() + 6) % 7;
export function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Next gym day: today if it is one and nothing is logged yet today.
export function nextGymDay(days, workouts, now = Date.now()) {
  if (!days.some(Boolean)) return null;
  const today = startOfDay(now);
  const doneToday = workouts.some((w) => w.start >= today);
  for (let i = doneToday ? 1 : 0; i < 8; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    if (days[dayIndex(d.getTime())]) return d.getTime();
  }
  return null;
}

// ---------- Hevy import ----------

// RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes.
export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', q = false;
  text = String(text).replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
// Hevy writes "18 Oct 2026, 08:30"; also takes "Oct 18, 2026, 8:30 PM" and ISO.
export function parseHevyDate(s) {
  const t = String(s ?? '').trim();
  let m = t.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  let day, mon, year, h, min, ap;
  if (m) [, day, mon, year, h, min, ap] = m;
  else if ((m = t.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i))) [, mon, day, year, h, min, ap] = m;
  if (m) {
    const mi = MONTHS.indexOf(mon.toLowerCase());
    if (mi < 0) return null;
    let hh = Number(h);
    if (ap) hh = (hh % 12) + (/pm/i.test(ap) ? 12 : 0);
    return new Date(Number(year), mi, Number(day), hh, Number(min)).getTime();
  }
  if (!/^\d{4}-\d{2}-\d{2}/.test(t)) return null;
  const iso = Date.parse(t.replace(' ', 'T'));
  return Number.isFinite(iso) ? iso : null;
}

const SET_TYPE = { warmup: 'w', dropset: 'd', failure: 'f', normal: 'n' };
const numOr = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };

// Hevy's "Export workouts" CSV → workouts with exercises in the order logged.
// Weights come back in kg whichever unit the file used.
export function hevyWorkouts(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name) => head.indexOf(name);
  const c = {
    title: col('title'), start: col('start_time'), end: col('end_time'), desc: col('description'),
    ex: col('exercise_title'), note: col('exercise_notes'), idx: col('set_index'), type: col('set_type'),
    kg: col('weight_kg'), lb: col('weight_lbs'), reps: col('reps'), sec: col('duration_seconds'),
  };
  if (c.ex < 0 || c.start < 0) return [];
  const byKey = new Map();
  for (const r of rows.slice(1)) {
    const start = parseHevyDate(r[c.start]);
    const exTitle = (r[c.ex] || '').trim();
    if (start == null || !exTitle) continue;
    const name = (c.title >= 0 && (r[c.title] || '').trim()) || 'Workout';
    const key = start + '|' + name;
    let wk = byKey.get(key);
    if (!wk) {
      const end = c.end >= 0 ? parseHevyDate(r[c.end]) : null;
      wk = { name, start, end: end && end > start ? end : start + 3600000, note: c.desc >= 0 ? (r[c.desc] || '').trim() : '', exercises: [] };
      byKey.set(key, wk);
    }
    const idx = c.idx >= 0 ? Number(r[c.idx]) : NaN;
    let ex = wk.exercises[wk.exercises.length - 1];
    if (!ex || ex.title !== exTitle || idx === 0) {
      ex = { title: exTitle, note: c.note >= 0 ? (r[c.note] || '').trim() : '', sets: [] };
      wk.exercises.push(ex);
    }
    let w = c.kg >= 0 ? numOr(r[c.kg]) : null;
    if (w == null && c.lb >= 0) { const lb = numOr(r[c.lb]); w = lb == null ? null : lb / 2.20462; }
    const reps = c.reps >= 0 ? numOr(r[c.reps]) : null;
    const t = c.sec >= 0 ? numOr(r[c.sec]) : null;
    ex.sets.push({ type: SET_TYPE[(r[c.type] || '').trim().toLowerCase()] || 'n', w: w || null, r: reps == null ? null : Math.round(reps), t: t || null });
  }
  return [...byKey.values()].sort((a, b) => a.start - b.start);
}

// How an imported exercise is logged, judged by what its sets carry.
export function kindFromSets(sets) {
  if (sets.some((s) => s.w)) return 'wr';
  if (sets.some((s) => s.r)) return 'r';
  return 't';
}

// Names compared without case, punctuation or plural s: "Pull Ups" = "Pull-up".
const nameKey = (s) => String(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map((w) => w.replace(/(?<=..)s$/, '')).join('');
const hasBrackets = (s) => /\(.*\)/.test(s);
const bareKey = (s) => nameKey(String(s).replace(/\(.*?\)/g, ''));

// Lift exercise for a Hevy name: exact match first. Then, when only one side names
// the equipment ("Face Pull" vs "Face Pull (Cable)"), the name without brackets if
// just one exercise fits. Two different brackets never match: a machine fly is not
// a dumbbell fly. Null means make a new one.
export function matchExercise(title, list, { exactOnly = false } = {}) {
  const k = nameKey(title);
  const exact = list.find((e) => nameKey(e.name) === k);
  if (exact || exactOnly) return exact || null;
  const b = bareKey(title);
  const loose = list.filter((e) => bareKey(e.name) === b && !(hasBrackets(e.name) && hasBrackets(title)));
  return loose.length === 1 ? loose[0] : null;
}

// Routines from history: every workout name done at least twice since `since`
// becomes one, built from its latest session. Ordered so the one done longest
// ago comes first: that is the one due next.
export function routinesFromHistory(workouts, since, kindOf) {
  const groups = new Map();
  for (const w of workouts) {
    if (w.start < since) continue;
    const g = groups.get(w.name) || [];
    g.push(w);
    groups.set(w.name, g);
  }
  const out = [];
  for (const [name, list] of groups) {
    if (list.length < 2) continue;
    const latest = list.reduce((a, b) => (b.start > a.start ? b : a));
    const items = [];
    for (const ex of latest.exercises) {
      if (items.some((it) => it.exId === ex.exId)) continue;
      const work = ex.sets.filter(counts);
      const [lo, hi] = kindOf(ex.exId) === 'wr' ? rangeFor(work.map((s) => s.r || 0)) : [null, null];
      items.push({ exId: ex.exId, sets: Math.max(1, Math.min(8, work.length || ex.sets.length)), lo, hi });
    }
    if (items.length) out.push({ name, items, last: latest.start, count: list.length });
  }
  return out.sort((a, b) => a.last - b.last);
}

// Gym days read from history: weekdays trained in at least 4 of the last 8 weeks.
// Someone who trains on different days each week gets none, and taps them in.
export function daysFromHistory(workouts, now = Date.now()) {
  const since = now - 56 * 86400000;
  const weeks = [0, 1, 2, 3, 4, 5, 6].map(() => new Set());
  for (const w of workouts) if (w.start >= since) weeks[dayIndex(w.start)].add(weekStart(w.start));
  return weeks.map((s) => s.size >= 4);
}

// ---------- Heart rate ----------
// Samples are [ms, bpm] from Apple Health (AirPods, via the "Lift heart rate" Shortcut and paul-hub).
// Each sample counts for the time until the next one, at most two minutes, so a gap in the
// readings neither stretches nor drops the numbers.
const HR_GAP = 120000;
// Calories per minute from heart rate (Keytel et al. 2005, the men's formula), kg and age needed.
export function kcalPerMin(bpm, kg, age) {
  return Math.max(0, (-55.0969 + 0.6309 * bpm + 0.1988 * kg + 0.2017 * age) / 4.184);
}

// Lifting: heart rate runs ahead of the energy used (straining, rests with a high pulse), so the
// cardio formula roughly doubles it. Here the heart rate only picks the effort between standing
// around (2 MET, at 40 % of top heart rate or less) and hard lifting (6 MET, at 85 % or more).
export function liftKcalPerMin(bpm, kg, age) {
  const p = bpm / (208 - 0.7 * age);
  const met = 2 + Math.min(1, Math.max(0, (p - 0.4) / 0.45)) * 4;
  return (met * 3.5 * kg) / 200;
}
// When the cardio exercises ran: each ticked timed set, from its tick back over its time.
export function cardioSpans(exercises, isCardio) {
  const out = [];
  for (const ex of exercises) {
    if (!isCardio(ex.exId)) continue;
    for (const s of ex.sets) if (s.at && s.t) out.push([s.at - s.t * 1000, s.at]);
  }
  return out;
}

export const HR_V = 2; // 2: lifting calories, the cardio formula only inside cardio sets
export function hrStats(samples, start, end, { kg = 0, age = 0, cardio = [] } = {}) {
  const pts = samples.filter(([t, b]) => t >= start && t <= end && b > 0).sort((a, b) => a[0] - b[0]);
  if (pts.length < 3) return null;
  let sum = 0, span = 0, kcal = 0, max = 0;
  pts.forEach(([t, b], i) => {
    const dt = Math.min(HR_GAP, (pts[i + 1]?.[0] ?? Math.min(end, t + 5000)) - t);
    sum += b * dt; span += dt; max = Math.max(max, b);
    if (kg && age) kcal += (cardio.some(([a, z]) => t >= a && t <= z) ? kcalPerMin : liftKcalPerMin)(b, kg, age) * (dt / 60000);
  });
  if (!span) return null;
  // The line: one point a minute (at most 80), each the average of its slice of the workout.
  const n = Math.min(80, Math.max(2, Math.round((end - start) / 60000))), size = (end - start) / n;
  const line = [];
  for (let k = 0; k < n; k++) {
    const a = start + k * size, z = a + size;
    const in_ = pts.filter(([t]) => t >= a && t < z);
    if (in_.length) line.push([Math.round((a + size / 2 - start) / 1000), Math.round(in_.reduce((s, p) => s + p[1], 0) / in_.length)]);
  }
  return { v: HR_V, avg: Math.round(sum / span), max, kcal: kg && age ? Math.round(kcal) : null, line };
}

// Average and peak per exercise, from the minute before its first ticked set to its last tick.
export function hrPerExercise(samples, exercises) {
  const out = {};
  for (const ex of exercises) {
    const at = ex.sets.map((s) => s.at).filter(Boolean);
    if (!at.length) continue;
    const pts = samples.filter(([t]) => t >= Math.min(...at) - 60000 && t <= Math.max(...at));
    if (!pts.length) continue;
    out[ex.exId] = { avg: Math.round(pts.reduce((s, p) => s + p[1], 0) / pts.length), max: Math.max(...pts.map((p) => p[1])) };
  }
  return out;
}
