# AGENTS.md

## Cursor Cloud specific instructions

This is a single-process Node.js game app (Express + Socket.IO) with no external dependencies (no DB, no Redis, no Docker). All state is in-memory and resets on server restart.

### Running the app

```
npm start          # starts on port 3000 (or PORT env var)
```

Four browser views: Host (`/`), Master A (`/master.html?team=A`), Master B (`/master.html?team=B`), Viewer (`/viewer.html`).

### Testing

- **E2E test** (requires server running on port 3000): `node scripts/e2e-round-test.js`
- No linter or type checker is configured in this project.
- No unit test framework; the e2e script is the sole automated test.

### Gotchas

- `npm dev` and `npm start` run the same command (`node server.js`); there is no hot-reload / watch mode.
- The e2e test connects to `localhost:3000` — the server must be running first.
- In-memory state means the server must be restarted for a clean game state between test runs.
