const { normalizeRole, isTeam, getStateForRole } = require("../lib/game-engine");
const { loadGameState } = require("../lib/state-store");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed." });
    return;
  }

  const role = normalizeRole(req.query.role);
  const team = isTeam(req.query.team) ? req.query.team : null;

  const state = await loadGameState();
  const view = getStateForRole(state, role, team);

  res.status(200).json({ ok: true, state: view });
};
