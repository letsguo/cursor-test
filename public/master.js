const team = window.GTM.parseTeamFromUrl();

const elements = {
  badge: document.getElementById("masterTeamBadge"),
  status: document.getElementById("masterStatus"),
  error: document.getElementById("masterError"),
  cardList: document.getElementById("masterCardList"),
  submitBtn: document.getElementById("submitMasterBtn"),
};

let state = null;

if (!team) {
  elements.badge.textContent = "Invalid Team";
  elements.status.textContent = "Add ?team=A or ?team=B to this URL.";
  elements.submitBtn.disabled = true;
} else {
  elements.badge.textContent = `Team ${team}`;
}

const teamState = () => {
  if (!state || !team || !state.teams || !state.teams[team]) {
    return null;
  }
  return state.teams[team];
};

const setAnswer = (index, answer) => {
  window.GTM.masterAction("updateAnswer", { team, index, answer }).catch((error) => {
    elements.error.textContent = error.message;
  });
};

const clearAnswer = (index) => {
  window.GTM.masterAction("clearAnswer", { team, index }).catch((error) => {
    elements.error.textContent = error.message;
  });
};

const renderCards = () => {
  elements.cardList.innerHTML = "";

  if (!state || state.categories.length === 0) {
    elements.cardList.innerHTML = "<p class='help'>No active round yet.</p>";
    return;
  }

  const currentTeam = teamState();
  if (!currentTeam) {
    return;
  }

  const canEdit = state.phase === "active" && !currentTeam.masterSubmitted;

  state.categories.forEach((category, index) => {
    const selected = currentTeam.masterAnswers[index];

    const card = document.createElement("article");
    card.className = "master-card";
    card.innerHTML = `<div><strong>${index + 1}. ${category}</strong></div>`;

    const controls = document.createElement("div");
    controls.className = "controls";

    const likeBtn = document.createElement("button");
    likeBtn.textContent = "👍 Like";
    if (selected === "like") likeBtn.classList.add("selected", "like");
    likeBtn.disabled = !canEdit;
    likeBtn.addEventListener("click", () => setAnswer(index, "like"));

    const dislikeBtn = document.createElement("button");
    dislikeBtn.textContent = "👎 Dislike";
    if (selected === "dislike") dislikeBtn.classList.add("selected", "dislike");
    dislikeBtn.disabled = !canEdit;
    dislikeBtn.addEventListener("click", () => setAnswer(index, "dislike"));

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Clear";
    clearBtn.disabled = !canEdit;
    clearBtn.addEventListener("click", () => clearAnswer(index));

    controls.append(likeBtn, dislikeBtn, clearBtn);
    card.appendChild(controls);

    elements.cardList.appendChild(card);
  });
};

const render = () => {
  const currentTeam = teamState();
  if (!currentTeam) {
    return;
  }

  const phaseLabel = window.GTM.getPhaseLabel(state.phase);
  const total = state.categories.length;
  const answered = currentTeam.masterAnswers.filter(Boolean).length;

  if (state.phase === "setup") {
    elements.status.textContent = "Waiting for host to start a round...";
  } else if (state.phase === "active" && currentTeam.masterSubmitted) {
    elements.status.textContent = `Round is live. You submitted ${answered}/${total} answers. Waiting for lock/reveal.`;
  } else if (state.phase === "active") {
    elements.status.textContent = `Phase: ${phaseLabel}. Fill your answers and submit (${answered}/${total}).`;
  } else if (state.phase === "reveal") {
    elements.status.textContent = "Host locked guesses. Answers are locked for reveal.";
  } else {
    elements.status.textContent = `Phase: ${phaseLabel}. Round has ended.`;
  }

  const canSubmit = state.phase === "active" && !currentTeam.masterSubmitted;
  elements.submitBtn.disabled = !canSubmit;

  renderCards();
};

const onState = (nextState) => {
  state = nextState;
  elements.error.textContent = "";
  render();
};

elements.submitBtn.addEventListener("click", () => {
  if (!team) return;
  const currentTeam = teamState();
  if (!state || !currentTeam) {
    return;
  }
  const total = state.categories.length;
  const answered = currentTeam.masterAnswers.filter(Boolean).length;
  if (total > 0 && answered < total) {
    elements.error.textContent = `Please answer all ${total} categories before submitting.`;
    return;
  }
  window.GTM.masterAction("submit", { team }).catch((error) => {
    elements.error.textContent = error.message;
  });
});

if (team) {
  window.GTM.startPollingState("master", team, onState, (error) => {
    elements.error.textContent = error.message || "Unable to load state.";
  });
}

