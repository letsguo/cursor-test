const {
  startRound,
  setBet,
  setGuess,
  lockGuesses,
  revealNext,
  revealAll,
  submitScores,
  resetForNextRound,
} = require("../lib/game-engine");
const { loadGameState, saveGameState } = require("../lib/state-store");

const HANDLERS = {
  startRound: (state, payload) => startRound(state, payload.categories),
  setBet: (state, payload) => setBet(state, payload.team, payload.bet),
  setGuess: (state, payload) => setGuess(state, payload.team, payload.index, payload.guess),
  lockGuesses: (state) => lockGuesses(state),
  revealNext: (state) => revealNext(state),
  revealAll: (state) => revealAll(state),
  submitScores: (state) => submitScores(state),
  resetForNextRound: (state) => resetForNextRound(state),
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed." });
    return;
  }

  const action = String(req.body?.action || "");
  const payload = req.body?.payload || {};
  const handler = HANDLERS[action];

  if (!handler) {
    res.status(400).json({ ok: false, error: "Unknown host action." });
    return;
  }

  const state = await loadGameState();
  const result = handler(state, payload);

  if (!result?.ok) {
    res.status(400).json({ ok: false, error: result?.error || "Action failed." });
    return;
  }

  await saveGameState(state);
  res.status(200).json({ ok: true });
};
