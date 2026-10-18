# Lift

Paul's own workout logger in the style of Hevy. A static offline PWA: no account, no server.
Workouts live in the phone's localStorage (`lift.v1`); Profile → Export makes a JSON backup.

Lift 2 (2026-10-18) is built around a rotation: routines run in list order on the gym days Paul taps on Today,
and a missed day never moves it. Each weight-and-reps exercise in a routine has a rep range; when every
counting set reached the top last time, today's weight is one step up (2 kg dumbbells, 2.5 kg otherwise),
else it stays. It never goes down. Profile → Import from Hevy reads Hevy's workout CSV export.

- `app/` is the whole app (vanilla JS modules). `exercises.js` is the built-in library: never rename or reuse an id.
  Its `REF` map links each built-in to a free-exercise-db entry for photos and steps.
- `app/exdb.json` is free-exercise-db (public domain), trimmed by `node scripts/build-exdb.mjs exercises.json`.
  Photos are not in the repo: they load from jsDelivr pinned to `EXDB_COMMIT` and the service worker keeps them.
- `npm test` runs the logic tests. `npm run serve` serves on :8080 (`PORT=8093` to pick another),
  then `npm run check` drives the app in a phone-sized browser (`ENGINE=webkit`) and writes screenshots/.
- Bump `CACHE` in `app/sw.js` on every release. `PHOTOS` only changes with `EXDB_COMMIT`.
