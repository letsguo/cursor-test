window.GTM = (() => {
  const normalizeSocketUrl = (value) => {
    if (!value) {
      return "";
    }
    const trimmed = String(value).trim();
    return trimmed.replace(/\/+$/, "");
  };

  const getSocketUrlFromQuery = () => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("socketUrl");
    if (!fromQuery || !String(fromQuery).trim()) {
      return "";
    }
    return normalizeSocketUrl(fromQuery);
  };

  const getSocketUrl = () => {
    const fromQuery = getSocketUrlFromQuery();
    if (fromQuery) {
      window.localStorage.setItem("gtm:socketUrl", fromQuery);
      return fromQuery;
    }
    const fromWindow = window.__GTM_SOCKET_URL__;
    if (fromWindow && String(fromWindow).trim()) {
      return normalizeSocketUrl(fromWindow);
    }
    const fromStorage = window.localStorage.getItem("gtm:socketUrl");
    if (fromStorage && String(fromStorage).trim()) {
      return normalizeSocketUrl(fromStorage);
    }
    return "";
  };

  const setSocketUrl = (nextValue) => {
    const normalized = normalizeSocketUrl(nextValue);
    if (!normalized) {
      window.localStorage.removeItem("gtm:socketUrl");
      return;
    }
    window.localStorage.setItem("gtm:socketUrl", normalized);
  };

  const createSocket = () => {
    const socketUrl = getSocketUrl();
    const options = {
      transports: ["websocket", "polling"],
      withCredentials: false,
    };
    return socketUrl ? io(socketUrl, options) : io(options);
  };

  const ANSWER_EMOJI = {
    like: "👍",
    dislike: "👎",
  };

  const ANSWER_LABEL = {
    like: "Like",
    dislike: "Dislike",
  };

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

  return {
    createSocket,
    getSocketUrl,
    getSocketUrlFromQuery,
    setSocketUrl,
    parseTeamFromUrl,
    getPhaseLabel,
    answerText,
    answerEmoji,
    ANSWER_EMOJI,
    ANSWER_LABEL,
  };
})();
