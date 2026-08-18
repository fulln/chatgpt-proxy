const AIHUB_CLIENT_IP = "124.223.56.15";
const AIHUB_ORIGIN = "https://aihub.top";
const PACKYAPI_CLIENT_IP = "47.121.196.163";
const PACKYAPI_ORIGIN = "https://api-slb.packyapi.com";
const PACKYAPI_PREFIX = "/packyapi";
const PACKYAPI_PATHS = new Set([
  "/v1/images/generations",
  "/v1/images/edits",
]);
const FULLN_ORIGIN = "https://chat-gpt-fulln.vercel.app";
const OPENAI_ORIGIN = "https://api.openai.com";

function packyApiPath(url) {
  if (!url.pathname.startsWith(`${PACKYAPI_PREFIX}/`)) {
    return null;
  }
  return url.pathname.slice(PACKYAPI_PREFIX.length);
}

function selectOrigin(request, url) {
  const packyPath = packyApiPath(url);
  if (
    packyPath !== null &&
    request.headers.get("CF-Connecting-IP") === PACKYAPI_CLIENT_IP &&
    PACKYAPI_PATHS.has(packyPath) &&
    request.method === "POST"
  ) {
    return PACKYAPI_ORIGIN;
  }

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
  if (origin.origin === PACKYAPI_ORIGIN) {
    url.pathname = packyApiPath(url);
  }

  return url;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const packyPath = packyApiPath(url);
    if (packyPath !== null) {
      if (request.headers.get("CF-Connecting-IP") !== PACKYAPI_CLIENT_IP) {
        return new Response("Forbidden", { status: 403 });
      }
      if (!PACKYAPI_PATHS.has(packyPath) || request.method !== "POST") {
        return new Response("Not Found", { status: 404 });
      }
    }

    const upstreamRequest = new Request(buildUpstreamUrl(request), request);
    return fetch(upstreamRequest);
  },
};
