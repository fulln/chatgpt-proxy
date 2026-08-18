import assert from "node:assert/strict";
import test from "node:test";

import worker from "../_worker.js";

async function captureUpstream(request) {
  const originalFetch = globalThis.fetch;
  let forwardedRequest;

  globalThis.fetch = async (upstreamRequest) => {
    forwardedRequest = upstreamRequest;
    return new Response(null, { status: 204 });
  };

  try {
    await worker.fetch(request);
    return forwardedRequest;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function captureResponse(request) {
  const originalFetch = globalThis.fetch;
  let upstreamCalled = false;

  globalThis.fetch = async () => {
    upstreamCalled = true;
    return new Response(null, { status: 204 });
  };

  try {
    return { response: await worker.fetch(request), upstreamCalled };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("routes requests from the configured server IP to AIHub", async () => {
  const request = new Request("https://proxy.example/v1/chat/completions?stream=true", {
    method: "POST",
    headers: {
      Authorization: "Bearer secret",
      "CF-Connecting-IP": "124.223.56.15",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "gpt-4o-mini" }),
  });

  const forwarded = await captureUpstream(request);

  assert.equal(
    forwarded.url,
    "https://aihub.top/v1/chat/completions?stream=true",
  );
  assert.equal(forwarded.method, "POST");
  assert.equal(forwarded.headers.get("Authorization"), "Bearer secret");
  assert.deepEqual(await forwarded.json(), { model: "gpt-4o-mini" });
});

test("routes only the configured server PackyAPI generation path", async () => {
  const request = new Request(
    "https://proxy.example/packyapi/v1/images/generations",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer packy-secret",
        "CF-Connecting-IP": "124.223.56.15",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "gpt-image-2", n: 1 }),
    },
  );

  const forwarded = await captureUpstream(request);

  assert.equal(forwarded.url, "https://www.packyapi.com/v1/images/generations");
  assert.equal(forwarded.method, "POST");
  assert.equal(forwarded.headers.get("Authorization"), "Bearer packy-secret");
  assert.deepEqual(await forwarded.json(), { model: "gpt-image-2", n: 1 });
});

test("rejects PackyAPI routes from every other source IP", async () => {
  const request = new Request(
    "https://proxy.example/packyapi/v1/images/generations",
    {
      method: "POST",
      headers: { "CF-Connecting-IP": "203.0.113.10" },
    },
  );

  const { response, upstreamCalled } = await captureResponse(request);

  assert.equal(response.status, 403);
  assert.equal(upstreamCalled, false);
});

test("does not expose arbitrary PackyAPI upstream paths", async () => {
  const request = new Request("https://proxy.example/packyapi/v1/models", {
    headers: { "CF-Connecting-IP": "124.223.56.15" },
  });

  const { response, upstreamCalled } = await captureResponse(request);

  assert.equal(response.status, 404);
  assert.equal(upstreamCalled, false);
});

test("keeps the existing OpenAI route for other source IPs", async () => {
  const request = new Request("https://proxy.example/v1/models?limit=10", {
    headers: { "CF-Connecting-IP": "203.0.113.10" },
  });

  const forwarded = await captureUpstream(request);

  assert.equal(forwarded.url, "https://api.openai.com/v1/models?limit=10");
});

test("keeps the existing fulln route for other source IPs", async () => {
  const request = new Request("https://proxy.example/fulln/status", {
    headers: { "CF-Connecting-IP": "203.0.113.10" },
  });

  const forwarded = await captureUpstream(request);

  assert.equal(
    forwarded.url,
    "https://chat-gpt-fulln.vercel.app/fulln/status",
  );
});
