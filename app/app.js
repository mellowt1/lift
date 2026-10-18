import { BUILT_IN, MUSCLES, EQUIPMENT, photoUrl } from './exercises.js';
import {
  uid, toUnit, fromUnit, fmtNum, fmtW, fmtBig, fmtClock, fmtDuration, parseTime, parseNum, e1rm, isWork,
  workoutVolume, workoutSetCount, bests, prsFor, PR_LABEL, previousSets, weeklyCounts, streakWeeks, progression, weekStart,
  RANGES, DEFAULT_RANGE, stepFor, suggest, nextRoutine, nextGymDay, dayIndex, startOfDay,
  hevyWorkouts, kindFromSets, matchExercise, routinesFromHistory, daysFromHistory,
} from './logic.js';

// ---------- storage ----------
// Everything lives in one localStorage record on this device. Export in Profile is the backup.
// The key stays lift.v1 so Lift 1 data carries over; Lift 2 only adds fields.
const KEY = 'lift.v1';
const EMPTY = () => ({
  custom: [], routines: [], workouts: [], active: null, restFor: {}, settings: { unit: 'kg', rest: 90 }, lastBackup: null,
  // Gym days Monday-first, and a routine picked by hand to go next (cleared when one is finished).
  plan: { days: [true, false, true, false, true, false, false], pick: null },
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = { ...EMPTY(), ...JSON.parse(raw) };
      d.plan = { ...EMPTY().plan, ...d.plan };
      return d;
    }
  } catch {}
  return EMPTY();
}
let db = load();
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { toast('Could not save on this device'); }
}
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 300); }
navigator.storage?.persist?.().catch(() => {});

const unit = () => db.settings.unit;

// ---------- exercises ----------
// Lift's own list (Hevy-style names, yours included) comes first everywhere. The 868 of
// free-exercise-db load after start as "db:<id>" and show under "More exercises".
let exdb = new Map();
let exMap = new Map();
const LIB_REFS = new Set(BUILT_IN.map((b) => b.ref).filter(Boolean));
function buildExMap() {
  const more = [...exdb.values()].map((d) => ({ id: 'db:' + d.id, name: d.name, muscle: d.muscle, equip: d.equip, kind: d.kind, ref: d.id, db: true }));
  exMap = new Map([...more, ...BUILT_IN, ...db.custom].map((e) => [e.id, e]));
}
buildExMap();
async function loadExdb() {
  try {
    const rows = await (await fetch('exdb.json')).json();
    exdb = new Map(rows.map((d) => [d.id, d]));
    buildExMap();
    if (!document.activeElement?.matches('input, select, textarea')) rerender();
  } catch {}
}
const getEx = (id) => exMap.get(id) || (String(id).startsWith('db:')
  ? { id, name: id.slice(3).replace(/_/g, ' '), muscle: 'Other', equip: 'Other', kind: 'wr', ref: id.slice(3), db: true }
  : { id, name: 'Unknown exercise', muscle: 'Other', equip: 'Other', kind: 'wr' });
const kindOf = (id) => getEx(id).kind;
const byName = (a, b) => a.name.localeCompare(b.name);
const allExercises = () => [...BUILT_IN, ...db.custom].map((e) => exMap.get(e.id) || e).sort(byName);
const moreExercises = () => [...exMap.values()].filter((e) => e.db && !LIB_REFS.has(e.ref)).sort(byName);
const doneWorkouts = () => [...db.workouts].sort((a, b) => b.start - a.start);

// Rep range of a routine item; Lift 1 routines had none, so weight × reps gets 8–12.
const rangeOf = (it) => (kindOf(it.exId) === 'wr' ? [it.lo ?? DEFAULT_RANGE[0], it.hi ?? DEFAULT_RANGE[1]] : [null, null]);
const rangeText = (lo, hi) => (lo ? `${lo}–${hi}` : '');
// The weight to lift next time for one exercise, from its last session.
function nextFor(exId, lo, hi, done = doneWorkouts()) {
  const e = getEx(exId);
  if (e.kind !== 'wr' || !hi) return null;
  return suggest(previousSets(done, exId), lo, hi, stepFor(e.equip, unit()));
}

function thumb(e, cls = '') {
  return e.ref
    ? `<img class="thumb ${cls}" src="${photoUrl(e.ref)}" alt="" loading="lazy" decoding="async">`
    : `<span class="thumb glyph ${cls}">${icon('dumbbell')}</span>`;
}

// ---------- small helpers ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (id, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}

// Value of one set as a lifter reads it: "60 kg × 8", "12 reps", "1:30".
function setText(s, kind) {
  if (kind === 'r') return s.w ? `+${fmtW(s.w, unit())} ${unit()} × ${s.r ?? 0}` : `${s.r ?? 0} reps`;
  if (kind === 't') return fmtClock(s.t || 0);
  return `${fmtW(s.w || 0, unit())} ${unit()} × ${s.r ?? 0}`;
}
function volText(kg) { return `${fmtBig(toUnit(kg, unit()))} ${unit()}`; }

// ---------- navigation ----------
// Four tabs, each with its own stack of pushed views. Browser back pops the stack.
let tab = 'today';
const roots = { today: { view: 'today' }, routines: { view: 'routines' }, history: { view: 'history' }, profile: { view: 'profile' } };
let stack = [];
const cur = () => stack[stack.length - 1] || roots[tab];

function go(v) {
  cur().y = scrollY;
  stack.push(v);
  history.pushState({ n: stack.length }, '');
  render();
  scrollTo(0, 0);
}
function back() {
  if (stack.length) history.back();
}
addEventListener('popstate', () => {
  if (!stack.length) return;
  stack.pop();
  render();
  scrollTo(0, cur().y || 0);
});
function switchTab(t) {
  if (t === tab && !stack.length) { scrollTo({ top: 0, behavior: 'smooth' }); return; }
  cur().y = scrollY;
  const n = stack.length;
  stack = [];
  tab = t;
  if (n) history.go(-n);
  render();
  scrollTo(0, roots[t].y || 0);
}

// ---------- render ----------
const VIEWS = {};
function render() {
  const v = cur();
  const full = ['active', 'routine', 'summary'].includes(v.view);
  document.body.classList.toggle('full', full);
  $('#tabs').hidden = full;
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
  $('#resume').hidden = !db.active || full;
  $('#view').innerHTML = VIEWS[v.view](v);
  VIEWS[v.view].after?.(v);
  $('#rest').hidden = !(rest.end && v.view === 'active');
  tick();
}
function rerender() {
  const y = scrollY;
  render();
  scrollTo(0, y);
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab]');
  if (t) switchTab(t.dataset.tab);
});
$('#resume').addEventListener('click', () => go({ view: 'active' }));

// ---------- sheets ----------
function openSheet(inner, { tall = false, onClose } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="scrim"></div><div class="sheet${tall ? ' tall' : ''}" role="dialog" aria-modal="true"><div class="grab"></div>${inner}</div>`;
  $('#sheets').append(wrap);
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    wrap.classList.remove('open');
    setTimeout(() => wrap.remove(), 240);
    onClose?.();
  };
  wrap.querySelector('.scrim').addEventListener('click', close);
  return { el: wrap.querySelector('.sheet'), close };
}

function actionSheet(title, items) {
  const s = openSheet(`${title ? `<p class="sheet-title">${esc(title)}</p>` : ''}
    <div class="menu">${items.map((it, i) => `<button data-i="${i}" class="${it.danger ? 'danger' : ''}">${esc(it.label)}</button>`).join('')}</div>
    <button class="btn ghost block" data-cancel>Cancel</button>`);
  s.el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    s.close();
    if (b.dataset.i != null) items[+b.dataset.i].fn();
  });
}

function confirmBox(title, text, ok = 'OK', danger = false) {
  return new Promise((res) => {
    let answer = false;
    const s = openSheet(`<p class="sheet-title">${esc(title)}</p>${text ? `<p class="sheet-text">${esc(text)}</p>` : ''}
      <div class="row2"><button class="btn soft" data-no>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(ok)}</button></div>`,
    { onClose: () => res(answer) });
    s.el.addEventListener('click', (e) => {
      if (e.target.closest('[data-yes]')) { answer = true; s.close(); }
      if (e.target.closest('[data-no]')) s.close();
    });
  });
}

// ---------- exercise picker ----------
function pickRow(e, picked, multi) {
  const n = picked.indexOf(e.id);
  return `<button class="pick-row${n >= 0 ? ' on' : ''}" data-id="${e.id}">
    ${thumb(e)}
    <span class="pick-txt"><b>${esc(e.name)}</b><small>${esc(e.muscle)} · ${esc(e.equip)}</small></span>
    ${multi ? `<span class="pick-mark">${n >= 0 ? n + 1 : ''}</span>` : icon('chev', 'dim')}</button>`;
}

function pickExercises({ multi = true, title = 'Add exercises', onDone }) {
  let q = '', muscle = '', picked = [];
  const s = openSheet(`
    <div class="pick-head">
      <p class="sheet-title">${esc(title)}</p>
      <button class="link" data-new>New</button>
    </div>
    <label class="search">${icon('search')}<input type="search" placeholder="Search ${exMap.size} exercises" data-q autocomplete="off"></label>
    <div class="chips" data-chips>${['', ...MUSCLES].map((m) => `<button data-m="${m}" class="chip${m === '' ? ' on' : ''}">${m || 'All'}</button>`).join('')}</div>
    <div class="pick-list" data-list></div>
    ${multi ? '<button class="btn primary block pick-go" data-go disabled>Add exercises</button>' : ''}`, { tall: true });
  const list = $('[data-list]', s.el);
  const draw = () => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const fits = (e) => (!muscle || e.muscle === muscle) && words.every((w) => e.name.toLowerCase().includes(w) || e.muscle.toLowerCase().includes(w));
    const rows = allExercises().filter(fits);
    // The big database only shows once you search or pick a muscle, so the list stays short.
    const more = words.length || muscle ? moreExercises().filter(fits).slice(0, 120) : [];
    list.innerHTML = rows.map((e) => pickRow(e, picked, multi)).join('')
      + (more.length ? `<p class="pick-sec">More exercises · photos and steps</p>${more.map((e) => pickRow(e, picked, multi)).join('')}` : '')
      + (!rows.length && !more.length ? `<p class="empty">No exercise called “${esc(q)}”. Tap New to make it.</p>` : '')
      + (!words.length && !muscle && exdb.size ? `<p class="pick-hint">Search to see ${exdb.size} more exercises with photos and steps.</p>` : '');
    const go = $('[data-go]', s.el);
    if (go) { go.disabled = !picked.length; go.textContent = picked.length ? `Add ${picked.length} exercise${picked.length > 1 ? 's' : ''}` : 'Add exercises'; }
  };
  draw();
  $('[data-q]', s.el).addEventListener('input', (e) => { q = e.target.value; draw(); });
  s.el.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-m]');
    if (chip) {
      muscle = chip.dataset.m;
      for (const c of s.el.querySelectorAll('[data-m]')) c.classList.toggle('on', c === chip);
      draw();
      return;
    }
    const row = e.target.closest('[data-id]');
    if (row) {
      if (!multi) { s.close(); onDone([row.dataset.id]); return; }
      const i = picked.indexOf(row.dataset.id);
      i >= 0 ? picked.splice(i, 1) : picked.push(row.dataset.id);
      draw();
      return;
    }
    if (e.target.closest('[data-go]')) { s.close(); onDone(picked); return; }
    if (e.target.closest('[data-new]')) {
      editCustom(null, (ex) => {
        if (!multi) { s.close(); onDone([ex.id]); return; }
        picked.push(ex.id);
        q = ''; $('[data-q]', s.el).value = '';
        draw();
      });
    }
  });
}

// Create or rename a custom exercise.
function editCustom(ex, onSaved) {
  const e = ex || { name: '', muscle: 'Chest', equip: 'Barbell', kind: 'wr' };
  const s = openSheet(`
    <p class="sheet-title">${ex ? 'Edit exercise' : 'New exercise'}</p>
    <label class="field"><span>Name</span><input data-name value="${esc(e.name)}" maxlength="60" placeholder="e.g. Incline Row (Machine)"></label>
    <div class="row2">
      <label class="field"><span>Muscle</span><select data-muscle>${MUSCLES.map((m) => `<option${m === e.muscle ? ' selected' : ''}>${m}</option>`).join('')}</select></label>
      <label class="field"><span>Equipment</span><select data-equip>${EQUIPMENT.map((m) => `<option${m === e.equip ? ' selected' : ''}>${m}</option>`).join('')}</select></label>
    </div>
    <div class="field"><span>Log it as</span>
      <div class="seg" data-kind>${[['wr', 'Weight × reps'], ['r', 'Reps'], ['t', 'Time']].map(([k, l]) => `<button data-k="${k}" class="${k === e.kind ? 'on' : ''}"${ex ? ' disabled' : ''}>${l}</button>`).join('')}</div>
    </div>
    <button class="btn primary block" data-save>Save</button>`);
  let kind = e.kind;
  const name = $('[data-name]', s.el);
  if (!ex) setTimeout(() => name.focus(), 260);
  s.el.addEventListener('click', (ev) => {
    const k = ev.target.closest('[data-k]');
    if (k && !k.disabled) { kind = k.dataset.k; for (const b of s.el.querySelectorAll('[data-k]')) b.classList.toggle('on', b === k); }
    if (ev.target.closest('[data-save]')) {
      const n = name.value.trim();
      if (!n) { name.focus(); toast('Give it a name'); return; }
      const clash = allExercises().find((x) => x.name.toLowerCase() === n.toLowerCase() && x.id !== e.id);
      if (clash) { toast('That name is taken'); return; }
      const muscle = $('[data-muscle]', s.el).value, equip = $('[data-equip]', s.el).value;
      let saved;
      if (ex) { Object.assign(ex, { name: n, muscle, equip }); saved = ex; }
      else { saved = { id: 'c-' + uid(), name: n, muscle, equip, kind, custom: true }; db.custom.push(saved); }
      save();
      buildExMap();
      s.close();
      onSaved?.(saved);
    }
  });
}

// ---------- rest timer ----------
const rest = { end: 0, total: 0, doneAt: 0 };
let audio = null;
function unlockAudio() {
  try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); } catch {}
}
function chime() {
  if (!audio) return;
  const t0 = audio.currentTime;
  for (const [i, f] of [[0, 784], [1, 1047]]) {
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t0 + i * 0.18);
    g.gain.linearRampToValueAtTime(0.12, t0 + i * 0.18 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.18 + 0.5);
    o.connect(g).connect(audio.destination);
    o.start(t0 + i * 0.18); o.stop(t0 + i * 0.18 + 0.55);
  }
}
function startRest(sec) {
  if (!sec) return;
  rest.end = Date.now() + sec * 1000;
  rest.total = sec;
  rest.doneAt = 0;
  if (db.active) { db.active.rest = { end: rest.end, total: sec }; saveSoon(); }
  $('#rest').classList.remove('over');
  $('#rest').hidden = cur().view !== 'active';
  tick();
}
function stopRest() {
  rest.end = 0;
  if (db.active) { db.active.rest = null; saveSoon(); }
  $('#rest').hidden = true;
}
$('#rest').addEventListener('click', (e) => {
  const b = e.target.closest('[data-rest]');
  if (!b) return;
  if (b.dataset.rest === 'skip') { stopRest(); return; }
  const d = Number(b.dataset.rest);
  rest.end = Math.max(Date.now() + 1000, rest.end + d * 1000);
  rest.total = Math.max(rest.total + d, 1);
  if (db.active) { db.active.rest = { end: rest.end, total: rest.total }; saveSoon(); }
  tick();
});

// ---------- clock ----------
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch {}
}
document.addEventListener('visibilitychange', () => { if (db.active) keepAwake(true); });

function tick() {
  const a = db.active;
  if (a) {
    const el = fmtClock((Date.now() - a.start) / 1000);
    for (const id of ['a-time', 'resume-time']) { const n = document.getElementById(id); if (n) n.textContent = el; }
  }
  if (rest.end) {
    const left = (rest.end - Date.now()) / 1000;
    if (left <= 0) {
      if (!rest.doneAt) {
        rest.doneAt = Date.now();
        chime();
        navigator.vibrate?.([180, 90, 180]);
        $('#rest').classList.add('over');
        $('#rest-label').textContent = 'Rest done';
        $('#rest-time').textContent = '0:00';
        $('#rest-fill').style.transform = 'scaleX(0)';
      } else if (Date.now() - rest.doneAt > 3000) stopRest();
    } else {
      $('#rest-label').textContent = 'Rest';
      $('#rest-time').textContent = fmtClock(Math.ceil(left));
      $('#rest-fill').style.transform = `scaleX(${Math.min(1, left / rest.total)})`;
    }
  }
}
setInterval(tick, 500);

// ---------- active workout ----------
const newSet = (type = 'n') => ({ type, w: null, r: null, t: null, done: false });

// Last time's set for row j: the nth warm-up pairs with the nth warm-up, work sets with work sets.
function prevMatch(prev, sets, j) {
  const warm = sets[j].type === 'w';
  let n = 0;
  for (let k = 0; k < j; k++) if ((sets[k].type === 'w') === warm) n++;
  return prev.filter((p) => (p.type === 'w') === warm)[n];
}
// Rows for a new exercise block: last time's warm-ups, then `work` work sets (or last time's count).
function setsFrom(prev, work) {
  const warm = prev.filter((p) => p.type === 'w').length;
  const n = work || prev.filter(isWork).length || 3;
  return [...Array.from({ length: warm }, () => newSet('w')), ...Array.from({ length: Math.min(n, 8) }, () => newSet())];
}

// One exercise block of a new workout. A routine item brings its rep range, and with it
// the weight to lift today (sug), worked out once at the start.
function activeEx(it, done) {
  const [lo, hi] = it.lo !== undefined || it.sets ? rangeOf(it) : [null, null];
  return {
    exId: it.exId, note: '', rest: db.restFor[it.exId] ?? db.settings.rest, lo, hi, sug: nextFor(it.exId, lo, hi, done),
    sets: it.types ? it.types.map((t) => newSet(t)) : setsFrom(previousSets(done, it.exId), it.sets),
  };
}

function startWorkout({ name = 'Workout', items = [], routineId = null } = {}) {
  if (db.active) { toast('Finish or discard the current workout first'); go({ view: 'active' }); return; }
  const done = doneWorkouts();
  db.active = { id: uid(), name, start: Date.now(), routineId, exercises: items.map((it) => activeEx(it, done)) };
  save();
  unlockAudio();
  if (tab !== 'today') { stack = []; tab = 'today'; }
  go({ view: 'active' });
}

function addToActive(ids) {
  const done = doneWorkouts();
  for (const exId of ids) {
    db.active.exercises.push({ exId, note: '', rest: db.restFor[exId] ?? db.settings.rest, lo: null, hi: null, sug: null, sets: setsFrom(previousSets(done, exId)) });
  }
  save();
  rerender();
  setTimeout(() => document.querySelector('.ex:last-of-type')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}

function activeStats() {
  const a = db.active;
  let vol = 0, sets = 0;
  for (const ex of a.exercises) for (const s of ex.sets) if (s.done) { sets++; vol += (s.w || 0) * (s.r || 0); }
  return { vol, sets };
}
function paintStats() {
  if (!db.active) return;
  const { vol, sets } = activeStats();
  const v = $('#a-vol'), s = $('#a-sets');
  if (v) v.textContent = volText(vol);
  if (s) s.textContent = sets;
}

// Column headers and the two value fields of one kind of exercise.
const COLS = { wr: ['kg', 'Reps'], r: ['Reps'], t: ['Time'] };

// What an empty field means for set j: the suggested weight on work sets, else last
// time's numbers; reps from last time, else the bottom of the range.
function hintFor(ex, s, p) {
  const sugW = ex.sug && s.type !== 'w' && s.type !== 'd' ? ex.sug.w : null;
  return { w: sugW ?? p?.w ?? null, up: sugW != null && ex.sug.up, r: p?.r ?? (s.type !== 'w' ? ex.lo : null) ?? null, t: p?.t ?? null };
}

// Heaviest work set before this workout, to light a PR as soon as a set beats it.
function recFor(exId, done) {
  return { had: previousSets(done, exId).length > 0, weight: bests(done, exId).weight };
}

function setRow(ex, s, j, prev, kind, rec) {
  let n = 0;
  for (let k = 0; k <= j; k++) if (ex.sets[k].type !== 'w') n++;
  const label = s.type === 'w' ? 'W' : s.type === 'd' ? 'D' : s.type === 'f' ? 'F' : n;
  const p = prevMatch(prev, ex.sets, j);
  const prevTxt = p ? setText(p, kind) : '—';
  const h = hintFor(ex, s, p);
  const pr = s.done && kind === 'wr' && s.type !== 'w' && rec?.had && s.w > rec.weight + 1e-9;
  const u = unit();
  let fields = '';
  if (kind === 'wr') fields = `<input class="in${h.up && !s.done ? ' up' : ''}" data-f="w" inputmode="decimal" enterkeyhint="next" aria-label="Weight in ${u}" placeholder="${h.w != null ? fmtW(h.w, u) : ''}" value="${s.w != null ? fmtW(s.w, u) : ''}">
      <input class="in" data-f="r" inputmode="numeric" enterkeyhint="done" aria-label="Reps" placeholder="${h.r ?? ''}" value="${s.r ?? ''}">`;
  else if (kind === 'r') fields = `<input class="in" data-f="r" inputmode="numeric" enterkeyhint="done" aria-label="Reps" placeholder="${h.r ?? ''}" value="${s.r ?? ''}">`;
  else fields = `<input class="in" data-f="t" inputmode="numeric" enterkeyhint="done" aria-label="Time" placeholder="${h.t ? fmtClock(h.t) : '0:00'}" value="${s.t != null ? fmtClock(s.t) : ''}">`;
  return `<div class="set-row${s.done ? ' done' : ''}" data-si="${j}">
    <button class="set-no t-${s.type}" data-setmenu aria-label="Set ${label} options">${label}</button>
    <button class="prev" data-prev ${p ? '' : 'disabled'}><span>${esc(prevTxt)}</span>${pr ? '<i class="pr">PR</i>' : ''}</button>
    ${fields}
    <button class="tick" data-tick aria-label="${s.done ? 'Mark set not done' : 'Mark set done'}">${icon('check')}</button>
  </div>`;
}

function sugNote(ex) {
  if (!ex.sug) return '';
  const u = unit();
  return ex.sug.up
    ? `<p class="sug up">${icon('up-arrow')}<span>Going up to ${fmtW(ex.sug.w, u)} ${u}. You hit ${ex.hi} on every set last time.</span></p>`
    : `<p class="sug hold">${icon('minus')}<span>Staying at ${fmtW(ex.sug.w, u)} ${u}. Get ${ex.hi} on every set to go up.</span></p>`;
}

function exCard(ex, i, done) {
  const e = getEx(ex.exId);
  const prev = previousSets(done, ex.exId);
  const rec = recFor(ex.exId, done);
  const cols = COLS[e.kind];
  const work = ex.sets.filter((s) => s.type !== 'w').length;
  return `<section class="ex" data-ei="${i}">
    <div class="ex-head">
      <button class="ex-name" data-open="${ex.exId}">${thumb(e, 'round')}<span>${esc(e.name)}</span></button>
      <button class="icon-btn" data-exmenu aria-label="Exercise options">${icon('more')}</button>
    </div>
    <div class="ex-meta">${ex.lo ? `<span>${work} × ${rangeText(ex.lo, ex.hi)}</span>` : ''}<button class="rest-chip" data-restpick>${icon('timer')}Rest ${ex.rest ? fmtClock(ex.rest) : 'off'}</button></div>
    ${sugNote(ex)}
    <input class="ex-note" data-note placeholder="Add a note" value="${esc(ex.note)}" maxlength="200">
    <div class="sets k-${e.kind}">
      <div class="sets-head"><span>Set</span><span>Previous</span>${cols.map((c) => `<span>${c === 'kg' ? unit() : c}</span>`).join('')}<span>${icon('check')}</span></div>
      ${ex.sets.map((s, j) => setRow(ex, s, j, prev, e.kind, rec)).join('')}
    </div>
    <button class="add-set" data-addset>${icon('plus')}Add set</button>
  </section>`;
}

VIEWS.active = () => {
  const a = db.active;
  if (!a) return `<div class="pad"><p class="empty">No workout running.</p><button class="btn soft block" onclick="history.back()">Back</button></div>`;
  const done = doneWorkouts();
  const { vol, sets } = activeStats();
  return `<header class="bar">
      <button class="icon-btn" data-min aria-label="Minimise workout">${icon('down')}</button>
      <span class="bar-mid"><span class="live-dot"></span><b id="a-time">${fmtClock((Date.now() - a.start) / 1000)}</b></span>
      <button class="btn primary sm" data-finish>Finish</button>
    </header>
    <div class="pad">
      <input class="wk-name" data-wkname value="${esc(a.name)}" maxlength="60" aria-label="Workout name">
      <div class="stats3">
        <div><small>Volume</small><b id="a-vol">${volText(vol)}</b></div>
        <div><small>Sets</small><b id="a-sets">${sets}</b></div>
        <div><small>Started</small><b>${timeFmt.format(a.start)}</b></div>
      </div>
      ${a.exercises.length ? a.exercises.map((ex, i) => exCard(ex, i, done)).join('') : `<div class="empty-card"><p><b>Get started</b></p><p>Add an exercise to begin logging sets.</p></div>`}
      <button class="btn primary block" data-addex>${icon('plus')}Add exercise</button>
      <button class="btn danger-ghost block" data-discard>Discard workout</button>
    </div>`;
};
VIEWS.active.after = () => { if (db.active) keepAwake(true); };

function exAt(el) {
  const card = el.closest('[data-ei]');
  return card ? { i: +card.dataset.ei, ex: db.active.exercises[+card.dataset.ei] } : {};
}

// Typing never re-renders, so the keyboard stays up.
$('#view').addEventListener('input', (e) => {
  const a = db.active;
  if (!a || cur().view !== 'active') return;
  const t = e.target;
  if (t.matches('[data-wkname]')) { a.name = t.value; saveSoon(); return; }
  const { ex } = exAt(t);
  if (!ex) return;
  if (t.matches('[data-note]')) { ex.note = t.value; saveSoon(); return; }
  const f = t.dataset.f;
  if (!f) return;
  const s = ex.sets[+t.closest('[data-si]').dataset.si];
  if (f === 't') s.t = parseTimeEntry(t.value);
  else {
    const n = parseNum(t.value);
    s[f] = n == null ? null : f === 'w' ? fromUnit(n, unit()) : Math.round(n);
  }
  saveSoon();
  if (s.done) paintStats();
});
// Time typed like a microwave: "130" is 1:30, "45" is 45 seconds.
function parseTimeEntry(v) {
  const t = String(v).trim();
  if (!t) return null;
  if (t.includes(':')) return parseTime(t);
  if (!/^\d+$/.test(t)) return null;
  if (t.length <= 2) return Number(t);
  return Number(t.slice(0, -2)) * 60 + Number(t.slice(-2));
}
$('#view').addEventListener('focusout', (e) => {
  const t = e.target;
  if (t.dataset?.f === 't' && db.active) {
    const { ex } = exAt(t);
    const s = ex?.sets[+t.closest('[data-si]').dataset.si];
    if (s) t.value = s.t != null ? fmtClock(s.t) : '';
  }
});
$('#view').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('.in, [data-wkname], [data-note]')) e.target.blur();
});

$('#view').addEventListener('click', (e) => {
  if (cur().view !== 'active' || !db.active) return;
  const a = db.active;
  const t = e.target;
  if (t.closest('[data-min]')) { back(); return; }
  if (t.closest('[data-finish]')) { finishWorkout(); return; }
  if (t.closest('[data-addex]')) { pickExercises({ onDone: addToActive }); return; }
  if (t.closest('[data-discard]')) {
    confirmBox('Discard workout?', 'Nothing from this session will be saved.', 'Discard', true).then((ok) => {
      if (!ok) return;
      db.active = null; save(); stopRest(); keepAwake(false);
      stack = []; history.go(-(history.state?.n || 1)); render();
    });
    return;
  }
  const open = t.closest('[data-open]');
  if (open) { go({ view: 'exercise', id: open.dataset.open }); return; }
  const { i, ex } = exAt(t);
  if (!ex) return;
  const row = t.closest('[data-si]');
  const j = row ? +row.dataset.si : -1;

  if (t.closest('[data-tick]')) { toggleSet(ex, j, row); return; }
  if (t.closest('[data-prev]')) {
    const p = prevMatch(previousSets(doneWorkouts(), ex.exId), ex.sets, j);
    if (!p) return;
    Object.assign(ex.sets[j], { w: p.w ?? null, r: p.r ?? null, t: p.t ?? null });
    save(); rerender(); return;
  }
  if (t.closest('[data-addset]')) {
    const last = ex.sets[ex.sets.length - 1];
    const s = newSet(last && last.type !== 'w' ? last.type : 'n');
    if (last && (last.w != null || last.r != null || last.t != null)) Object.assign(s, { w: last.w, r: last.r, t: last.t });
    ex.sets.push(s);
    save(); rerender(); return;
  }
  if (t.closest('[data-setmenu]')) {
    const s = ex.sets[j];
    const setType = (type) => () => { s.type = type; save(); rerender(); };
    actionSheet(`Set ${j + 1}`, [
      { label: 'Normal set', fn: setType('n') },
      { label: 'Warm-up set', fn: setType('w') },
      { label: 'Drop set', fn: setType('d') },
      { label: 'Failure set', fn: setType('f') },
      { label: 'Remove set', danger: true, fn: () => { ex.sets.splice(j, 1); if (!ex.sets.length) ex.sets.push(newSet()); save(); rerender(); } },
    ]);
    return;
  }
  if (t.closest('[data-restpick]')) {
    const opts = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];
    actionSheet(`Rest after each ${getEx(ex.exId).name} set`, opts.map((sec) => ({
      label: (sec ? fmtClock(sec) : 'Off') + (sec === ex.rest ? '  ✓' : ''),
      fn: () => { ex.rest = sec; db.restFor[ex.exId] = sec; save(); rerender(); },
    })));
    return;
  }
  if (t.closest('[data-exmenu]')) {
    const list = a.exercises;
    const items = [];
    if (i > 0) items.push({ label: 'Move up', fn: () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; save(); rerender(); } });
    if (i < list.length - 1) items.push({ label: 'Move down', fn: () => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; save(); rerender(); } });
    items.push({ label: 'Replace exercise', fn: () => pickExercises({ multi: false, title: 'Replace with', onDone: ([id]) => { ex.exId = id; ex.rest = db.restFor[id] ?? ex.rest; save(); rerender(); } }) });
    items.push({ label: 'Remove exercise', danger: true, fn: () => { list.splice(i, 1); save(); rerender(); } });
    actionSheet(getEx(ex.exId).name, items);
  }
});

function toggleSet(ex, j, row) {
  unlockAudio();
  const s = ex.sets[j];
  const kind = kindOf(ex.exId);
  if (!s.done) {
    // An empty field takes the grey hint: today's weight, last time's reps.
    const h = hintFor(ex, s, prevMatch(previousSets(doneWorkouts(), ex.exId), ex.sets, j));
    if (kind === 'wr') { s.w ??= h.w; s.r ??= h.r; }
    if (kind === 'r') s.r ??= h.r;
    if (kind === 't') s.t ??= h.t;
    const ok = kind === 'wr' ? s.r != null && s.w != null : kind === 'r' ? s.r != null : s.t != null;
    if (!ok) {
      row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake');
      toast(kind === 't' ? 'Enter a time first' : kind === 'r' ? 'Enter reps first' : 'Enter weight and reps first');
      return;
    }
    s.done = true;
    navigator.vibrate?.(12);
    if (ex.rest) startRest(ex.rest);
  } else s.done = false;
  save();
  const card = row.closest('.ex');
  const done = doneWorkouts();
  row.outerHTML = setRow(ex, s, j, previousSets(done, ex.exId), kind, recFor(ex.exId, done));
  const fresh = card.querySelector(`[data-si="${j}"]`);
  if (s.done) fresh.classList.add('pop');
  paintStats();
}

async function finishWorkout() {
  const a = db.active;
  const doneSets = a.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0);
  if (!doneSets) {
    const ok = await confirmBox('No sets ticked', 'Tick the sets you did to save them. Discard this workout instead?', 'Discard', true);
    if (ok) { db.active = null; save(); stopRest(); keepAwake(false); stack = []; history.go(-(history.state?.n || 1)); render(); }
    return;
  }
  const open = a.exercises.reduce((n, ex) => n + ex.sets.filter((s) => !s.done && (s.w != null || s.r != null || s.t != null)).length, 0);
  const ok = await confirmBox('Finish workout?', open ? `${open} set${open > 1 ? 's' : ''} with numbers ${open > 1 ? 'are' : 'is'} not ticked and won't be saved.` : '', 'Finish');
  if (!ok) return;
  const wk = {
    id: a.id, name: a.name.trim() || 'Workout', start: a.start, end: Date.now(), routineId: a.routineId,
    exercises: a.exercises
      .map((ex) => ({ exId: ex.exId, note: ex.note.trim(), sets: ex.sets.filter((s) => s.done).map(({ type, w, r, t }) => ({ type, w, r, t })) }))
      .filter((ex) => ex.sets.length),
  };
  // What was planned for next time is kept with the workout, so the summary can show it.
  const ranges = Object.fromEntries(a.exercises.filter((ex) => ex.lo).map((ex) => [ex.exId, [ex.lo, ex.hi]]));
  if (Object.keys(ranges).length) wk.ranges = ranges;
  db.workouts.push(wk);
  if (wk.routineId) db.plan.pick = null;
  db.active = null;
  save();
  stopRest();
  keepAwake(false);
  const n = stack.length;
  stack = [{ view: 'summary', id: wk.id }];
  tab = 'today';
  if (n > 1) history.go(-(n - 1));
  render();
  scrollTo(0, 0);
}

// ---------- today ----------
// The routine due next, its weights for today, the rotation and the gym days.
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const longDayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
const next = () => nextRoutine(db.routines, db.workouts, db.plan.pick);

function whenText(ts) {
  if (ts == null) return '';
  const today = startOfDay(Date.now());
  if (ts === today) return 'today';
  if (ts === startOfDay(today + 36 * 3600000)) return 'tomorrow';
  return longDayFmt.format(ts);
}

function itemLine(it, done) {
  const e = getEx(it.exId);
  const [lo, hi] = rangeOf(it);
  const sug = nextFor(it.exId, lo, hi, done);
  const right = sug
    ? `${sug.up ? icon('up-arrow', 'upc') : ''}<b>${fmtW(sug.w, unit())}</b><small>${unit()}</small>`
    : `<small>${lo ? 'new' : ''}</small>`;
  return `<button class="t-row" data-open="${it.exId}">
    ${thumb(e)}
    <span class="t-txt"><b>${esc(e.name)}</b><small>${it.sets} × ${lo ? rangeText(lo, hi) : 'sets'}</small></span>
    <span class="t-wt">${right}</span>
  </button>`;
}

function emptyToday() {
  return `<div class="empty-card big">
      <p><b>Set up your rotation</b></p>
      <p>Build the routines you do, in the order you do them. Lift picks the next one each gym day.</p>
      <button class="btn primary block" data-newroutine>${icon('plus')}Build a routine</button>
      <button class="btn soft block" data-hevy>Import from Hevy</button>
      <input type="file" accept=".csv,text/csv" data-hevyfile hidden>
    </div>
    <button class="btn ghost block" data-empty>Start an empty workout</button>`;
}

VIEWS.today = () => {
  const a = db.active;
  const list = db.routines;
  const now = Date.now();
  const head = `<header class="head"><span class="brand">Lift</span><small class="head-date">${longDayFmt.format(now)}</small></header>`;
  const resume = a ? `<button class="card now" data-resume><span class="live-dot"></span><span><b>${esc(a.name)}</b><small>In progress · ${a.exercises.length} exercise${a.exercises.length === 1 ? '' : 's'}</small></span><span class="link">Resume</span></button>` : '';
  if (!list.length) return `${head}<div class="pad">${resume}${emptyToday()}</div>`;
  const r = next();
  const i = list.indexOf(r);
  const done = doneWorkouts();
  const when = whenText(nextGymDay(db.plan.days, db.workouts, now));
  const ups = r.items.filter((it) => { const [lo, hi] = rangeOf(it); return nextFor(it.exId, lo, hi, done)?.up; }).length;
  const last = done.find((w) => w.routineId && list.some((x) => x.id === w.routineId));
  const gymDays = db.plan.days.filter(Boolean).length;
  const thisWeek = db.workouts.filter((w) => weekStart(w.start) === weekStart(now)).length;
  const sub = [`${r.items.length} exercise${r.items.length === 1 ? '' : 's'}`, when, ups ? `<span class="accent">${ups} going up</span>` : ''].filter(Boolean).join(' · ');
  return `${head}<div class="pad">
    ${resume}
    <section class="next">
      <div class="next-top"><span class="label">Next up · ${i + 1} of ${list.length}</span><button class="link" data-editnext>Edit</button></div>
      <h1 class="next-name">${esc(r.name)}</h1>
      <p class="next-sub">${sub}</p>
    </section>
    <div class="card t-list">${r.items.map((it) => itemLine(it, done)).join('') || '<p class="empty">No exercises in this routine yet.</p>'}</div>
    ${a ? '' : `<button class="btn primary block big" data-startnext>${icon('play')}Start ${esc(r.name)}</button>`}
    <div class="row2 quiet"><button class="btn ghost" data-pick>Do another routine</button><button class="btn ghost" data-empty>Empty workout</button></div>

    <div class="sec-head"><h2>Rotation</h2><small>${gymDays ? `${thisWeek} of ${gymDays} this week` : `${thisWeek} this week`}</small></div>
    <div class="chain">${list.map((x) => `<span class="link-chip${x === r ? ' next' : ''}${last && x.id === last.routineId ? ' last' : ''}">${last && x.id === last.routineId ? icon('check') : ''}${esc(x.name)}</span>`).join(icon('chev', 'sep'))}</div>
    <div class="days" role="group" aria-label="Gym days">${db.plan.days.map((on, d) => `<button class="day${on ? ' on' : ''}${d === dayIndex(now) ? ' today' : ''}" data-day="${d}" aria-pressed="${on}" aria-label="${DAY_NAMES[d]}">${DAY_LETTERS[d]}</button>`).join('')}</div>
    <p class="hint">Tap your gym days. Miss one and the next gym day picks up ${esc(r.name)}.</p>
  </div>`;
};

$('#view').addEventListener('click', (e) => {
  if (cur().view !== 'today') return;
  const t = e.target;
  if (t.closest('[data-resume]')) { go({ view: 'active' }); return; }
  if (t.closest('[data-empty]')) { startWorkout(); return; }
  if (t.closest('[data-newroutine]')) { go({ view: 'routine', draft: { id: null, name: '', items: [] } }); return; }
  if (t.closest('[data-hevy]')) { $('[data-hevyfile]').click(); return; }
  const open = t.closest('[data-open]');
  if (open) { go({ view: 'exercise', id: open.dataset.open }); return; }
  const r = next();
  if (t.closest('[data-startnext]')) { startWorkout({ name: r.name, items: r.items, routineId: r.id }); return; }
  if (t.closest('[data-editnext]')) { go({ view: 'routine', draft: structuredClone(r) }); return; }
  if (t.closest('[data-pick]')) {
    actionSheet('Make this one next', db.routines.map((x) => ({
      label: x.name + (x === r ? '  ✓' : ''),
      fn: () => { db.plan.pick = x.id; save(); rerender(); },
    })));
    return;
  }
  const day = t.closest('[data-day]');
  if (day) {
    const d = +day.dataset.day;
    db.plan.days[d] = !db.plan.days[d];
    save(); rerender();
  }
});

// ---------- routines ----------
// The list order is the rotation order.
VIEWS.routines = () => {
  const list = db.routines;
  const r = next();
  return `<header class="head"><h1>Routines</h1><button class="link" data-newroutine>${icon('plus')}New</button></header>
  <div class="pad">
    ${list.length ? `<p class="hint top">This is your rotation. Lift goes through it in this order.</p>
    ${list.map((x, i) => `<div class="card routine" data-rid="${x.id}">
        <div class="routine-top"><span class="r-no">${i + 1}</span><b>${esc(x.name)}</b>${x === r ? '<span class="badge">Next</span>' : ''}<button class="icon-btn" data-rmenu aria-label="${esc(x.name)} options">${icon('more')}</button></div>
        <div class="r-thumbs">${x.items.slice(0, 6).map((it) => thumb(getEx(it.exId))).join('')}</div>
        <p class="routine-ex">${esc(x.items.map((it) => getEx(it.exId).name).join(', ')) || 'No exercises yet'}</p>
        <button class="btn soft block" data-rstart>Start ${esc(x.name)}</button>
      </div>`).join('')}` : emptyToday()}
  </div>`;
};

$('#view').addEventListener('click', (e) => {
  if (cur().view !== 'routines') return;
  const t = e.target;
  if (t.closest('[data-newroutine]')) { go({ view: 'routine', draft: { id: null, name: '', items: [] } }); return; }
  if (t.closest('[data-empty]')) { startWorkout(); return; }
  if (t.closest('[data-hevy]')) { $('[data-hevyfile]').click(); return; }
  const card = t.closest('[data-rid]');
  if (!card) return;
  const list = db.routines;
  const i = list.findIndex((x) => x.id === card.dataset.rid);
  const r = list[i];
  if (t.closest('[data-rstart]')) { startWorkout({ name: r.name, items: r.items, routineId: r.id }); return; }
  if (t.closest('[data-rmenu]')) {
    const items = [{ label: 'Edit routine', fn: () => go({ view: 'routine', draft: structuredClone(r) }) }];
    if (r !== next()) items.push({ label: 'Make it next', fn: () => { db.plan.pick = r.id; save(); rerender(); } });
    if (i > 0) items.push({ label: 'Move up', fn: () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; save(); rerender(); } });
    if (i < list.length - 1) items.push({ label: 'Move down', fn: () => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; save(); rerender(); } });
    items.push({ label: 'Duplicate', fn: () => { list.splice(i + 1, 0, { ...structuredClone(r), id: uid(), name: r.name + ' copy' }); save(); rerender(); } });
    items.push({ label: 'Delete routine', danger: true, fn: () => confirmBox(`Delete ${r.name}?`, 'Past workouts stay in History.', 'Delete', true).then((ok) => { if (ok) { db.routines = list.filter((x) => x !== r); if (db.plan.pick === r.id) db.plan.pick = null; save(); rerender(); } }) });
    actionSheet(r.name, items);
  }
});

// ---------- routine editor ----------
VIEWS.routine = (v) => {
  const d = v.draft;
  return `<header class="bar">
      <button class="link" data-cancel>Cancel</button>
      <span class="bar-mid"><b>${d.id ? 'Edit routine' : 'New routine'}</b></span>
      <button class="btn primary sm" data-save>Save</button>
    </header>
    <div class="pad">
      <input class="wk-name" data-rname value="${esc(d.name)}" placeholder="Routine name" maxlength="60" aria-label="Routine name">
      ${d.items.map((it, i) => {
        const e = getEx(it.exId);
        const [lo, hi] = rangeOf(it);
        return `<div class="r-item" data-ri="${i}">
        <div class="r-top">
          ${thumb(e)}
          <span class="r-name"><b>${esc(e.name)}</b><small>${esc(e.muscle)}</small></span>
          <span class="r-tools">
            <button class="icon-btn sm" data-up ${i ? '' : 'disabled'} aria-label="Move ${esc(e.name)} up">${icon('down', 'up')}</button>
            <button class="icon-btn sm" data-del aria-label="Remove ${esc(e.name)}">${icon('x')}</button>
          </span>
        </div>
        <div class="r-ctl">
          <span class="stepper"><button data-step="-1" aria-label="Fewer sets">−</button><b>${it.sets}</b><small>sets</small><button data-step="1" aria-label="More sets">+</button></span>
          ${lo ? `<label class="range"><span class="vh">Rep range</span><select data-range aria-label="Rep range">${RANGES.map(([a, b]) => `<option value="${a}-${b}"${a === lo && b === hi ? ' selected' : ''}>${a}–${b} reps</option>`).join('')}${RANGES.some(([a, b]) => a === lo && b === hi) ? '' : `<option value="${lo}-${hi}" selected>${lo}–${hi} reps</option>`}</select></label>` : ''}
        </div>
      </div>`;
      }).join('')}
      ${d.items.length ? '<p class="hint">Hit the top of the range on every set and Lift adds weight next time. Miss it and the weight stays.</p>' : ''}
      <button class="btn soft block" data-radd>${icon('plus')}Add exercise</button>
    </div>`;
};

$('#view').addEventListener('input', (e) => {
  if (cur().view === 'routine' && e.target.matches('[data-rname]')) cur().draft.name = e.target.value;
});
$('#view').addEventListener('change', (e) => {
  if (cur().view !== 'routine' || !e.target.matches('[data-range]')) return;
  const it = cur().draft.items[+e.target.closest('[data-ri]').dataset.ri];
  [it.lo, it.hi] = e.target.value.split('-').map(Number);
});
$('#view').addEventListener('click', (e) => {
  if (cur().view !== 'routine') return;
  const d = cur().draft;
  const t = e.target;
  if (t.closest('[data-cancel]')) { back(); return; }
  if (t.closest('[data-save]')) {
    d.name = d.name.trim();
    if (!d.name) { $('[data-rname]').focus(); toast('Name the routine'); return; }
    if (!d.items.length) { toast('Add at least one exercise'); return; }
    if (d.id) db.routines[db.routines.findIndex((r) => r.id === d.id)] = d;
    else db.routines.push({ ...d, id: uid() });
    save();
    warmPhotos();
    back();
    return;
  }
  if (t.closest('[data-radd]')) {
    pickExercises({ onDone: (ids) => {
      d.items.push(...ids.map((exId) => (kindOf(exId) === 'wr' ? { exId, sets: 3, lo: DEFAULT_RANGE[0], hi: DEFAULT_RANGE[1] } : { exId, sets: 3 })));
      rerender();
    } });
    return;
  }
  const item = t.closest('[data-ri]');
  if (!item) return;
  const i = +item.dataset.ri;
  const step = t.closest('[data-step]');
  if (step) { d.items[i].sets = Math.min(12, Math.max(1, d.items[i].sets + Number(step.dataset.step))); rerender(); }
  if (t.closest('[data-up]') && i > 0) { [d.items[i - 1], d.items[i]] = [d.items[i], d.items[i - 1]]; rerender(); }
  if (t.closest('[data-del]')) { d.items.splice(i, 1); rerender(); }
});

// ---------- summary ----------
VIEWS.summary = (v) => {
  const wk = db.workouts.find((w) => w.id === v.id);
  if (!wk) return '';
  const prs = prsFor(db.workouts, wk, kindOf);
  const fromRoutine = wk.routineId && db.routines.some((r) => r.id === wk.routineId);
  const count = db.workouts.length;
  return `<div class="pad summary">
    <div class="done-mark">${icon('check')}</div>
    <h1>Workout done</h1>
    <p class="sub">${esc(wk.name)} · your ${ordinal(count)} workout</p>
    <div class="stats3">
      <div><small>Duration</small><b>${fmtDuration(wk.end - wk.start)}</b></div>
      <div><small>Volume</small><b>${volText(workoutVolume(wk))}</b></div>
      <div><small>Sets</small><b>${workoutSetCount(wk)}</b></div>
    </div>
    ${prs.length ? `<div class="card prs"><p class="prs-title">${icon('trophy')}${prs.length} personal record${prs.length > 1 ? 's' : ''}</p>
      ${prs.map((p) => `<div class="pr-row"><span>${esc(getEx(p.exId).name)}<small>${PR_LABEL[p.key]}</small></span><b>${prValue(p.key, p.value)}</b></div>`).join('')}</div>` : ''}
    ${nextTime(wk)}
    ${fromRoutine ? nextUpCard() : '<button class="btn soft block" data-asroutine>Save as routine</button>'}
    <button class="btn primary block big" data-done>Done</button>
  </div>`;
};

// For each exercise with a rep range: the weight next time, or what to aim for to earn it.
function nextTime(wk) {
  if (!wk.ranges) return '';
  const u = unit();
  const rows = wk.exercises.filter((ex) => wk.ranges[ex.exId]).map((ex) => {
    const [lo, hi] = wk.ranges[ex.exId];
    const e = getEx(ex.exId);
    const s = suggest(ex.sets, lo, hi, stepFor(e.equip, u));
    if (!s) return '';
    const right = s.up
      ? `<b class="accent">${fmtW(s.last, u)} → ${fmtW(s.w, u)} ${u}</b>`
      : `<span>${fmtW(s.w, u)} ${u} · aim for ${hi}s</span>`;
    return `<div class="nt-row"><span>${esc(e.name)}</span>${right}</div>`;
  }).join('');
  return rows ? `<div class="card nt"><p class="nt-title">Next time</p>${rows}</div>` : '';
}

function nextUpCard() {
  const r = next();
  if (!r) return '';
  const when = whenText(nextGymDay(db.plan.days, db.workouts));
  return `<div class="card upnext"><span><small>Next up</small><b>${esc(r.name)}</b></span>${when ? `<span class="upnext-when">${when.charAt(0).toUpperCase() + when.slice(1)}</span>` : ''}</div>`;
}
const setLabel = (s, next) => (s.type === 'w' ? 'W' : s.type === 'd' ? 'D' : s.type === 'f' ? 'F' : next());
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function prValue(key, v) {
  if (key === 'reps') return `${v} reps`;
  if (key === 'time') return fmtClock(v);
  return `${fmtW(v, unit())} ${unit()}`;
}
function saveAsRoutine(wk) {
  db.routines.push({ id: uid(), name: wk.name, items: wk.exercises.map((ex) => ({ exId: ex.exId, sets: ex.sets.filter(isWork).length || ex.sets.length })) });
  save();
  toast(`Saved “${wk.name}” to Routines`);
}
$('#view').addEventListener('click', (e) => {
  const v = cur();
  if (v.view !== 'summary') return;
  if (e.target.closest('[data-done]')) back();
  if (e.target.closest('[data-asroutine]')) { saveAsRoutine(db.workouts.find((w) => w.id === v.id)); e.target.closest('button').remove(); }
});

// ---------- history ----------
function workoutCard(wk) {
  const prs = prsFor(db.workouts, wk, kindOf).length;
  const lines = wk.exercises.slice(0, 4).map((ex) => `<li><span>${ex.sets.length} ×</span> ${esc(getEx(ex.exId).name)}</li>`).join('');
  const more = wk.exercises.length > 4 ? `<li class="more">and ${wk.exercises.length - 4} more</li>` : '';
  return `<button class="card wk" data-wid="${wk.id}">
    <span class="wk-top"><b>${esc(wk.name)}</b><small>${dayFmt.format(wk.start)} · ${timeFmt.format(wk.start)}</small></span>
    <span class="wk-stats"><span>${icon('clock')}${fmtDuration(wk.end - wk.start)}</span><span>${volText(workoutVolume(wk))}</span>${prs ? `<span class="gold">${icon('trophy')}${prs} PR${prs > 1 ? 's' : ''}</span>` : ''}</span>
    <ul class="wk-ex">${lines}${more}</ul>
  </button>`;
}

VIEWS.history = () => {
  const list = doneWorkouts();
  if (!list.length) return `<header class="head"><h1>History</h1></header><div class="pad"><div class="empty-card"><p><b>Nothing logged yet</b></p><p>Finished workouts show up here.</p></div></div>`;
  let html = '', month = '';
  for (const wk of list) {
    const m = monthFmt.format(wk.start);
    if (m !== month) { month = m; html += `<h2 class="month">${m}</h2>`; }
    html += workoutCard(wk);
  }
  return `<header class="head"><h1>History</h1></header><div class="pad">${html}</div>`;
};
$('#view').addEventListener('click', (e) => {
  if (cur().view !== 'history') return;
  const c = e.target.closest('[data-wid]');
  if (c) go({ view: 'workoutDetail', id: c.dataset.wid });
});

VIEWS.workoutDetail = (v) => {
  const wk = db.workouts.find((w) => w.id === v.id);
  if (!wk) return `<header class="bar"><button class="icon-btn" data-back aria-label="Back">${icon('back')}</button></header><div class="pad"><p class="empty">This workout was deleted.</p></div>`;
  const prs = prsFor(db.workouts, wk, kindOf);
  return `<header class="bar">
      <button class="icon-btn" data-back aria-label="Back">${icon('back')}</button>
      <span class="bar-mid"></span>
      <button class="icon-btn" data-wmenu aria-label="Workout options">${icon('more')}</button>
    </header>
    <div class="pad">
      <h1 class="title">${esc(wk.name)}</h1>
      <p class="sub">${dayFmt.format(wk.start)} · ${timeFmt.format(wk.start)}–${timeFmt.format(wk.end)}</p>
      <div class="stats3">
        <div><small>Duration</small><b>${fmtDuration(wk.end - wk.start)}</b></div>
        <div><small>Volume</small><b>${volText(workoutVolume(wk))}</b></div>
        <div><small>Records</small><b>${prs.length}</b></div>
      </div>
      ${wk.exercises.map((ex) => {
        const e = getEx(ex.exId);
        const mine = prs.filter((p) => p.exId === ex.exId);
        let n = 0;
        return `<section class="card d-ex">
          <button class="ex-name" data-open="${ex.exId}">${esc(e.name)}</button>
          ${ex.note ? `<p class="d-note">${esc(ex.note)}</p>` : ''}
          ${ex.sets.map((s) => {
            const label = s.type === 'w' ? 'W' : s.type === 'd' ? 'D' : s.type === 'f' ? 'F' : ++n;
            return `<div class="d-set"><span class="set-no t-${s.type}">${label}</span><span>${setText(s, e.kind)}</span>${e.kind === 'wr' && isWork(s) ? `<small>${fmtW(e1rm(s.w, s.r), unit())} 1RM</small>` : ''}</div>`;
          }).join('')}
          ${mine.length ? `<p class="d-pr">${icon('trophy')}${mine.map((p) => PR_LABEL[p.key]).join(' · ')}</p>` : ''}
        </section>`;
      }).join('')}
    </div>`;
};
$('#view').addEventListener('click', (e) => {
  const v = cur();
  if (e.target.closest('[data-back]')) { back(); return; }
  if (v.view !== 'workoutDetail') return;
  const open = e.target.closest('[data-open]');
  if (open) { go({ view: 'exercise', id: open.dataset.open }); return; }
  if (e.target.closest('[data-wmenu]')) {
    const wk = db.workouts.find((w) => w.id === v.id);
    actionSheet(wk.name, [
      { label: 'Repeat this workout', fn: () => startWorkout({ name: wk.name, items: wk.exercises.map((ex) => ({ exId: ex.exId, types: ex.sets.map((x) => x.type) })), routineId: wk.routineId }) },
      { label: 'Save as routine', fn: () => saveAsRoutine(wk) },
      { label: 'Delete workout', danger: true, fn: () => confirmBox('Delete this workout?', 'This can’t be undone.', 'Delete', true).then((ok) => { if (ok) { db.workouts = db.workouts.filter((w) => w !== wk); save(); back(); } }) },
    ]);
  }
});

// ---------- exercises ----------
let exQuery = '', exMuscle = '';
function exList() {
  const words = exQuery.toLowerCase().split(/\s+/).filter(Boolean);
  const counts = {};
  for (const wk of db.workouts) for (const ex of wk.exercises) counts[ex.exId] = (counts[ex.exId] || 0) + 1;
  const fits = (e) => (!exMuscle || e.muscle === exMuscle) && words.every((w) => e.name.toLowerCase().includes(w) || e.muscle.toLowerCase().includes(w));
  const rows = allExercises().filter(fits);
  const more = words.length || exMuscle ? moreExercises().filter(fits).slice(0, 120) : [];
  if (!rows.length && !more.length) return `<p class="empty">No match. Tap New to add “${esc(exQuery)}”.</p>`;
  const line = (e) => `<button class="row" data-open="${e.id}">
    ${thumb(e)}
    <span><b>${esc(e.name)}</b><small>${esc(e.muscle)} · ${esc(e.equip)}${e.custom ? ' · yours' : ''}</small></span>
    ${counts[e.id] ? `<em>${counts[e.id]}×</em>` : ''}${icon('chev', 'dim')}</button>`;
  return rows.map(line).join('') + (more.length ? `<p class="pick-sec">More exercises · photos and steps</p>${more.map(line).join('')}` : '');
}
VIEWS.exercises = () => `<header class="bar"><button class="icon-btn" data-back aria-label="Back">${icon('back')}</button><span class="bar-mid"><b>Exercises</b></span><button class="link" data-newex>${icon('plus')}New</button></header>
  <div class="pad">
    <label class="search top">${icon('search')}<input type="search" data-exq placeholder="Search ${exMap.size} exercises" value="${esc(exQuery)}" autocomplete="off"></label>
    <div class="chips">${['', ...MUSCLES].map((m) => `<button data-exm="${m}" class="chip${m === exMuscle ? ' on' : ''}">${m || 'All'}</button>`).join('')}</div>
    <div class="list card" data-exlist>${exList()}</div>
  </div>`;
$('#view').addEventListener('input', (e) => {
  if (cur().view === 'exercises' && e.target.matches('[data-exq]')) { exQuery = e.target.value; $('[data-exlist]').innerHTML = exList(); }
});
$('#view').addEventListener('click', (e) => {
  if (cur().view !== 'exercises') return;
  const t = e.target;
  const m = t.closest('[data-exm]');
  if (m) { exMuscle = m.dataset.exm; for (const c of document.querySelectorAll('[data-exm]')) c.classList.toggle('on', c === m); $('[data-exlist]').innerHTML = exList(); return; }
  const open = t.closest('[data-open]');
  if (open) { go({ view: 'exercise', id: open.dataset.open }); return; }
  if (t.closest('[data-newex]')) editCustom(null, (ex) => { rerender(); go({ view: 'exercise', id: ex.id }); });
});

VIEWS.exercise = (v) => {
  const e = getEx(v.id);
  const sessions = doneWorkouts().filter((wk) => wk.exercises.some((x) => x.exId === e.id));
  const b = bests(db.workouts, e.id);
  const u = unit();
  const recs = e.kind === 'wr'
    ? [['Heaviest weight', b.weight ? `${fmtW(b.weight, u)} ${u}` : '—'], ['Best est. 1RM', b.e1rm ? `${fmtW(b.e1rm, u)} ${u}` : '—'], ['Best set volume', b.volume ? `${fmtW(b.volume, u)} ${u}` : '—'], ['Sessions', sessions.length]]
    : e.kind === 'r' ? [['Most reps', b.reps || '—'], ['Sessions', sessions.length]]
      : [['Longest', b.time ? fmtClock(b.time) : '—'], ['Sessions', sessions.length]];
  const chartTitle = e.kind === 'wr' ? `Best est. 1RM per session (${u})` : e.kind === 'r' ? 'Most reps per session' : 'Longest set per session';
  const info = e.ref ? exdb.get(e.ref) : null;
  const tabSel = v.tab || (sessions.length ? 'summary' : info ? 'how' : 'summary');
  v.tab = tabSel;
  const tabs = [['summary', 'Summary'], ['history', 'History'], ...(info || e.ref ? [['how', 'How to']] : [])];
  const photos = e.ref ? `<button class="flip${info?.photos === 1 ? ' one' : ''}" data-flip aria-label="Start and finish position, tap to pause">
      <img src="${photoUrl(e.ref, 0)}" alt="Start position">
      ${info?.photos === 1 ? '' : `<img class="b" src="${photoUrl(e.ref, 1)}" alt="Finish position">`}
      <span class="flip-tag">Start ⇄ finish</span>
    </button>` : '';
  const yt = `https://www.youtube.com/results?search_query=${encodeURIComponent(e.name.replace(/\(.*?\)/g, '') + ' ' + (e.equip !== 'Other' && e.equip !== 'Bodyweight' ? e.equip : '') + ' proper form')}`;
  let body = '';
  if (tabSel === 'how') {
    body = `${info ? `<div class="muscles">${info.prim.map((m) => `<span class="chip main">${esc(m)}</span>`).join('')}${info.sec.map((m) => `<span class="chip">${esc(m)}</span>`).join('')}</div>
      <ol class="steps">${info.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : '<p class="empty">Steps are still loading.</p>'}
      <a class="btn soft block" href="${yt}" target="_blank" rel="noopener">${icon('video')}Watch on YouTube</a>
      <p class="credit">Photos and steps: free-exercise-db (public domain).</p>`;
  } else if (tabSel === 'history') {
    body = sessions.length ? sessions.map((wk) => `<button class="card d-ex hist" data-wid="${wk.id}">
        <span class="hist-top"><b>${esc(wk.name)}</b><small>${dayFmt.format(wk.start)}</small></span>
        ${(() => { let n = 0; return wk.exercises.filter((x) => x.exId === e.id).flatMap((x) => x.sets).map((s) => `<span class="d-set"><span class="set-no t-${s.type}">${setLabel(s, () => ++n)}</span><span>${setText(s, e.kind)}</span></span>`).join(''); })()}
      </button>`).join('') : '<p class="empty">Not logged yet.</p>';
  } else {
    body = `<div class="card chart-card">
        <p class="chart-title">${chartTitle}</p>
        <div class="chart" data-chart></div>
      </div>
      <div class="recs">${recs.map(([k, val]) => `<div class="card"><small>${k}</small><b>${val}</b></div>`).join('')}</div>`;
  }
  return `<header class="bar">
      <button class="icon-btn" data-back aria-label="Back">${icon('back')}</button>
      <span class="bar-mid"></span>
      ${e.custom ? `<button class="icon-btn" data-cmenu aria-label="Exercise options">${icon('more')}</button>` : '<span class="icon-btn"></span>'}
    </header>
    <div class="pad">
      <h1 class="title">${esc(e.name)}</h1>
      <p class="sub">${esc(e.muscle)} · ${esc(e.equip)}</p>
    </div>
    ${photos}
    <div class="pad">
      <div class="seg-tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${k === tabSel}" class="${k === tabSel ? 'on' : ''}" data-xtab="${k}">${l}</button>`).join('')}</div>
      ${body}
    </div>`;
};
VIEWS.exercise.after = (v) => {
  if (v.tab !== 'summary') return;
  const e = getEx(v.id);
  const pts = progression(db.workouts, e.id, e.kind);
  const fmt = e.kind === 'wr' ? (x) => `${fmtW(x, unit())} ${unit()}` : e.kind === 'r' ? (x) => `${x} reps` : (x) => fmtClock(x);
  lineChart($('[data-chart]'), pts.map((p) => ({ t: p.t, v: e.kind === 'wr' ? toUnit(p.v, unit()) : p.v, label: fmt(p.v) })));
};
$('#view').addEventListener('click', (e) => {
  const v = cur();
  if (v.view !== 'exercise') return;
  const xt = e.target.closest('[data-xtab]');
  if (xt) { v.tab = xt.dataset.xtab; rerender(); return; }
  const flip = e.target.closest('[data-flip]');
  if (flip) { flip.classList.toggle('paused'); return; }
  const w = e.target.closest('[data-wid]');
  if (w) { go({ view: 'workoutDetail', id: w.dataset.wid }); return; }
  if (e.target.closest('[data-cmenu]')) {
    const ex = db.custom.find((c) => c.id === v.id);
    const used = db.workouts.some((wk) => wk.exercises.some((x) => x.exId === ex.id)) || db.routines.some((r) => r.items.some((it) => it.exId === ex.id));
    const items = [{ label: 'Edit exercise', fn: () => editCustom(ex, () => rerender()) }];
    if (!used) items.push({ label: 'Delete exercise', danger: true, fn: () => { db.custom = db.custom.filter((c) => c !== ex); save(); buildExMap(); back(); } });
    actionSheet(ex.name, items);
  }
});

// ---------- charts ----------
// One series, one accent. Tap or drag across the plot to read a point.
function lineChart(host, pts) {
  if (!host) return;
  if (pts.length < 2) {
    host.innerHTML = `<p class="chart-empty">${pts.length ? 'One session so far. The line starts after the next one.' : 'Log this exercise to see your progress.'}</p>`;
    return;
  }
  const W = host.clientWidth || 320, H = 170, L = 40, R = 12, T = 14, B = 26;
  const vs = pts.map((p) => p.v);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  const padV = (hi - lo) * 0.15 || hi * 0.1 || 1;
  lo = Math.max(0, lo - padV); hi += padV;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
  const x = (t) => L + ((t - t0) / (t1 - t0 || 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ticks = [lo, (lo + hi) / 2, hi];
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const last = pts[pts.length - 1];
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Progress chart, ${pts.length} sessions">
    ${ticks.map((v) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${fmtNum(v < 100 ? v : Math.round(v))}</text>`).join('')}
    <text class="axis" x="${L}" y="${H - 6}">${shortFmt.format(t0)}</text>
    <text class="axis" x="${W - R}" y="${H - 6}" text-anchor="end">${shortFmt.format(t1)}</text>
    <path class="line" d="${d}"/>
    ${pts.length <= 30 ? pts.map((p) => `<circle class="dot" cx="${x(p.t)}" cy="${y(p.v)}" r="3.5"/>`).join('') : ''}
    <circle class="dot last" cx="${x(last.t)}" cy="${y(last.v)}" r="4.5"/>
    <g class="cross" hidden><line class="cross-line" y1="${T}" y2="${H - B}"/><circle class="cross-dot" r="5"/></g>
  </svg><div class="tip" hidden></div>`;
  const svg = host.querySelector('svg'), cross = svg.querySelector('.cross'), tip = host.querySelector('.tip');
  const show = (ev) => {
    const r = svg.getBoundingClientRect();
    const px = (ev.clientX - r.left) * (W / r.width);
    let best = pts[0];
    for (const p of pts) if (Math.abs(x(p.t) - px) < Math.abs(x(best.t) - px)) best = p;
    const cx = x(best.t), cy = y(best.v);
    cross.hidden = false;
    cross.querySelector('line').setAttribute('x1', cx); cross.querySelector('line').setAttribute('x2', cx);
    cross.querySelector('circle').setAttribute('cx', cx); cross.querySelector('circle').setAttribute('cy', cy);
    tip.hidden = false;
    tip.innerHTML = `<b>${esc(best.label)}</b><small>${dayFmt.format(best.t)}</small>`;
    const left = Math.min(Math.max(cx * (r.width / W) - tip.offsetWidth / 2, 0), r.width - tip.offsetWidth);
    tip.style.left = left + 'px';
  };
  const hide = () => { cross.hidden = true; tip.hidden = true; };
  svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointermove', (ev) => { if (ev.pointerType === 'mouse' || ev.buttons) show(ev); });
  svg.addEventListener('pointerleave', hide);
}

function barChart(host, weeks) {
  const W = host.clientWidth || 320, H = 150, L = 24, R = 8, T = 12, B = 24;
  const max = Math.max(3, ...weeks.map((w) => w.count));
  const lines = max <= 4 ? Array.from({ length: max }, (_, i) => i + 1) : [Math.round(max / 2), max];
  const slot = (W - L - R) / weeks.length, bw = Math.min(22, slot - 6);
  const y = (v) => T + (1 - v / max) * (H - T - B);
  const bars = weeks.map((w, i) => {
    const cx = L + slot * (i + 0.5);
    const top = y(w.count), base = H - B;
    const h = base - top;
    const shape = w.count ? `<path class="bar${i === weeks.length - 1 ? ' now' : ''}" d="M${cx - bw / 2},${base} V${top + Math.min(4, h)} Q${cx - bw / 2},${top} ${cx - bw / 2 + 4},${top} H${cx + bw / 2 - 4} Q${cx + bw / 2},${top} ${cx + bw / 2},${top + Math.min(4, h)} V${base} Z"/>` : '';
    const lbl = i % 3 === (weeks.length - 1) % 3 ? `<text class="axis" x="${cx}" y="${H - 6}" text-anchor="middle">${i === weeks.length - 1 ? 'This wk' : shortFmt.format(w.start)}</text>` : '';
    return `${shape}${lbl}<rect class="hit" data-i="${i}" x="${cx - slot / 2}" y="${T}" width="${slot}" height="${H - T - B}"/>`;
  }).join('');
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Workouts per week, last ${weeks.length} weeks">
    <line class="grid" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>
    ${lines.map((v) => `<line class="grid faint" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
    ${bars}</svg><div class="tip" hidden></div>`;
  const tip = host.querySelector('.tip');
  host.querySelector('svg').addEventListener('pointerover', (ev) => {
    const h = ev.target.closest('.hit');
    if (!h) return;
    const w = weeks[+h.dataset.i];
    tip.hidden = false;
    tip.innerHTML = `<b>${w.count} workout${w.count === 1 ? '' : 's'}</b><small>Week of ${shortFmt.format(w.start)} · ${volText(w.volume)}</small>`;
    const r = host.getBoundingClientRect();
    const cx = (L + slot * (+h.dataset.i + 0.5)) * (r.width / W);
    tip.style.left = Math.min(Math.max(cx - tip.offsetWidth / 2, 0), r.width - tip.offsetWidth) + 'px';
  });
  host.querySelector('svg').addEventListener('pointerleave', () => { tip.hidden = true; });
}

// ---------- profile ----------
VIEWS.profile = () => {
  const list = db.workouts;
  const thisWeek = list.filter((w) => weekStart(w.start) === weekStart(Date.now())).length;
  const total = list.reduce((v, w) => v + workoutVolume(w), 0);
  const hours = list.reduce((v, w) => v + (w.end - w.start), 0);
  const streak = streakWeeks(list);
  const s = db.settings;
  return `<header class="head"><h1>Profile</h1></header>
  <div class="pad">
    <div class="recs four">
      <div class="card"><small>Workouts</small><b>${list.length}</b></div>
      <div class="card"><small>This week</small><b>${thisWeek}</b></div>
      <div class="card"><small>Week streak</small><b>${streak}</b></div>
      <div class="card"><small>Time lifting</small><b>${fmtDuration(hours)}</b></div>
    </div>
    <div class="card chart-card">
      <p class="chart-title">Workouts per week</p>
      <div class="chart" data-bars></div>
      <p class="chart-foot">${volText(total)} lifted in total</p>
    </div>
    <div class="card list">
      <button class="row" data-exlib>${icon('list')}<span><b>Exercises</b><small>${allExercises().length} in your list · ${exdb.size || 868} more with photos</small></span>${icon('chev', 'dim')}</button>
    </div>
    <h2 class="month">Hevy</h2>
    <div class="card settings">
      <p class="set-note">In Hevy: Profile › Settings › Export &amp; Import Data › Export Workouts. Then pick that CSV file here. Importing twice is safe: workouts already in Lift are skipped.</p>
      <button class="btn soft block" data-hevy>Import from Hevy</button>
      <input type="file" accept=".csv,text/csv" data-hevyfile hidden>
    </div>
    <h2 class="month">Settings</h2>
    <div class="card settings">
      <div class="set-line"><span>Units</span><div class="seg sm" data-unit>${['kg', 'lb'].map((u) => `<button data-u="${u}" class="${s.unit === u ? 'on' : ''}">${u}</button>`).join('')}</div></div>
      <label class="set-line"><span>Default rest</span><select data-defrest>${[0, 30, 60, 90, 120, 180, 240, 300].map((sec) => `<option value="${sec}"${sec === s.rest ? ' selected' : ''}>${sec ? fmtClock(sec) : 'Off'}</option>`).join('')}</select></label>
    </div>
    <h2 class="month">Backup</h2>
    <div class="card settings">
      <p class="set-note">Your workouts live on this phone only. Export a backup now and then, and after big sessions.</p>
      <div class="row2"><button class="btn soft" data-export>Export</button><button class="btn soft" data-import>Import</button></div>
      <p class="set-note dim">${db.lastBackup ? `Last export ${dayFmt.format(db.lastBackup)}` : 'No export yet'}</p>
      <input type="file" accept="application/json,.json" data-file hidden>
    </div>
    <p class="foot">Lift 2</p>
  </div>`;
};
VIEWS.profile.after = () => barChart($('[data-bars]'), weeklyCounts(db.workouts, 12));

$('#view').addEventListener('click', async (e) => {
  if (cur().view !== 'profile') return;
  const t = e.target;
  const u = t.closest('[data-u]');
  if (u) { db.settings.unit = u.dataset.u; save(); rerender(); return; }
  if (t.closest('[data-export]')) { exportData(); return; }
  if (t.closest('[data-import]')) $('[data-file]').click();
  if (t.closest('[data-exlib]')) go({ view: 'exercises' });
  if (t.closest('[data-hevy]')) $('[data-hevyfile]').click();
});

// ---------- Hevy import ----------
// Hevy's CSV holds workouts, not routines. Lift adds the workouts (skipping ones it has),
// links each Hevy exercise name to a Lift exercise or makes it one of yours, then offers
// to build the rotation from the workouts you repeat.
$('#view').addEventListener('change', async (e) => {
  if (!e.target.matches('[data-hevyfile]')) return;
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  let found;
  try { found = hevyWorkouts(await f.text()); } catch { found = []; }
  if (!found.length) { toast('No workouts found in that file'); return; }
  const have = new Set(db.workouts.map((w) => Math.round(w.start / 60000) + '|' + w.name));
  const fresh = found.filter((w) => !have.has(Math.round(w.start / 60000) + '|' + w.name));
  const titles = [...new Set(found.flatMap((w) => w.exercises.map((x) => x.title)))];
  const lib = allExercises();
  const matched = new Map();
  for (const t of titles) { const m = matchExercise(t, lib); if (m) matched.set(t, m.id); }
  const newOnes = titles.filter((t) => !matched.has(t));
  const range = `${shortFmt.format(found[0].start)} ${new Date(found[0].start).getFullYear()} – ${shortFmt.format(found[found.length - 1].start)} ${new Date(found[found.length - 1].start).getFullYear()}`;
  if (!fresh.length) { toast(`All ${found.length} workouts are already in Lift`); return; }
  const ok = await confirmBox(`Import ${fresh.length} workout${fresh.length === 1 ? '' : 's'}?`,
    `${range}. ${titles.length} exercises: ${matched.size} matched to Lift's list${newOnes.length ? `, ${newOnes.length} added as your own` : ''}.${fresh.length < found.length ? ` ${found.length - fresh.length} already in Lift are skipped.` : ''}`,
    'Import');
  if (!ok) return;
  for (const t of newOnes) {
    const sets = found.flatMap((w) => w.exercises.filter((x) => x.title === t).flatMap((x) => x.sets));
    const ex = { id: 'c-' + uid(), name: t, muscle: 'Other', equip: 'Other', kind: kindFromSets(sets), custom: true, fromHevy: true };
    db.custom.push(ex);
    matched.set(t, ex.id);
  }
  for (const w of fresh) {
    db.workouts.push({
      id: uid(), name: w.name, start: w.start, end: w.end, routineId: null, src: 'hevy',
      exercises: w.exercises.map((x) => ({ exId: matched.get(x.title), note: x.note, sets: x.sets })),
    });
  }
  save();
  buildExMap();
  toast(`${fresh.length} workouts imported`);
  rerender();
  offerRotation();
});

// Routines from the workouts you repeat (last 90 days), oldest-done first so the
// rotation carries on where Hevy left off. Past workouts with the same name get linked.
async function offerRotation() {
  const taken = new Set(db.routines.map((r) => r.name.toLowerCase()));
  const found = routinesFromHistory(db.workouts, Date.now() - 90 * 86400000, kindOf).filter((r) => !taken.has(r.name.toLowerCase()));
  if (!found.length) return;
  const days = daysFromHistory(db.workouts);
  const dayList = days.map((on, i) => (on ? DAY_NAMES[i].slice(0, 3) : '')).filter(Boolean).join(', ');
  const ok = await confirmBox('Make these your rotation?',
    `${found.map((r) => `${r.name} (${r.items.length} exercises)`).join(' → ')}. Built from your latest sessions, with rep ranges from what you did.${dayList ? ` Gym days: ${dayList}.` : ''} You can change all of it.`,
    'Use these');
  if (!ok) return;
  for (const r of found) {
    const id = uid();
    db.routines.push({ id, name: r.name, items: r.items });
    for (const w of db.workouts) if (!w.routineId && w.name === r.name) w.routineId = id;
  }
  if (days.some(Boolean)) db.plan.days = days;
  db.plan.pick = null;
  save();
  warmPhotos();
  stack = [];
  tab = 'today';
  history.replaceState({ n: 0 }, '');
  render();
  scrollTo(0, 0);
}

// Fetch the photos of every routine exercise once, so they are there without signal.
function warmPhotos() {
  if (!navigator.onLine) return;
  const refs = new Set(db.routines.flatMap((r) => r.items.map((it) => getEx(it.exId).ref)).filter(Boolean));
  const urls = [...refs].flatMap((ref) => [photoUrl(ref, 0), photoUrl(ref, 1)]);
  const run = () => urls.forEach((u, i) => setTimeout(() => fetch(u, { mode: 'no-cors' }).catch(() => {}), i * 120));
  ('requestIdleCallback' in window) ? requestIdleCallback(run) : setTimeout(run, 2000);
}
$('#view').addEventListener('change', async (e) => {
  if (e.target.matches('[data-defrest]')) { db.settings.rest = Number(e.target.value); save(); toast('Default rest saved'); }
  if (e.target.matches('[data-file]')) {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!Array.isArray(data.workouts) || !Array.isArray(data.routines)) throw new Error('shape');
      const ok = await confirmBox('Replace everything?', `The file has ${data.workouts.length} workouts and ${data.routines.length} routines. What's on this phone now will be replaced.`, 'Replace', true);
      if (!ok) return;
      db = { ...EMPTY(), ...data, active: db.active };
      save(); buildExMap(); rerender();
      toast('Backup restored');
    } catch { toast('That file is not a Lift backup'); }
    e.target.value = '';
  }
});

async function exportData() {
  const { active, ...data } = db;
  const text = JSON.stringify({ app: 'lift', version: 1, exported: new Date().toISOString(), ...data }, null, 1);
  const name = `lift-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([text], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Lift backup' });
    else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    db.lastBackup = Date.now(); save(); rerender();
  } catch (err) {
    if (err?.name !== 'AbortError') toast('Export failed');
  }
}

// ---------- start ----------
if (db.active?.rest && db.active.rest.end > Date.now()) { rest.end = db.active.rest.end; rest.total = db.active.rest.total; }
history.replaceState({ n: 0 }, '');
render();
if (db.active) go({ view: 'active' });
loadExdb();
warmPhotos();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
