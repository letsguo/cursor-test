# Guess the Master

Team-based party game where players guess their Master teammate's likes/dislikes.

## Fully-on-Vercel architecture

This project is now Vercel-first:

- Static UI pages in `public/`
- Serverless API routes in `api/`
- Shared game state in Upstash Redis (via Vercel integration)
- Client updates via short polling (no custom socket server required)

## Deploy on Vercel only

1. Import this repository into Vercel.
2. Add the **Upstash Redis** integration in Vercel.
3. Ensure env vars are present:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
4. Deploy.

No separate backend host is required.

## Local run

Use Vercel local dev so API routes run correctly:

```bash
npm install
npm run dev
```

Open:

- Host: `http://localhost:3000/`
- Viewer: `http://localhost:3000/viewer.html`
- Masters:
  - `http://localhost:3000/master.html?team=A`
  - `http://localhost:3000/master.html?team=B`

## Game flow implemented

- Start round with 5-7 categories
- Team bets
- Host-assisted team guesses
- Master inputs (private before reveal)
- Lock phase
- Reveal next/all
- Submit scores
- Reset for next round

## Scoring

Per team each round:

1. `+1` per correct guess
2. `+3` winner bonus for team with more correct (no bonus on tie)
3. Bet modifier:
   - `+2` if correct >= bet
   - `-2` otherwise

## Automated test

```bash
npm run test:e2e
```

The E2E script hits Vercel API endpoints and validates:

- phase transitions
- pre-reveal privacy
- reveal progression
- score math
- reset behavior
