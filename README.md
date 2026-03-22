# Guess the Master

Realtime party game for two teams where players guess their team's Master likes/dislikes across category cards.

## Deployment model (recommended)

Because this app uses Socket.IO, deploy with:

- **Frontend static UI on Vercel**
- **Backend Node/Socket.IO server on a socket-friendly host** (Render, Railway, Fly, etc.)

### Why split deployment

Vercel is excellent for static frontend hosting, but this app needs a persistent realtime socket server process.

## Quick deploy steps

### 1) Deploy backend (`server.js`) on Render/Railway/Fly

- Build command: `npm install`
- Start command: `npm start`
- Environment:
  - `PORT` (provided by platform)
  - `CORS_ORIGINS=https://<your-vercel-domain>,http://localhost:3000`

After deploy, note your backend URL, e.g.:
`https://guess-master-backend.onrender.com`

### 2) Deploy frontend to Vercel

This repository already includes `vercel.json` for static hosting defaults.

On first load of the host page (`/`):
- Enter backend URL in **Socket Backend URL**
- Click **Save Backend URL**

This value is stored in browser localStorage and shared by host/master/viewer pages on that device.

The host page also automatically rewrites the Team A / Team B / Viewer links to include `socketUrl=...` query params, so those devices connect to the same backend immediately.

You can clear it via **Use Same-Origin** for local development.

## What is implemented

- **Host screen** (`/`)
  - Start round with 5-7 categories
  - Set bets for Team A and Team B
  - Record team guesses (optional assisted scoring)
  - Lock guesses
  - Reveal cards one by one or all at once
  - Submit round scoring
  - Reset for next round
  - Live scoreboard + round summary

- **Master private input screens**
  - Team A Master: `/master.html?team=A`
  - Team B Master: `/master.html?team=B`
  - Masters can choose 👍 Like / 👎 Dislike per category
  - Answers lock after submit or host lock

- **Viewer display** (`/viewer.html`)
  - Shows scoreboard + card reveals for spectators/projector

- **Realtime sync**
  - Built with Socket.IO
  - All host/master/viewer clients stay in sync

## Scoring rules implemented

Per team each round:

1. **Base points:** `+1` per correct guess
2. **Round winner bonus:** `+3` to team with more correct guesses (no bonus on tie)
3. **Bet outcome:**
   - `+2` if correct guesses >= bet
   - `-2` otherwise

Round total is added to cumulative team score.

## Privacy/lock behavior

- Master answers are hidden from host/viewers until each card is revealed.
- Masters can edit only during active phase before submitting.
- Host `Lock Guesses` moves game to reveal phase and prevents further edits.

## Run locally

```bash
npm install
npm start
```

Then open:

- Host: `http://localhost:3000/`
- Viewer: `http://localhost:3000/viewer.html`
- Masters:
  - `http://localhost:3000/master.html?team=A`
  - `http://localhost:3000/master.html?team=B`

## Automated end-to-end test

```bash
node scripts/e2e-round-test.js
```

This test simulates host + both masters + viewer over Socket.IO and validates:
- round flow transitions
- answer privacy before reveal
- reveal behavior
- score calculations
- reset behavior
