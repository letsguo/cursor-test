window.GTM = (() => {
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
    parseTeamFromUrl,
    getPhaseLabel,
    answerText,
    answerEmoji,
    ANSWER_EMOJI,
    ANSWER_LABEL,
  };
})();
