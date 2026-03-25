window.GTM = (() => {
  const ANSWER_EMOJI = {
    like: "👍",
    dislike: "👎",
  };

  const ANSWER_LABEL = {
    like: "Like",
    dislike: "Dislike",
  };

  const POLL_INTERVAL_MS = 1000;

  const parseTeamFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const team = params.get("team");
    return team === "A" || team === "B" ? team : null;
  };

  const getPhaseLabel = (phase) => {
    switch (phase) {
      case "setup":
        return "Setup";
      case "active":
        return "Guessing";
      case "reveal":
        return "Reveal";
      case "roundEnd":
        return "Round End";
      default:
        return phase;
    }
  };

  const answerText = (answer) => ANSWER_LABEL[answer] || "—";
  const answerEmoji = (answer) => ANSWER_EMOJI[answer] || "❓";

  const apiRequest = async (url, options = {}) => {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Request failed.");
    }
    return data;
  };

  const fetchState = async (role, team) => {
    const params = new URLSearchParams();
    params.set("role", role || "host");
    if (team) {
      params.set("team", team);
    }
    const data = await apiRequest(`/api/state?${params.toString()}`, {
      method: "GET",
    });
    return data.state;
  };

  const hostAction = async (action, payload = {}) =>
    apiRequest("/api/host-action", {
      method: "POST",
      body: JSON.stringify({ action, payload }),
    });

  const masterAction = async (action, payload = {}) =>
    apiRequest("/api/master-action", {
      method: "POST",
      body: JSON.stringify({ action, payload }),
    });

  const startPollingState = (role, team, onState, onError) => {
    let timer = null;
    let stopped = false;
    let inFlight = false;

    const tick = async () => {
      if (stopped || inFlight) {
        return;
      }
      inFlight = true;
      try {
        const state = await fetchState(role, team);
        onState(state);
      } catch (error) {
        if (onError) {
          onError(error);
        }
      } finally {
        inFlight = false;
      }
    };

    tick();
    timer = window.setInterval(tick, POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      if (timer) {
        window.clearInterval(timer);
      }
    };
  };

  return {
    parseTeamFromUrl,
    getPhaseLabel,
    answerText,
    answerEmoji,
    fetchState,
    hostAction,
    masterAction,
    startPollingState,
    ANSWER_EMOJI,
    ANSWER_LABEL,
  };
})();
