const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const TEAM_IDS = ["A", "B"];
const ANSWERS = new Set(["like", "dislike"]);
const VIEW_ROLES = new Set(["host", "master"]);

const createTeamRoundState = () => ({
  bet: 0,
  guesses: [],
  masterAnswers: [],
  masterSubmitted: false,
});

const createInitialState = () => ({
  roundNumber: 0,
  phase: "setup",
  categories: [],
  revealCount: 0,
  currentRevealIndex: -1,
  teams: {
    A: { score: 0, ...createTeamRoundState() },
    B: { score: 0, ...createTeamRoundState() },
  },
  lastRoundSummary: null,
});

const gameState = createInitialState();
const clientViews = new Map();

const cloneState = () => JSON.parse(JSON.stringify(gameState));

const isTeam = (team) => TEAM_IDS.includes(team);

const isRoundActive = () => gameState.phase === "active";
const isRevealPhase = () => gameState.phase === "reveal";

const sanitizeCategories = (categories) => {
  if (!Array.isArray(categories)) {
    return [];
  }

  const cleaned = categories
    .map((item) => String(item || "").trim())
    .filter((item) => item.length > 0)
    .slice(0, 7);

  return cleaned;
};

const ensureRoundArrays = () => {
  const total = gameState.categories.length;

  TEAM_IDS.forEach((teamId) => {
    const teamState = gameState.teams[teamId];

    while (teamState.guesses.length < total) {
      teamState.guesses.push(null);
    }
    while (teamState.masterAnswers.length < total) {
      teamState.masterAnswers.push(null);
    }

    if (teamState.guesses.length > total) {
      teamState.guesses = teamState.guesses.slice(0, total);
    }
    if (teamState.masterAnswers.length > total) {
      teamState.masterAnswers = teamState.masterAnswers.slice(0, total);
    }
  });
};

const getCorrectCount = (teamId) => {
  const teamState = gameState.teams[teamId];
  let total = 0;

  for (let i = 0; i < gameState.categories.length; i += 1) {
    if (
      ANSWERS.has(teamState.guesses[i]) &&
      ANSWERS.has(teamState.masterAnswers[i]) &&
      teamState.guesses[i] === teamState.masterAnswers[i]
    ) {
      total += 1;
    }
  }

  return total;
};

const getRevealedCorrectCount = (teamId) => {
  const teamState = gameState.teams[teamId];
  let total = 0;

  for (
    let i = 0;
    i < Math.min(gameState.revealCount, gameState.categories.length);
    i += 1
  ) {
    if (
      ANSWERS.has(teamState.guesses[i]) &&
      ANSWERS.has(teamState.masterAnswers[i]) &&
      teamState.guesses[i] === teamState.masterAnswers[i]
    ) {
      total += 1;
    }
  }

  return total;
};

const getMaskedAnswersForReveal = (answers) =>
  answers.map((answer, index) => (index < gameState.revealCount ? answer : null));

const getStateForClient = (socket) => {
  const view = clientViews.get(socket.id) || { role: "host", team: null };
  const nextState = cloneState();

  TEAM_IDS.forEach((teamId) => {
    const isMasterOwnTeam = view.role === "master" && view.team === teamId;

    nextState.teams[teamId].masterAnswers = isMasterOwnTeam
      ? [...gameState.teams[teamId].masterAnswers]
      : getMaskedAnswersForReveal(gameState.teams[teamId].masterAnswers);
  });

  return nextState;
};

const emitStateToSocket = (socket) => {
  socket.emit("game:state", getStateForClient(socket));
};

const broadcastState = () => {
  io.sockets.sockets.forEach((socket) => {
    emitStateToSocket(socket);
  });
};

const startRound = (categories) => {
  const sanitized = sanitizeCategories(categories);
  if (sanitized.length < 5) {
    return { ok: false, error: "Use at least 5 categories." };
  }

  gameState.roundNumber += 1;
  gameState.phase = "active";
  gameState.categories = sanitized;
  gameState.revealCount = 0;
  gameState.currentRevealIndex = -1;
  gameState.lastRoundSummary = null;

  TEAM_IDS.forEach((teamId) => {
    const team = gameState.teams[teamId];
    team.bet = 0;
    team.guesses = new Array(sanitized.length).fill(null);
    team.masterAnswers = new Array(sanitized.length).fill(null);
    team.masterSubmitted = false;
  });

  return { ok: true };
};

const submitRoundScores = () => {
  const correctA = getCorrectCount("A");
  const correctB = getCorrectCount("B");

  const winnerBonusA = correctA > correctB ? 3 : 0;
  const winnerBonusB = correctB > correctA ? 3 : 0;

  const betAdjustmentA = correctA >= gameState.teams.A.bet ? 2 : -2;
  const betAdjustmentB = correctB >= gameState.teams.B.bet ? 2 : -2;

  const roundTotalA = correctA + winnerBonusA + betAdjustmentA;
  const roundTotalB = correctB + winnerBonusB + betAdjustmentB;

  gameState.teams.A.score += roundTotalA;
  gameState.teams.B.score += roundTotalB;

  gameState.phase = "roundEnd";
  gameState.revealCount = gameState.categories.length;
  gameState.currentRevealIndex = -1;

  gameState.lastRoundSummary = {
    A: {
      base: correctA,
      winnerBonus: winnerBonusA,
      betAdjustment: betAdjustmentA,
      total: roundTotalA,
      correct: correctA,
      bet: gameState.teams.A.bet,
    },
    B: {
      base: correctB,
      winnerBonus: winnerBonusB,
      betAdjustment: betAdjustmentB,
      total: roundTotalB,
      correct: correctB,
      bet: gameState.teams.B.bet,
    },
  };
};

const resetForNextRound = () => {
  gameState.phase = "setup";
  gameState.categories = [];
  gameState.revealCount = 0;
  gameState.currentRevealIndex = -1;
  gameState.lastRoundSummary = null;

  TEAM_IDS.forEach((teamId) => {
    const team = gameState.teams[teamId];
    team.bet = 0;
    team.guesses = [];
    team.masterAnswers = [];
    team.masterSubmitted = false;
  });
};

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  clientViews.set(socket.id, { role: "host", team: null });
  emitStateToSocket(socket);

  socket.on("client:setView", (payload = {}) => {
    const { role, team } = payload;
    if (!VIEW_ROLES.has(role)) {
      return;
    }
    if (role === "master" && !isTeam(team)) {
      return;
    }

    clientViews.set(socket.id, {
      role,
      team: role === "master" ? team : null,
    });
    emitStateToSocket(socket);
  });

  socket.on("host:startRound", (payload = {}) => {
    const result = startRound(payload.categories);
    if (!result.ok) {
      socket.emit("host:error", result.error);
      return;
    }
    broadcastState();
  });

  socket.on("host:setBet", (payload = {}) => {
    if (!isRoundActive()) {
      return;
    }
    const { team, bet } = payload;
    if (!isTeam(team)) {
      return;
    }

    const maxBet = gameState.categories.length;
    const nextBet = Number.isInteger(bet) ? bet : Number.parseInt(bet, 10);
    if (Number.isNaN(nextBet) || nextBet < 0 || nextBet > maxBet) {
      return;
    }

    gameState.teams[team].bet = nextBet;
    broadcastState();
  });

  socket.on("host:setGuess", (payload = {}) => {
    if (!isRoundActive()) {
      return;
    }
    const { team, index, guess } = payload;
    if (!isTeam(team)) {
      return;
    }
    if (!Number.isInteger(index) || index < 0 || index >= gameState.categories.length) {
      return;
    }
    if (guess !== null && !ANSWERS.has(guess)) {
      return;
    }

    ensureRoundArrays();
    gameState.teams[team].guesses[index] = guess;
    broadcastState();
  });

  socket.on("host:lockGuesses", () => {
    if (!isRoundActive()) {
      return;
    }
    TEAM_IDS.forEach((teamId) => {
      gameState.teams[teamId].masterSubmitted = true;
    });
    gameState.phase = "reveal";
    broadcastState();
  });

  socket.on("host:revealNext", () => {
    if (!isRevealPhase()) {
      return;
    }
    if (gameState.revealCount >= gameState.categories.length) {
      return;
    }
    gameState.currentRevealIndex = gameState.revealCount;
    gameState.revealCount += 1;
    broadcastState();
  });

  socket.on("host:revealAll", () => {
    if (!isRevealPhase()) {
      return;
    }
    gameState.currentRevealIndex = -1;
    gameState.revealCount = gameState.categories.length;
    broadcastState();
  });

  socket.on("host:submitScores", () => {
    if (!isRevealPhase()) {
      return;
    }
    submitRoundScores();
    broadcastState();
  });

  socket.on("host:resetForNextRound", () => {
    resetForNextRound();
    broadcastState();
  });

  socket.on("master:updateAnswer", (payload = {}) => {
    const { team, index, answer } = payload;
    if (!isRoundActive() || !isTeam(team)) {
      return;
    }
    if (gameState.teams[team].masterSubmitted) {
      return;
    }
    if (!Number.isInteger(index) || index < 0 || index >= gameState.categories.length) {
      return;
    }
    if (!ANSWERS.has(answer)) {
      return;
    }

    ensureRoundArrays();
    gameState.teams[team].masterAnswers[index] = answer;
    broadcastState();
  });

  socket.on("master:submit", (payload = {}) => {
    const { team } = payload;
    if (!isRoundActive() || !isTeam(team)) {
      return;
    }
    gameState.teams[team].masterSubmitted = true;
    broadcastState();
  });

  socket.on("master:clearAnswer", (payload = {}) => {
    const { team, index } = payload;
    if (!isRoundActive() || !isTeam(team)) {
      return;
    }
    if (gameState.teams[team].masterSubmitted) {
      return;
    }
    if (!Number.isInteger(index) || index < 0 || index >= gameState.categories.length) {
      return;
    }
    ensureRoundArrays();
    gameState.teams[team].masterAnswers[index] = null;
    broadcastState();
  });

  socket.on("disconnect", () => {
    clientViews.delete(socket.id);
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    phase: gameState.phase,
    round: gameState.roundNumber,
    revealCount: gameState.revealCount,
    revealedCorrectA: getRevealedCorrectCount("A"),
    revealedCorrectB: getRevealedCorrectCount("B"),
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Guess the Master running on http://localhost:${PORT}`);
});
