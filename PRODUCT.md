# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
One person: Paul, the owner. He trains in a regular gym (barbells, dumbbells, cables, machines) on varying days and logs every session on his iPhone, one-handed, between sets: 60–120 s of rest, phone in his hand or on a bench, hands sweaty or chalky. He came from Hevy and still holds Lift to Hevy's bar. Lift is built only for him; it does not need to explain itself to anyone else.

## Product Purpose
Log a workout set by set with as little friction as possible, and tell Paul what to lift next. Success: he opens Lift instead of Hevy every gym day, logs a set in one tap, and comes back because it shows him progress (the next weight, his records, what he has been neglecting).

## Positioning
Lift is a coach that keeps the book. It runs Paul's own routines as a rotation (Push → Pull → Legs; a missed day never breaks the cycle), pre-fills each exercise with the weight to lift today (all sets at the top of the rep range → +2.5 kg, never down), and ticking a set accepts that suggestion. It knows his history, his gaps per muscle, and can ask Claude through his own hub. No other app has his rotation, his history and his hub behind it.

## Operating Context
- The gym, between sets: glance at the next set, lift, tick, rest timer starts, repeat. A session is 45–75 minutes, 4–8 exercises, 3–4 sets each.
- Before a session: Today shows the routine due next and its weights. After: a summary with records and "next time".
- At home: building routines, importing from Hevy (CSV), looking at history, finding exercises for muscles that get little work.
- Data lives on the phone (localStorage `lift.v1`); paul-hub (his Cloudflare Worker) receives a summary and backup after each workout and feeds Morning (Gym card), Day (gym blocks) and Hiscores (Strength XP).

## Capabilities and Constraints
- Static offline PWA, vanilla JS, GitHub Pages (mellowt1/lift); no build step.
- Must keep: the Hevy-style set table (Set · Previous · kg · Reps · ✓) and one-tap logging (tick accepts the suggested weight/reps).
- Rotation of routines, gym-day pills, rep range per routine item, suggested weight, PRs (weight, e1RM, set volume, reps, time), set types W/D/F, rest timer, swipe-to-delete with Undo, exercise how-to (free-exercise-db photos + steps + YouTube search), Find exercises (sets/week per muscle, good picks, Ask Claude), Hevy CSV import, kg/lb.
- Storage key stays `lift.v1`; new fields optional.

## Brand Commitments
Name: Lift. Paul's taste across his apps: clean, calm, not AI-looking, not a generic template; he judges by how it looks on screen and wants something he wants to come back to. No emoji, no gamified noise.

## Evidence on Hand
Real data on the phone only (21 workouts imported from Hevy, Jul–Oct 2026; routines Back → Chest → Shoulders). Test seed data lives in scripts/check.mjs. Exercise photos: free-exercise-db (public domain) via jsDelivr.

## Product Principles
1. Between sets, nothing beats one tap: never add a step to logging a set.
2. The app answers "what now" before anything else: the next set, the next weight, the next routine.
3. Progress is the reward: show the number going up, not decoration.
4. Readable at arm's length: numbers that matter are big.

## Accessibility & Inclusion
Touch targets at least 44 pt for anything used mid-set; readable in bright gym light and at arm's length.
