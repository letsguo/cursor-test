const TEAM_IDS = ["A", "B"];
const ANSWERS = new Set(["like", "dislike"]);
const VIEW_ROLES = new Set(["host", "master", "viewer"]);

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

const cloneState = (state) => JSON.parse(JSON.stringify(state));

const isTeam = (team) => TEAM_IDS.includes(team);
const isRoundActive = (state) => state.phase === "active";
const isRevealPhase = (state) => state.phase === "reveal";

const sanitizeCategories = (categories) => {
  if (!Array.isArray(categories)) {
    return [];
  }
  return categories
    .map((item) => String(item || "").trim())
    .filter((item) => item.length > 0)
    .slice(0, 7);
};

const ensureRoundArrays = (state) => {
  const total = state.categories.length;

  TEAM_IDS.forEach((teamId) => {
    const teamState = state.teams[teamId];

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

const getCorrectCount = (state, teamId) => {
  const teamState = state.teams[teamId];
  let total = 0;
  for (let i = 0; i < state.categories.length; i += 1) {
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

const getRevealedCorrectCount = (state, teamId) => {
  const teamState = state.teams[teamId];
  let total = 0;
  const limit = Math.min(state.revealCount, state.categories.length);
  for (let i = 0; i < limit; i += 1) {
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

const getMaskedAnswersForReveal = (state, answers) =>
  answers.map((answer, index) => (index < state.revealCount ? answer : null));

const hasCompleteMasterAnswers = (state, teamId) => {
  const answers = state.teams[teamId].masterAnswers;
  if (answers.length !== state.categories.length) {
    return false;
  }
  return answers.every((answer) => ANSWERS.has(answer));
};

const getStateForRole = (state, role, team) => {
  const nextState = cloneState(state);
  TEAM_IDS.forEach((teamId) => {
    const isMasterOwnTeam = role === "master" && team === teamId;
    nextState.teams[teamId].masterAnswers = isMasterOwnTeam
      ? [...state.teams[teamId].masterAnswers]
      : getMaskedAnswersForReveal(state, state.teams[teamId].masterAnswers);
  });
  return nextState;
};

const normalizeRole = (role) => (VIEW_ROLES.has(role) ? role : "host");

const startRound = (state, categories) => {
  const sanitized = sanitizeCategories(categories);
  if (sanitized.length < 5) {
    return { ok: false, error: "Use at least 5 categories." };
  }

  state.roundNumber += 1;
  state.phase = "active";
  state.categories = sanitized;
  state.revealCount = 0;
  state.currentRevealIndex = -1;
  state.lastRoundSummary = null;

  TEAM_IDS.forEach((teamId) => {
    const teamState = state.teams[teamId];
    teamState.bet = 0;
    teamState.guesses = new Array(sanitized.length).fill(null);
    teamState.masterAnswers = new Array(sanitized.length).fill(null);
    teamState.masterSubmitted = false;
  });

  return { ok: true };
};

const setBet = (state, team, bet) => {
  if (!isRoundActive(state)) {
    return { ok: false, error: "Round is not active." };
  }
  if (!isTeam(team)) {
    return { ok: false, error: "Invalid team." };
  }
  const maxBet = state.categories.length;
  const nextBet = Number.isInteger(bet) ? bet : Number.parseInt(bet, 10);
  if (Number.isNaN(nextBet) || nextBet < 0 || nextBet > maxBet) {
    return { ok: false, error: "Bet must be within range." };
  }
  state.teams[team].bet = nextBet;
  return { ok: true };
};

const setGuess = (state, team, index, guess) => {
  if (!isRoundActive(state)) {
    return { ok: false, error: "Round is not active." };
  }
  if (!isTeam(team)) {
    return { ok: false, error: "Invalid team." };
  }
  if (!Number.isInteger(index) || index < 0 || index >= state.categories.length) {
    return { ok: false, error: "Invalid category index." };
  }
  if (guess !== null && !ANSWERS.has(guess)) {
    return { ok: false, error: "Invalid guess value." };
  }
  ensureRoundArrays(state);
  state.teams[team].guesses[index] = guess;
  return { ok: true };
};

const lockGuesses = (state) => {
  if (!isRoundActive(state)) {
    return { ok: false, error: "Round is not active." };
  }
  TEAM_IDS.forEach((teamId) => {
    state.teams[teamId].masterSubmitted = true;
  });
  state.phase = "reveal";
  return { ok: true };
};

const revealNext = (state) => {
  if (!isRevealPhase(state)) {
    return { ok: false, error: "Round is not in reveal phase." };
  }
  if (state.revealCount >= state.categories.length) {
    return { ok: false, error: "All cards are already revealed." };
  }
  state.currentRevealIndex = state.revealCount;
  state.revealCount += 1;
  return { ok: true };
};

const revealAll = (state) => {
  if (!isRevealPhase(state)) {
    return { ok: false, error: "Round is not in reveal phase." };
  }
  state.currentRevealIndex = -1;
  state.revealCount = state.categories.length;
  return { ok: true };
};

const submitScores = (state) => {
  if (!isRevealPhase(state)) {
    return { ok: false, error: "Round is not in reveal phase." };
  }
  if (state.revealCount < state.categories.length) {
    return { ok: false, error: "Reveal all cards before submitting scores." };
  }

  const correctA = getCorrectCount(state, "A");
  const correctB = getCorrectCount(state, "B");
  const winnerBonusA = correctA > correctB ? 3 : 0;
  const winnerBonusB = correctB > correctA ? 3 : 0;
  const betAdjustmentA = correctA >= state.teams.A.bet ? 2 : -2;
  const betAdjustmentB = correctB >= state.teams.B.bet ? 2 : -2;
  const roundTotalA = correctA + winnerBonusA + betAdjustmentA;
  const roundTotalB = correctB + winnerBonusB + betAdjustmentB;

  state.teams.A.score += roundTotalA;
  state.teams.B.score += roundTotalB;
  state.phase = "roundEnd";
  state.revealCount = state.categories.length;
  state.currentRevealIndex = -1;
  state.lastRoundSummary = {
    A: {
      base: correctA,
      winnerBonus: winnerBonusA,
      betAdjustment: betAdjustmentA,
      total: roundTotalA,
      correct: correctA,
      bet: state.teams.A.bet,
    },
    B: {
      base: correctB,
      winnerBonus: winnerBonusB,
      betAdjustment: betAdjustmentB,
      total: roundTotalB,
      correct: correctB,
      bet: state.teams.B.bet,
    },
  };
  return { ok: true };
};

const resetForNextRound = (state) => {
  state.phase = "setup";
  state.categories = [];
  state.revealCount = 0;
  state.currentRevealIndex = -1;
  state.lastRoundSummary = null;
  TEAM_IDS.forEach((teamId) => {
    const teamState = state.teams[teamId];
    teamState.bet = 0;
    teamState.guesses = [];
    teamState.masterAnswers = [];
    teamState.masterSubmitted = false;
  });
  return { ok: true };
};

const updateMasterAnswer = (state, team, index, answer) => {
  if (!isRoundActive(state)) {
    return { ok: false, error: "Round is not active." };
  }
  if (!isTeam(team)) {
    return { ok: false, error: "Invalid team." };
  }
  if (state.teams[team].masterSubmitted) {
    return { ok: false, error: "Answers are already submitted/locked." };
  }
  if (!Number.isInteger(index) || index < 0 || index >= state.categories.length) {
    return { ok: false, error: "Invalid category index." };
  }
  if (!ANSWERS.has(answer)) {
    return { ok: false, error: "Invalid answer value." };
  }

  ensureRoundArrays(state);
  state.teams[team].masterAnswers[index] = answer;
  return { ok: true };
};

const clearMasterAnswer = (state, team, index) => {
  if (!isRoundActive(state)) {
    return { ok: false, error: "Round is not active." };
  }
  if (!isTeam(team)) {
    return { ok: false, error: "Invalid team." };
  }
  if (state.teams[team].masterSubmitted) {
    return { ok: false, error: "Answers are already submitted/locked." };
  }
  if (!Number.isInteger(index) || index < 0 || index >= state.categories.length) {
    return { ok: false, error: "Invalid category index." };
  }
  ensureRoundArrays(state);
  state.teams[team].masterAnswers[index] = null;
  return { ok: true };
};

const submitMaster = (state, team) => {
  if (!isRoundActive(state)) {
    return { ok: false, error: "Round is not active." };
  }
  if (!isTeam(team)) {
    return { ok: false, error: "Invalid team." };
  }
  ensureRoundArrays(state);
  if (!hasCompleteMasterAnswers(state, team)) {
    return { ok: false, error: "Answer every category before submitting." };
  }
  state.teams[team].masterSubmitted = true;
  return { ok: true };
};

module.exports = {
  ANSWERS,
  TEAM_IDS,
  VIEW_ROLES,
  createInitialState,
  cloneState,
  isTeam,
  normalizeRole,
  getStateForRole,
  getRevealedCorrectCount,
  startRound,
  setBet,
  setGuess,
  lockGuesses,
  revealNext,
  revealAll,
  submitScores,
  resetForNextRound,
  updateMasterAnswer,
  clearMasterAnswer,
  submitMaster,
};
