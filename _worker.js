const AIHUB_CLIENT_IP = "124.223.56.15";
const DEFAULT_AIHUB_ORIGIN = "https://api.aihubmix.com";
const FULLN_ORIGIN = "https://chat-gpt-fulln.vercel.app";
const OPENAI_ORIGIN = "https://api.openai.com";

function selectOrigin(request, env, url) {
  if (request.headers.get("CF-Connecting-IP") === AIHUB_CLIENT_IP) {
    return env.AIHUB_ORIGIN || DEFAULT_AIHUB_ORIGIN;
  }

  return url.pathname.includes("fulln") ? FULLN_ORIGIN : OPENAI_ORIGIN;
}

function buildUpstreamUrl(request, env) {
  const url = new URL(request.url);
  const origin = new URL(selectOrigin(request, env, url));

  url.protocol = origin.protocol;
  url.host = origin.host;

  return url;
}

export default {
  async fetch(request, env = {}) {
    const upstreamRequest = new Request(buildUpstreamUrl(request, env), request);
    return fetch(upstreamRequest);
  },
};
