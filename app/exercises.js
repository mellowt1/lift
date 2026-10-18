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

// Photos and steps for the built-ins come from free-exercise-db (public domain): built-in id → its id there.
const REF = {
  'bench-bb': 'Barbell_Bench_Press_-_Medium_Grip', 'incline-bench-bb': 'Barbell_Incline_Bench_Press_-_Medium_Grip',
  'decline-bench-bb': 'Decline_Barbell_Bench_Press', 'bench-db': 'Dumbbell_Bench_Press', 'incline-bench-db': 'Incline_Dumbbell_Press',
  'fly-db': 'Dumbbell_Flyes', 'fly-cable': 'Cable_Crossover', 'chest-press-m': 'Leverage_Chest_Press', 'pec-deck': 'Butterfly',
  'push-up': 'Pushups', 'chest-dip': 'Dips_-_Chest_Version',
  'deadlift-bb': 'Barbell_Deadlift', 'row-bb': 'Bent_Over_Barbell_Row', 'pendlay-row': 'Bent_Over_Barbell_Row',
  'tbar-row': 'T-Bar_Row_with_Handle', 'row-db': 'One-Arm_Dumbbell_Row', 'pull-up': 'Pullups', 'pull-up-w': 'Weighted_Pull_Ups',
  'chin-up': 'Chin-Up', 'lat-pulldown': 'Wide-Grip_Lat_Pulldown', 'cable-row': 'Seated_Cable_Rows', 'row-m': 'Leverage_Iso_Row',
  'face-pull': 'Face_Pull', 'shrug-db': 'Dumbbell_Shrug', 'back-ext': 'Hyperextensions_Back_Extensions',
  'ohp-bb': 'Standing_Military_Press', 'shoulder-press-db': 'Dumbbell_Shoulder_Press', 'shoulder-press-m': 'Machine_Shoulder_Military_Press',
  'arnold-press': 'Arnold_Dumbbell_Press', 'lateral-raise-db': 'Side_Lateral_Raise', 'lateral-raise-cable': 'Cable_Seated_Lateral_Raise',
  'front-raise-db': 'Front_Dumbbell_Raise', 'reverse-fly-db': 'Reverse_Flyes', 'rear-delt-m': 'Reverse_Machine_Flyes',
  'curl-bb': 'Barbell_Curl', 'curl-ez': 'Close-Grip_EZ_Bar_Curl', 'curl-db': 'Dumbbell_Bicep_Curl', 'hammer-curl': 'Hammer_Curls',
  'incline-curl': 'Incline_Dumbbell_Curl', 'preacher-curl': 'Machine_Preacher_Curls', 'curl-cable': 'Standing_Biceps_Cable_Curl',
  'pushdown': 'Triceps_Pushdown', 'oh-ext-cable': 'Cable_Rope_Overhead_Triceps_Extension', 'tri-ext-db': 'Standing_Dumbbell_Triceps_Extension',
  'skullcrusher': 'EZ-Bar_Skullcrusher', 'cgbp': 'Close-Grip_Barbell_Bench_Press', 'tri-dip': 'Dips_-_Triceps_Version',
  'squat-bb': 'Barbell_Squat', 'front-squat': 'Front_Barbell_Squat', 'goblet-squat': 'Goblet_Squat', 'leg-press': 'Leg_Press',
  'hack-squat': 'Hack_Squat', 'leg-ext': 'Leg_Extensions', 'bulgarian': 'Split_Squat_with_Dumbbells', 'lunge-db': 'Dumbbell_Lunges',
  'rdl-bb': 'Romanian_Deadlift', 'rdl-db': 'Stiff-Legged_Dumbbell_Deadlift', 'lying-curl': 'Lying_Leg_Curls', 'seated-curl': 'Seated_Leg_Curl',
  'good-morning': 'Good_Morning', 'hip-thrust': 'Barbell_Hip_Thrust', 'glute-bridge': 'Butt_Lift_Bridge', 'hip-abduction': 'Thigh_Abductor',
  'kickback-cable': 'One-Legged_Cable_Kickback','calf-standing': 'Standing_Calf_Raises',
  'calf-seated': 'Seated_Calf_Raise', 'plank': 'Plank', 'crunch': 'Crunches', 'cable-crunch': 'Cable_Crunch',
  'hanging-leg-raise': 'Hanging_Leg_Raise', 'ab-wheel': 'Ab_Roller', 'russian-twist': 'Russian_Twist', 'treadmill': 'Jogging_Treadmill',
  'bike': 'Bicycling_Stationary', 'rower': 'Rowing_Stationary', 'jump-rope': 'Rope_Jumping', 'farmers-walk': 'Farmers_Walk',
};

export const BUILT_IN = ROWS.map(([id, name, muscle, equip, kind]) => ({ id, name, muscle, equip, kind, ref: REF[id] || null }));

// Hevy names that differ from Lift's (lower case) → a built-in id or "db:<free-exercise-db id>".
// Names that already match, give or take punctuation and plurals, need no entry.
export const HEVY_ALIAS = {
  'chest fly (machine)': 'pec-deck',
  'butterfly (pec deck)': 'pec-deck',
  'rear delt reverse fly (machine)': 'rear-delt-m',
  'rear delt reverse fly (dumbbell)': 'reverse-fly-db',
  'seated cable row - bar grip': 'cable-row',
  'seated cable row - v grip (cable)': 'cable-row',
  'triceps rope pushdown': 'pushdown',
  'triceps pushdown': 'pushdown',
  'seated shoulder press (machine)': 'shoulder-press-m',
  'iso-lateral high row (machine)': 'db:Leverage_High_Row',
  'reverse grip lat pulldown (cable)': 'db:Underhand_Cable_Pulldowns',
  'scapular pull ups': 'db:Scapular_Pull-Up',
  'overhead plate raise': 'db:Front_Plate_Raise',
  'stair machine (floors)': 'db:Stairmaster',
  'stair machine': 'db:Stairmaster',
  'back extension (weighted hyperextension)': 'db:Hyperextensions_Back_Extensions',
};

// Photos load from jsDelivr, pinned to one commit so they never change under us.
export const EXDB_COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5';
export const photoUrl = (ref, n = 0) => `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${EXDB_COMMIT}/exercises/${ref}/${n}.jpg`;
