import assert from "node:assert/strict";
import test from "node:test";

import worker from "../_worker.js";

async function captureUpstream(request, env) {
  const originalFetch = globalThis.fetch;
  let forwardedRequest;

  globalThis.fetch = async (upstreamRequest) => {
    forwardedRequest = upstreamRequest;
    return new Response(null, { status: 204 });
  };

  try {
    await worker.fetch(request, env);
    return forwardedRequest;
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

  const forwarded = await captureUpstream(request, {});

  assert.equal(
    forwarded.url,
    "https://api.aihubmix.com/v1/chat/completions?stream=true",
  );
  assert.equal(forwarded.method, "POST");
  assert.equal(forwarded.headers.get("Authorization"), "Bearer secret");
  assert.deepEqual(await forwarded.json(), { model: "gpt-4o-mini" });
});

test("allows the AIHub origin to be overridden", async () => {
  const request = new Request("https://proxy.example/v1/models", {
    headers: { "CF-Connecting-IP": "124.223.56.15" },
  });

  const forwarded = await captureUpstream(request, {
    AIHUB_ORIGIN: "https://aihub.example",
  });

  assert.equal(forwarded.url, "https://aihub.example/v1/models");
});

test("keeps the existing OpenAI route for other source IPs", async () => {
  const request = new Request("https://proxy.example/v1/models?limit=10", {
    headers: { "CF-Connecting-IP": "203.0.113.10" },
  });

  const forwarded = await captureUpstream(request, {});

  assert.equal(forwarded.url, "https://api.openai.com/v1/models?limit=10");
});

test("keeps the existing fulln route for other source IPs", async () => {
  const request = new Request("https://proxy.example/fulln/status", {
    headers: { "CF-Connecting-IP": "203.0.113.10" },
  });

  const forwarded = await captureUpstream(request, {});

  assert.equal(
    forwarded.url,
    "https://chat-gpt-fulln.vercel.app/fulln/status",
  );
});
