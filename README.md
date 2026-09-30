# Lift

Paul's own workout logger in the style of Hevy. A static offline PWA: no account, no server.
Workouts live in the phone's localStorage (`lift.v1`); Profile → Export makes a JSON backup.

- `app/` is the whole app (vanilla JS modules). `exercises.js` is the built-in library: never rename or reuse an id.
- `npm test` runs the logic tests. `npm run serve` serves on :8080 (`PORT=8093` to pick another),
  then `npm run check` drives the app in a phone-sized browser (`ENGINE=webkit`, `SCHEME=light`) and writes screenshots/.
- Bump `CACHE` in `app/sw.js` on every release.
