const {
  updateMasterAnswer,
  clearMasterAnswer,
  submitMaster,
} = require("../lib/game-engine");
const { loadGameState, saveGameState } = require("../lib/state-store");

const HANDLERS = {
  updateAnswer: (state, payload) =>
    updateMasterAnswer(state, payload.team, payload.index, payload.answer),
  clearAnswer: (state, payload) => clearMasterAnswer(state, payload.team, payload.index),
  submit: (state, payload) => submitMaster(state, payload.team),
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
    res.status(400).json({ ok: false, error: "Unknown master action." });
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
