// Built-in exercise library. Each row: [id, name, muscle, equipment, kind].
// kind: 'wr' weight × reps, 'r' reps only (bodyweight), 't' time.
// Ids are stored in workouts, so never rename or reuse an id; names can change.
export const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Cardio', 'Other'];
export const EQUIPMENT = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Kettlebell', 'Other'];

const ROWS = [
  ['bench-bb', 'Bench Press (Barbell)', 'Chest', 'Barbell', 'wr'],
  ['incline-bench-bb', 'Incline Bench Press (Barbell)', 'Chest', 'Barbell', 'wr'],
  ['decline-bench-bb', 'Decline Bench Press (Barbell)', 'Chest', 'Barbell', 'wr'],
  ['bench-db', 'Bench Press (Dumbbell)', 'Chest', 'Dumbbell', 'wr'],
  ['incline-bench-db', 'Incline Bench Press (Dumbbell)', 'Chest', 'Dumbbell', 'wr'],
  ['fly-db', 'Chest Fly (Dumbbell)', 'Chest', 'Dumbbell', 'wr'],
  ['fly-cable', 'Cable Fly Crossover', 'Chest', 'Cable', 'wr'],
  ['chest-press-m', 'Chest Press (Machine)', 'Chest', 'Machine', 'wr'],
  ['pec-deck', 'Pec Deck (Machine)', 'Chest', 'Machine', 'wr'],
  ['push-up', 'Push-up', 'Chest', 'Bodyweight', 'r'],
  ['chest-dip', 'Chest Dip', 'Chest', 'Bodyweight', 'r'],

  ['deadlift-bb', 'Deadlift (Barbell)', 'Back', 'Barbell', 'wr'],
  ['row-bb', 'Bent Over Row (Barbell)', 'Back', 'Barbell', 'wr'],
  ['pendlay-row', 'Pendlay Row (Barbell)', 'Back', 'Barbell', 'wr'],
  ['tbar-row', 'T-Bar Row', 'Back', 'Barbell', 'wr'],
  ['row-db', 'Dumbbell Row', 'Back', 'Dumbbell', 'wr'],
  ['pull-up', 'Pull-up', 'Back', 'Bodyweight', 'r'],
  ['pull-up-w', 'Pull-up (Weighted)', 'Back', 'Bodyweight', 'wr'],
  ['chin-up', 'Chin-up', 'Back', 'Bodyweight', 'r'],
  ['lat-pulldown', 'Lat Pulldown (Cable)', 'Back', 'Cable', 'wr'],
  ['cable-row', 'Seated Cable Row', 'Back', 'Cable', 'wr'],
  ['row-m', 'Seated Row (Machine)', 'Back', 'Machine', 'wr'],
  ['face-pull', 'Face Pull (Cable)', 'Back', 'Cable', 'wr'],
  ['shrug-db', 'Shrug (Dumbbell)', 'Back', 'Dumbbell', 'wr'],
  ['back-ext', 'Back Extension', 'Back', 'Bodyweight', 'r'],

  ['ohp-bb', 'Overhead Press (Barbell)', 'Shoulders', 'Barbell', 'wr'],
  ['shoulder-press-db', 'Shoulder Press (Dumbbell)', 'Shoulders', 'Dumbbell', 'wr'],
  ['shoulder-press-m', 'Shoulder Press (Machine)', 'Shoulders', 'Machine', 'wr'],
  ['arnold-press', 'Arnold Press (Dumbbell)', 'Shoulders', 'Dumbbell', 'wr'],
  ['lateral-raise-db', 'Lateral Raise (Dumbbell)', 'Shoulders', 'Dumbbell', 'wr'],
  ['lateral-raise-cable', 'Lateral Raise (Cable)', 'Shoulders', 'Cable', 'wr'],
  ['front-raise-db', 'Front Raise (Dumbbell)', 'Shoulders', 'Dumbbell', 'wr'],
  ['reverse-fly-db', 'Reverse Fly (Dumbbell)', 'Shoulders', 'Dumbbell', 'wr'],
  ['rear-delt-m', 'Rear Delt Fly (Machine)', 'Shoulders', 'Machine', 'wr'],

  ['curl-bb', 'Bicep Curl (Barbell)', 'Biceps', 'Barbell', 'wr'],
  ['curl-ez', 'EZ Bar Curl', 'Biceps', 'Barbell', 'wr'],
  ['curl-db', 'Bicep Curl (Dumbbell)', 'Biceps', 'Dumbbell', 'wr'],
  ['hammer-curl', 'Hammer Curl (Dumbbell)', 'Biceps', 'Dumbbell', 'wr'],
  ['incline-curl', 'Incline Curl (Dumbbell)', 'Biceps', 'Dumbbell', 'wr'],
  ['preacher-curl', 'Preacher Curl', 'Biceps', 'Machine', 'wr'],
  ['curl-cable', 'Bicep Curl (Cable)', 'Biceps', 'Cable', 'wr'],

  ['pushdown', 'Triceps Pushdown (Cable)', 'Triceps', 'Cable', 'wr'],
  ['oh-ext-cable', 'Overhead Triceps Extension (Cable)', 'Triceps', 'Cable', 'wr'],
  ['tri-ext-db', 'Triceps Extension (Dumbbell)', 'Triceps', 'Dumbbell', 'wr'],
  ['skullcrusher', 'Skullcrusher (Barbell)', 'Triceps', 'Barbell', 'wr'],
  ['cgbp', 'Close Grip Bench Press', 'Triceps', 'Barbell', 'wr'],
  ['tri-dip', 'Triceps Dip', 'Triceps', 'Bodyweight', 'r'],

  ['squat-bb', 'Squat (Barbell)', 'Quads', 'Barbell', 'wr'],
  ['front-squat', 'Front Squat (Barbell)', 'Quads', 'Barbell', 'wr'],
  ['goblet-squat', 'Goblet Squat', 'Quads', 'Dumbbell', 'wr'],
  ['leg-press', 'Leg Press (Machine)', 'Quads', 'Machine', 'wr'],
  ['hack-squat', 'Hack Squat (Machine)', 'Quads', 'Machine', 'wr'],
  ['leg-ext', 'Leg Extension (Machine)', 'Quads', 'Machine', 'wr'],
  ['bulgarian', 'Bulgarian Split Squat (Dumbbell)', 'Quads', 'Dumbbell', 'wr'],
  ['lunge-db', 'Lunge (Dumbbell)', 'Quads', 'Dumbbell', 'wr'],

  ['rdl-bb', 'Romanian Deadlift (Barbell)', 'Hamstrings', 'Barbell', 'wr'],
  ['rdl-db', 'Romanian Deadlift (Dumbbell)', 'Hamstrings', 'Dumbbell', 'wr'],
  ['lying-curl', 'Lying Leg Curl (Machine)', 'Hamstrings', 'Machine', 'wr'],
  ['seated-curl', 'Seated Leg Curl (Machine)', 'Hamstrings', 'Machine', 'wr'],
  ['good-morning', 'Good Morning (Barbell)', 'Hamstrings', 'Barbell', 'wr'],

  ['hip-thrust', 'Hip Thrust (Barbell)', 'Glutes', 'Barbell', 'wr'],
  ['glute-bridge', 'Glute Bridge', 'Glutes', 'Bodyweight', 'r'],
  ['hip-abduction', 'Hip Abduction (Machine)', 'Glutes', 'Machine', 'wr'],
  ['kickback-cable', 'Glute Kickback (Cable)', 'Glutes', 'Cable', 'wr'],
  ['kb-swing', 'Kettlebell Swing', 'Glutes', 'Kettlebell', 'wr'],

  ['calf-standing', 'Standing Calf Raise (Machine)', 'Calves', 'Machine', 'wr'],
  ['calf-seated', 'Seated Calf Raise (Machine)', 'Calves', 'Machine', 'wr'],

  ['plank', 'Plank', 'Core', 'Bodyweight', 't'],
  ['crunch', 'Crunch', 'Core', 'Bodyweight', 'r'],
  ['cable-crunch', 'Cable Crunch', 'Core', 'Cable', 'wr'],
  ['hanging-leg-raise', 'Hanging Leg Raise', 'Core', 'Bodyweight', 'r'],
  ['ab-wheel', 'Ab Wheel', 'Core', 'Other', 'r'],
  ['russian-twist', 'Russian Twist', 'Core', 'Bodyweight', 'r'],

  ['treadmill', 'Treadmill', 'Cardio', 'Machine', 't'],
  ['bike', 'Cycling (Stationary)', 'Cardio', 'Machine', 't'],
  ['rower', 'Rowing Machine', 'Cardio', 'Machine', 't'],
  ['jump-rope', 'Jump Rope', 'Cardio', 'Other', 't'],
  ['farmers-walk', "Farmer's Walk", 'Other', 'Dumbbell', 'wr'],
];

export const BUILT_IN = ROWS.map(([id, name, muscle, equip, kind]) => ({ id, name, muscle, equip, kind }));
