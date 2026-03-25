const { Redis } = require("@upstash/redis");
const { createInitialState, cloneState } = require("./game-engine");

const GAME_STATE_KEY = "gtm:game-state:v1";

const hasUpstashEnv = () =>
  Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

let redisClient = null;
if (hasUpstashEnv()) {
  redisClient = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

let inMemoryState = createInitialState();

const loadGameState = async () => {
  if (!redisClient) {
    return cloneState(inMemoryState);
  }

  const stored = await redisClient.get(GAME_STATE_KEY);
  if (!stored) {
    const fresh = createInitialState();
    await redisClient.set(GAME_STATE_KEY, fresh);
    return fresh;
  }
  return stored;
};

const saveGameState = async (nextState) => {
  if (!redisClient) {
    inMemoryState = cloneState(nextState);
    return;
  }
  await redisClient.set(GAME_STATE_KEY, nextState);
};

module.exports = {
  hasUpstashEnv,
  loadGameState,
  saveGameState,
};
