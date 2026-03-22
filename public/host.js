const socket = window.GTM.createSocket();
socket.emit("client:setView", { role: "host" });

const elements = {
  phaseBadge: document.getElementById("phaseBadge"),
  socketUrlInput: document.getElementById("socketUrlInput"),
  saveSocketUrlBtn: document.getElementById("saveSocketUrlBtn"),
  clearSocketUrlBtn: document.getElementById("clearSocketUrlBtn"),
  categoriesInput: document.getElementById("categoriesInput"),
  startRoundBtn: document.getElementById("startRoundBtn"),
  hostError: document.getElementById("hostError"),
  teamAScore: document.getElementById("teamAScore"),
  teamBScore: document.getElementById("teamBScore"),
  betA: document.getElementById("betA"),
  betB: document.getElementById("betB"),
  revealedA: document.getElementById("revealedA"),
  revealedB: document.getElementById("revealedB"),
  lockBtn: document.getElementById("lockBtn"),
  revealNextBtn: document.getElementById("revealNextBtn"),
  revealAllBtn: document.getElementById("revealAllBtn"),
  submitScoresBtn: document.getElementById("submitScoresBtn"),
  resetRoundBtn: document.getElementById("resetRoundBtn"),
  cardsGrid: document.getElementById("cardsGrid"),
  guessTables: document.getElementById("guessTables"),
  roundSummaryPanel: document.getElementById("roundSummaryPanel"),
  roundSummary: document.getElementById("roundSummary"),
  masterALink: document.getElementById("masterALink"),
  masterBLink: document.getElementById("masterBLink"),
  viewerLink: document.getElementById("viewerLink"),
};

let state = null;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const categoriesFromInput = () =>
  elements.categoriesInput.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const getRevealedCorrect = (teamId) => {
  if (!state) {
    return 0;
  }
  const team = state.teams[teamId];
  const limit = Math.min(state.revealCount, state.categories.length);
  let total = 0;
  for (let i = 0; i < limit; i += 1) {
    if (
      team.guesses[i] &&
      team.masterAnswers[i] &&
      team.guesses[i] === team.masterAnswers[i]
    ) {
      total += 1;
    }
  }
  return total;
};

const setGuess = (team, index, guess) => {
  socket.emit("host:setGuess", { team, index, guess });
};

const renderGuessTable = (teamId) => {
  const container = document.createElement("article");
  container.className = "guess-table";

  state.categories.forEach((category, index) => {
    const row = document.createElement("div");
    row.className = "guess-row";

    const label = document.createElement("div");
    const guess = state.teams[teamId].guesses[index];
    label.innerHTML = `<strong>${index + 1}. ${category}</strong><br/><small>Guess: ${window.GTM.answerText(
      guess
    )}</small>`;

    const controls = document.createElement("div");
    controls.className = "guess-controls";

    const likeBtn = document.createElement("button");
    likeBtn.textContent = "👍";
    if (guess === "like") likeBtn.classList.add("selected", "like");
    likeBtn.addEventListener("click", () => setGuess(teamId, index, "like"));

    const dislikeBtn = document.createElement("button");
    dislikeBtn.textContent = "👎";
    if (guess === "dislike") dislikeBtn.classList.add("selected", "dislike");
    dislikeBtn.addEventListener("click", () =>
      setGuess(teamId, index, "dislike")
    );

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "×";
    clearBtn.addEventListener("click", () => setGuess(teamId, index, null));

    const isDisabled = state.phase !== "active";
    likeBtn.disabled = isDisabled;
    dislikeBtn.disabled = isDisabled;
    clearBtn.disabled = isDisabled;

    controls.append(likeBtn, dislikeBtn, clearBtn);
    row.append(label, controls);
    container.appendChild(row);
  });

  return container;
};

const renderGuessTables = () => {
  elements.guessTables.innerHTML = "";
  if (!state || state.categories.length === 0) {
    elements.guessTables.innerHTML = "<p class='help'>No active round.</p>";
    return;
  }

  const colA = document.createElement("section");
  colA.innerHTML = "<h3>Team A Guesses</h3>";
  colA.appendChild(renderGuessTable("A"));

  const colB = document.createElement("section");
  colB.innerHTML = "<h3>Team B Guesses</h3>";
  colB.appendChild(renderGuessTable("B"));

  elements.guessTables.append(colA, colB);
};

const renderCards = () => {
  elements.cardsGrid.innerHTML = "";
  if (!state || state.categories.length === 0) {
    elements.cardsGrid.innerHTML = "<p class='help'>Start a round to show cards.</p>";
    return;
  }

  state.categories.forEach((category, index) => {
    const card = document.createElement("article");
    card.className = "card";
    if (state.currentRevealIndex === index) {
      card.classList.add("active");
    }

    const isRevealed = index < state.revealCount;
    const answerA = state.teams.A.masterAnswers[index];
    const answerB = state.teams.B.masterAnswers[index];

    card.innerHTML = `
      <div class="card-title">${index + 1}. ${category}</div>
      <div class="card-answer ${isRevealed ? "" : "hidden"}">
        Team A Master: ${
          isRevealed ? `${window.GTM.answerEmoji(answerA)} ${window.GTM.answerText(answerA)}` : "Hidden"
        }
      </div>
      <div class="card-answer ${isRevealed ? "" : "hidden"}">
        Team B Master: ${
          isRevealed ? `${window.GTM.answerEmoji(answerB)} ${window.GTM.answerText(answerB)}` : "Hidden"
        }
      </div>
    `;

    elements.cardsGrid.appendChild(card);
  });
};

const renderSummary = () => {
  if (!state.lastRoundSummary) {
    elements.roundSummaryPanel.classList.add("hidden");
    return;
  }

  const a = state.lastRoundSummary.A;
  const b = state.lastRoundSummary.B;

  elements.roundSummaryPanel.classList.remove("hidden");
  elements.roundSummary.textContent = [
    "Team A",
    `  Correct: ${a.correct}`,
    `  Base: +${a.base}`,
    `  Winner bonus: ${a.winnerBonus >= 0 ? "+" : ""}${a.winnerBonus}`,
    `  Bet (${a.bet}): ${a.betAdjustment >= 0 ? "+" : ""}${a.betAdjustment}`,
    `  Round total: ${a.total >= 0 ? "+" : ""}${a.total}`,
    "",
    "Team B",
    `  Correct: ${b.correct}`,
    `  Base: +${b.base}`,
    `  Winner bonus: ${b.winnerBonus >= 0 ? "+" : ""}${b.winnerBonus}`,
    `  Bet (${b.bet}): ${b.betAdjustment >= 0 ? "+" : ""}${b.betAdjustment}`,
    `  Round total: ${b.total >= 0 ? "+" : ""}${b.total}`,
  ].join("\n");
};

const render = () => {
  if (!state) {
    return;
  }

  elements.phaseBadge.textContent = `Phase: ${window.GTM.getPhaseLabel(state.phase)}`;

  elements.teamAScore.textContent = state.teams.A.score;
  elements.teamBScore.textContent = state.teams.B.score;

  elements.betA.max = String(state.categories.length || 0);
  elements.betB.max = String(state.categories.length || 0);
  elements.betA.value = state.teams.A.bet;
  elements.betB.value = state.teams.B.bet;

  elements.revealedA.textContent = String(getRevealedCorrect("A"));
  elements.revealedB.textContent = String(getRevealedCorrect("B"));

  const isActive = state.phase === "active";
  const isReveal = state.phase === "reveal";
  const revealComplete = state.revealCount >= state.categories.length;

  elements.lockBtn.disabled = !isActive;
  elements.revealNextBtn.disabled =
    !isReveal || state.revealCount >= state.categories.length;
  elements.revealAllBtn.disabled = !isReveal;
  elements.submitScoresBtn.disabled = !isReveal || !revealComplete;
  elements.betA.disabled = !isActive;
  elements.betB.disabled = !isActive;

  renderCards();
  renderGuessTables();
  renderSummary();
};

socket.on("game:state", (nextState) => {
  state = nextState;
  elements.hostError.textContent = "";
  render();
});

socket.on("host:error", (message) => {
  elements.hostError.textContent = message || "Unable to perform that action.";
});

const refreshSocketControls = () => {
  const current = window.GTM.getSocketUrl();
  elements.socketUrlInput.value = current;
  const socketQuery = current ? `socketUrl=${encodeURIComponent(current)}` : "";
  const teamAQuery = socketQuery ? `?team=A&${socketQuery}` : "?team=A";
  const teamBQuery = socketQuery ? `?team=B&${socketQuery}` : "?team=B";
  const viewerQuery = socketQuery ? `?${socketQuery}` : "";
  elements.masterALink.href = `/master.html${teamAQuery}`;
  elements.masterBLink.href = `/master.html${teamBQuery}`;
  elements.viewerLink.href = `/viewer.html${viewerQuery}`;
};

elements.saveSocketUrlBtn.addEventListener("click", () => {
  window.GTM.setSocketUrl(elements.socketUrlInput.value);
  window.location.reload();
});

elements.clearSocketUrlBtn.addEventListener("click", () => {
  window.GTM.setSocketUrl("");
  window.location.reload();
});

elements.startRoundBtn.addEventListener("click", () => {
  socket.emit("host:startRound", { categories: categoriesFromInput() });
});

elements.lockBtn.addEventListener("click", () => {
  socket.emit("host:lockGuesses");
});

elements.revealNextBtn.addEventListener("click", () => {
  socket.emit("host:revealNext");
});

elements.revealAllBtn.addEventListener("click", () => {
  socket.emit("host:revealAll");
});

elements.submitScoresBtn.addEventListener("click", () => {
  socket.emit("host:submitScores");
});

elements.resetRoundBtn.addEventListener("click", () => {
  socket.emit("host:resetForNextRound");
});

elements.betA.addEventListener("change", () => {
  if (!state) {
    return;
  }
  const max = state.categories.length || 0;
  const nextBet = clamp(Number.parseInt(elements.betA.value, 10) || 0, 0, max);
  elements.betA.value = String(nextBet);
  socket.emit("host:setBet", {
    team: "A",
    bet: nextBet,
  });
});

elements.betB.addEventListener("change", () => {
  if (!state) {
    return;
  }
  const max = state.categories.length || 0;
  const nextBet = clamp(Number.parseInt(elements.betB.value, 10) || 0, 0, max);
  elements.betB.value = String(nextBet);
  socket.emit("host:setBet", {
    team: "B",
    bet: nextBet,
  });
});

refreshSocketControls();
