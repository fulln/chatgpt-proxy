const AIHUB_CLIENT_IP = "124.223.56.15";
const AIHUB_ORIGIN = "https://aihub.top";
const PACKYAPI_CLIENT_IP = "47.121.196.163";
const PACKYAPI_ORIGIN = "https://api-slb.packyapi.com";
const PACKYAPI_PREFIX = "/packyapi";
const PACKYAPI_PATHS = new Set([
  "/v1/images/generations",
  "/v1/images/edits",
]);
const APIMART_CLIENT_IP = "47.121.196.163";
const APIMART_ORIGIN = "https://api.apimart.ai";
const APIMART_PREFIX = "/apimart";
const APIMART_POST_PATHS = new Set([
  "/v1/uploads/images",
  "/v1/images/generations",
]);
const APIMART_GET_PATHS = new Set(["/v1/balance"]);
const APIMART_TASK_PATH = /^\/v1\/tasks\/[A-Za-z0-9_-]{1,128}$/;
const FULLN_ORIGIN = "https://chat-gpt-fulln.vercel.app";
const OPENAI_ORIGIN = "https://api.openai.com";
const B_AI_ORIGIN = "https://api.b.ai";
const B_AI_PREFIX = "/bai";

function packyApiPath(url) {
  if (!url.pathname.startsWith(`${PACKYAPI_PREFIX}/`)) {
    return null;
  }
  return url.pathname.slice(PACKYAPI_PREFIX.length);
}

function apimartPath(url) {
  if (!url.pathname.startsWith(`${APIMART_PREFIX}/`)) {
    return null;
  }
  return url.pathname.slice(APIMART_PREFIX.length);
}

function bAiPath(url) {
  if (!url.pathname.startsWith(`${B_AI_PREFIX}/`)) {
    return null;
  }
  return url.pathname.slice(B_AI_PREFIX.length);
}

function isAllowedApimartRequest(request, path) {
  if (request.method === "POST") {
    return APIMART_POST_PATHS.has(path);
  }
  if (request.method === "GET") {
    return APIMART_GET_PATHS.has(path) || APIMART_TASK_PATH.test(path);
  }
  return false;
}

function selectOrigin(request, url) {
  const apimartRoute = apimartPath(url);
  if (
    apimartRoute !== null &&
    request.headers.get("CF-Connecting-IP") === APIMART_CLIENT_IP &&
    isAllowedApimartRequest(request, apimartRoute)
  ) {
    return APIMART_ORIGIN;
  }

  const packyPath = packyApiPath(url);
  if (
    packyPath !== null &&
    request.headers.get("CF-Connecting-IP") === PACKYAPI_CLIENT_IP &&
    PACKYAPI_PATHS.has(packyPath) &&
    request.method === "POST"
  ) {
    return PACKYAPI_ORIGIN;
  }

  // 来自 aihub 来源 IP 且路径带 /bai / 前缀时，优先转发到 api.b.ai
  const bAiRoute = bAiPath(url);
  if (
    bAiRoute !== null &&
    request.headers.get("CF-Connecting-IP") === AIHUB_CLIENT_IP
  ) {
    return B_AI_ORIGIN;
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
  } else if (origin.origin === APIMART_ORIGIN) {
    url.pathname = apimartPath(url);
  } else if (origin.origin === B_AI_ORIGIN) {
    url.pathname = bAiPath(url);
  }

  return url;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const apimartRoute = apimartPath(url);
    if (apimartRoute !== null) {
      if (request.headers.get("CF-Connecting-IP") !== APIMART_CLIENT_IP) {
        return new Response("Forbidden", { status: 403 });
      }
      if (!isAllowedApimartRequest(request, apimartRoute)) {
        return new Response("Not Found", { status: 404 });
      }
    }

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
