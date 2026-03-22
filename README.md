# Guess the Master

Realtime party game for two teams where players guess their team's Master likes/dislikes across category cards.

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
