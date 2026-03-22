const socket = window.GTM.createSocket();
socket.emit("client:setView", { role: "host" });

const elements = {
  phaseBadge: document.getElementById("phaseBadge"),
  teamAScore: document.getElementById("teamAScore"),
  teamBScore: document.getElementById("teamBScore"),
  betA: document.getElementById("betA"),
  betB: document.getElementById("betB"),
  revealedA: document.getElementById("revealedA"),
  revealedB: document.getElementById("revealedB"),
  cardsGrid: document.getElementById("cardsGrid"),
};

let state = null;

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

const renderCards = () => {
  elements.cardsGrid.innerHTML = "";
  if (!state || state.categories.length === 0) {
    elements.cardsGrid.innerHTML = "<p class='help'>Round not started.</p>";
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

const render = () => {
  if (!state) {
    return;
  }

  elements.phaseBadge.textContent = `Phase: ${window.GTM.getPhaseLabel(state.phase)}`;
  elements.teamAScore.textContent = String(state.teams.A.score);
  elements.teamBScore.textContent = String(state.teams.B.score);
  elements.betA.textContent = String(state.teams.A.bet);
  elements.betB.textContent = String(state.teams.B.bet);
  elements.revealedA.textContent = String(getRevealedCorrect("A"));
  elements.revealedB.textContent = String(getRevealedCorrect("B"));
  renderCards();
};

socket.on("game:state", (nextState) => {
  state = nextState;
  render();
});
