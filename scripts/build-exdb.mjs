// Builds app/exdb.json from free-exercise-db (github.com/yuhonas/free-exercise-db, public domain).
//   curl -sL -o exercises.json https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json
//   node scripts/build-exdb.mjs path/to/exercises.json
// Photos are not copied: the app loads them from jsDelivr at the commit in app/exercises.js (EXDB_COMMIT).
import fs from 'node:fs';

const src = process.argv[2];
if (!src) { console.error('usage: node scripts/build-exdb.mjs exercises.json'); process.exit(1); }
const all = JSON.parse(fs.readFileSync(src, 'utf8'));

const MUSCLE = {
  chest: 'Chest', lats: 'Back', 'middle back': 'Back', 'lower back': 'Back', traps: 'Back',
  shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Other',
  quadriceps: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves',
  abdominals: 'Core', adductors: 'Other', abductors: 'Glutes', neck: 'Other',
};
const EQUIP = {
  barbell: 'Barbell', 'e-z curl bar': 'Barbell', dumbbell: 'Dumbbell', cable: 'Cable', machine: 'Machine',
  'body only': 'Bodyweight', kettlebells: 'Kettlebell',
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const rows = all
  .filter((e) => e.images?.length && e.instructions?.length)
  .map((e) => {
    const equip = EQUIP[e.equipment] || 'Other';
    const kind = e.category === 'cardio' ? 't' : equip === 'Bodyweight' ? 'r' : e.category === 'stretching' ? 't' : 'wr';
    return {
      id: e.id,
      name: e.name,
      muscle: e.category === 'cardio' ? 'Cardio' : MUSCLE[e.primaryMuscles[0]] || 'Other',
      equip,
      kind,
      prim: e.primaryMuscles.map(cap),
      sec: e.secondaryMuscles.map(cap),
      photos: e.images.length,
      steps: e.instructions.map((s) => s.trim()).filter(Boolean),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

fs.writeFileSync(new URL('../app/exdb.json', import.meta.url), JSON.stringify(rows));
console.log(`${rows.length} exercises → app/exdb.json`);
