const BASE_URL = process.env.GTM_BASE_URL || "http://localhost:3000";

const categories = ["Camping", "Karaoke", "Spicy Food", "Road Trips", "Video Games"];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (predicate, timeoutMs, label) => {
  const started = Date.now();
  while (Date.now() - started <= timeoutMs) {
    if (await predicate()) {
      return;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
};

const apiGet = async (path) => {
  const response = await fetch(`${BASE_URL}${path}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(data.error || `GET ${path} failed`);
  }
  return data;
};

const apiPost = async (path, body) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(data.error || `POST ${path} failed`);
  }
  return data;
};

const getState = async (role, team) => {
  const params = new URLSearchParams();
  params.set("role", role);
  if (team) {
    params.set("team", team);
  }
  return (await apiGet(`/api/state?${params.toString()}`)).state;
};

const hostAction = (action, payload = {}) => apiPost("/api/host-action", { action, payload });
const masterAction = (action, payload = {}) =>
  apiPost("/api/master-action", { action, payload });

const expect = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

async function run() {
  await hostAction("resetForNextRound");

  const initialHostState = await getState("host");
  const initialScoreA = initialHostState.teams.A.score;
  const initialScoreB = initialHostState.teams.B.score;

  await hostAction("startRound", { categories });
  await waitFor(async () => (await getState("host")).phase === "active", 5000, "active phase");

  let state = await getState("host");
  expect(state.categories.length === 5, "Round should have 5 categories");

  await hostAction("setBet", { team: "A", bet: 3 });
  await hostAction("setBet", { team: "B", bet: 4 });
  await waitFor(async () => {
    const next = await getState("host");
    return next.teams.A.bet === 3 && next.teams.B.bet === 4;
  }, 5000, "bets to update");

  const guessesA = ["like", "like", "dislike", "like", "dislike"];
  const guessesB = ["dislike", "dislike", "like", "dislike", "like"];
  for (let index = 0; index < guessesA.length; index += 1) {
    await hostAction("setGuess", { team: "A", index, guess: guessesA[index] });
    await hostAction("setGuess", { team: "B", index, guess: guessesB[index] });
  }

  await waitFor(async () => {
    const next = await getState("host");
    return next.teams.A.guesses.every(Boolean) && next.teams.B.guesses.every(Boolean);
  }, 5000, "host guesses to update");

  // Team A => 3 correct vs guessesA; Team B => 3 correct vs guessesB.
  const answersA = ["like", "dislike", "dislike", "like", "like"];
  const answersB = ["like", "dislike", "like", "dislike", "dislike"];

  for (let index = 0; index < answersA.length; index += 1) {
    await masterAction("updateAnswer", { team: "A", index, answer: answersA[index] });
    await masterAction("updateAnswer", { team: "B", index, answer: answersB[index] });
  }

  await waitFor(async () => {
    const stateA = await getState("master", "A");
    const stateB = await getState("master", "B");
    return (
      stateA.teams.A.masterAnswers.filter(Boolean).length === categories.length &&
      stateB.teams.B.masterAnswers.filter(Boolean).length === categories.length
    );
  }, 5000, "masters to fill all answers");

  await masterAction("submit", { team: "A" });
  await masterAction("submit", { team: "B" });

  await waitFor(async () => {
    const next = await getState("host");
    return next.teams.A.masterSubmitted && next.teams.B.masterSubmitted;
  }, 5000, "master submitted flags");

  const hiddenForHost = await getState("host");
  expect(
    hiddenForHost.teams.A.masterAnswers.every((answer) => answer === null),
    "Host should not see Team A answers before reveal"
  );
  expect(
    hiddenForHost.teams.B.masterAnswers.every((answer) => answer === null),
    "Host should not see Team B answers before reveal"
  );

  await hostAction("lockGuesses");
  await waitFor(async () => (await getState("host")).phase === "reveal", 5000, "reveal phase");

  for (let i = 0; i < categories.length; i += 1) {
    await hostAction("revealNext");
    await waitFor(async () => (await getState("host")).revealCount === i + 1, 5000, "reveal step");
  }

  await hostAction("submitScores");
  await waitFor(async () => (await getState("host")).phase === "roundEnd", 5000, "round end");

  state = await getState("host");
  const summaryA = state.lastRoundSummary.A;
  const summaryB = state.lastRoundSummary.B;

  expect(summaryA.correct === 3, `Expected Team A correct=3, got ${summaryA.correct}`);
  expect(summaryB.correct === 3, `Expected Team B correct=3, got ${summaryB.correct}`);
  expect(summaryA.total === 5, `Expected Team A total=5, got ${summaryA.total}`);
  expect(summaryB.total === 1, `Expected Team B total=1, got ${summaryB.total}`);
  expect(
    state.teams.A.score === initialScoreA + 5,
    `Expected Team A score delta +5, got ${state.teams.A.score - initialScoreA}`
  );
  expect(
    state.teams.B.score === initialScoreB + 1,
    `Expected Team B score delta +1, got ${state.teams.B.score - initialScoreB}`
  );

  const viewerState = await getState("viewer");
  expect(viewerState.phase === "roundEnd", `Viewer phase should be roundEnd, got ${viewerState.phase}`);

  await hostAction("resetForNextRound");
  await waitFor(async () => {
    const next = await getState("host");
    return next.phase === "setup" && next.categories.length === 0;
  }, 5000, "setup phase after reset");

  // eslint-disable-next-line no-console
  console.log("E2E round simulation passed.");
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("E2E round simulation failed:", error.message);
  process.exitCode = 1;
});
