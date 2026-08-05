const AIHUB_CLIENT_IP = "124.223.56.15";
const AIHUB_ORIGIN = "https://aihub.top";
const FULLN_ORIGIN = "https://chat-gpt-fulln.vercel.app";
const OPENAI_ORIGIN = "https://api.openai.com";

function selectOrigin(request, url) {
  if (request.headers.get("CF-Connecting-IP") === AIHUB_CLIENT_IP) {
    return AIHUB_ORIGIN;
  }

  return url.pathname.includes("fulln") ? FULLN_ORIGIN : OPENAI_ORIGIN;
}

function buildUpstreamUrl(request) {
  const url = new URL(request.url);
  const origin = new URL(selectOrigin(request, url));

  url.protocol = origin.protocol;
  url.host = origin.host;

  return url;
}

export default {
  async fetch(request) {
    const upstreamRequest = new Request(buildUpstreamUrl(request), request);
    return fetch(upstreamRequest);
  },
};
