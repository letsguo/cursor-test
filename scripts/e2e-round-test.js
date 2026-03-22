const { io } = require("socket.io-client");

const URL = "http://localhost:3000";

const categories = ["Camping", "Karaoke", "Spicy Food", "Road Trips", "Video Games"];

const waitFor = (predicate, timeoutMs, label) =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer);
        resolve();
        return;
      }
      if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        reject(new Error(`Timed out waiting for ${label}`));
      }
    }, 25);
  });

const onceState = (socket) =>
  new Promise((resolve) => {
    socket.once("game:state", resolve);
  });

const attachStateTracker = (socket, holder) => {
  socket.on("game:state", (state) => {
    holder.current = state;
  });
};

const expect = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

async function run() {
  const host = io(URL);
  const masterA = io(URL);
  const masterB = io(URL);
  const viewer = io(URL);

  const hostState = { current: null };
  const masterAState = { current: null };
  const masterBState = { current: null };
  const viewerState = { current: null };

  attachStateTracker(host, hostState);
  attachStateTracker(masterA, masterAState);
  attachStateTracker(masterB, masterBState);
  attachStateTracker(viewer, viewerState);

  await Promise.all([
    onceState(host),
    onceState(masterA),
    onceState(masterB),
    onceState(viewer),
  ]);

  host.emit("client:setView", { role: "host" });
  masterA.emit("client:setView", { role: "master", team: "A" });
  masterB.emit("client:setView", { role: "master", team: "B" });
  viewer.emit("client:setView", { role: "host" });

  host.emit("host:startRound", { categories });
  await waitFor(
    () => hostState.current && hostState.current.phase === "active",
    3000,
    "active phase after startRound"
  );

  expect(hostState.current.categories.length === 5, "Round should have 5 categories");

  // Set bets.
  host.emit("host:setBet", { team: "A", bet: 3 });
  host.emit("host:setBet", { team: "B", bet: 4 });

  await waitFor(
    () =>
      hostState.current.teams.A.bet === 3 &&
      hostState.current.teams.B.bet === 4,
    3000,
    "bets to update"
  );

  // Team guesses.
  const guessesA = ["like", "like", "dislike", "like", "dislike"];
  const guessesB = ["dislike", "dislike", "like", "dislike", "like"];
  guessesA.forEach((guess, index) => host.emit("host:setGuess", { team: "A", index, guess }));
  guessesB.forEach((guess, index) => host.emit("host:setGuess", { team: "B", index, guess }));

  await waitFor(
    () =>
      hostState.current.teams.A.guesses.every(Boolean) &&
      hostState.current.teams.B.guesses.every(Boolean),
    3000,
    "host guesses to update"
  );

  // Master answers:
  // Team A => 3 correct vs guessesA
  // Team B => 3 correct vs guessesB
  const answersA = ["like", "dislike", "dislike", "like", "like"];
  const answersB = ["like", "dislike", "like", "dislike", "dislike"];

  answersA.forEach((answer, index) =>
    masterA.emit("master:updateAnswer", { team: "A", index, answer })
  );
  answersB.forEach((answer, index) =>
    masterB.emit("master:updateAnswer", { team: "B", index, answer })
  );

  await waitFor(
    () =>
      masterAState.current.teams.A.masterAnswers.filter(Boolean).length === categories.length &&
      masterBState.current.teams.B.masterAnswers.filter(Boolean).length === categories.length,
    3000,
    "masters to fill all answers"
  );

  masterA.emit("master:submit", { team: "A" });
  masterB.emit("master:submit", { team: "B" });

  await waitFor(
    () =>
      hostState.current.teams.A.masterSubmitted && hostState.current.teams.B.masterSubmitted,
    3000,
    "master submitted flags"
  );

  // Privacy: host should not see unrevealed answers.
  expect(
    hostState.current.teams.A.masterAnswers.every((answer) => answer === null),
    "Host should not see Team A master answers before reveal"
  );
  expect(
    hostState.current.teams.B.masterAnswers.every((answer) => answer === null),
    "Host should not see Team B master answers before reveal"
  );

  host.emit("host:lockGuesses");
  await waitFor(
    () => hostState.current.phase === "reveal",
    3000,
    "reveal phase after lock"
  );

  for (let i = 0; i < categories.length; i += 1) {
    host.emit("host:revealNext");
    await waitFor(
      () => hostState.current.revealCount === i + 1,
      3000,
      `revealCount ${i + 1}`
    );
  }

  expect(hostState.current.revealCount === categories.length, "All cards should be revealed");

  host.emit("host:submitScores");
  await waitFor(
    () => hostState.current.phase === "roundEnd",
    3000,
    "roundEnd phase after submitScores"
  );

  const finalState = hostState.current;
  const summaryA = finalState.lastRoundSummary.A;
  const summaryB = finalState.lastRoundSummary.B;

  // Expected:
  // A correct=3, tie bonus +0, bet(3) met +2 => +5 total
  // B correct=3, tie bonus +0, bet(4) failed -2 => +1 total
  expect(summaryA.correct === 3, `Expected Team A correct=3, got ${summaryA.correct}`);
  expect(summaryB.correct === 3, `Expected Team B correct=3, got ${summaryB.correct}`);
  expect(summaryA.total === 5, `Expected Team A total=5, got ${summaryA.total}`);
  expect(summaryB.total === 1, `Expected Team B total=1, got ${summaryB.total}`);
  expect(finalState.teams.A.score === 5, `Expected Team A score=5, got ${finalState.teams.A.score}`);
  expect(finalState.teams.B.score === 1, `Expected Team B score=1, got ${finalState.teams.B.score}`);

  // Viewer should also be synced to roundEnd.
  expect(
    viewerState.current.phase === "roundEnd",
    `Viewer phase should be roundEnd, got ${viewerState.current.phase}`
  );

  host.emit("host:resetForNextRound");
  await waitFor(
    () => hostState.current.phase === "setup" && hostState.current.categories.length === 0,
    3000,
    "setup phase after reset"
  );

  host.close();
  masterA.close();
  masterB.close();
  viewer.close();

  // eslint-disable-next-line no-console
  console.log("E2E round simulation passed.");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("E2E round simulation failed:", err.message);
  process.exitCode = 1;
});
