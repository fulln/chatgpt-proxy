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
        "CF-Connecting-IP": "47.121.196.163",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "gpt-image-2", n: 1 }),
    },
  );

  const forwarded = await captureUpstream(request);

  assert.equal(forwarded.url, "https://api-slb.packyapi.com/v1/images/generations");
  assert.equal(forwarded.method, "POST");
  assert.equal(forwarded.headers.get("Authorization"), "Bearer packy-secret");
  assert.deepEqual(await forwarded.json(), { model: "gpt-image-2", n: 1 });
});

test("routes only the configured server APIMart generation path", async () => {
  const request = new Request(
    "https://proxy.example/apimart/v1/images/generations",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer apimart-secret",
        "CF-Connecting-IP": "47.121.196.163",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "gpt-image-2-official", n: 1 }),
    },
  );

  const forwarded = await captureUpstream(request);

  assert.equal(forwarded.url, "https://api.apimart.ai/v1/images/generations");
  assert.equal(forwarded.method, "POST");
  assert.equal(forwarded.headers.get("Authorization"), "Bearer apimart-secret");
  assert.deepEqual(await forwarded.json(), {
    model: "gpt-image-2-official",
    n: 1,
  });
});

test("routes APIMart task polling without exposing arbitrary task paths", async () => {
  const validRequest = new Request(
    "https://proxy.example/apimart/v1/tasks/task_123-abc?language=en",
    {
      headers: { "CF-Connecting-IP": "47.121.196.163" },
    },
  );

  const forwarded = await captureUpstream(validRequest);
  assert.equal(
    forwarded.url,
    "https://api.apimart.ai/v1/tasks/task_123-abc?language=en",
  );
  assert.equal(forwarded.method, "GET");

  const invalidRequest = new Request(
    "https://proxy.example/apimart/v1/tasks/task_123-abc/private",
    {
      headers: { "CF-Connecting-IP": "47.121.196.163" },
    },
  );
  const { response, upstreamCalled } = await captureResponse(invalidRequest);
  assert.equal(response.status, 404);
  assert.equal(upstreamCalled, false);
});

test("allows the configured server to read APIMart balance for diagnostics", async () => {
  const request = new Request("https://proxy.example/apimart/v1/balance", {
    headers: {
      Authorization: "Bearer apimart-secret",
      "CF-Connecting-IP": "47.121.196.163",
    },
  });

  const forwarded = await captureUpstream(request);

  assert.equal(forwarded.url, "https://api.apimart.ai/v1/balance");
  assert.equal(forwarded.method, "GET");
});

test("rejects APIMart routes from every other source IP", async () => {
  const request = new Request(
    "https://proxy.example/apimart/v1/images/generations",
    {
      method: "POST",
      headers: { "CF-Connecting-IP": "203.0.113.10" },
    },
  );

  const { response, upstreamCalled } = await captureResponse(request);

  assert.equal(response.status, 403);
  assert.equal(upstreamCalled, false);
});

test("does not expose arbitrary APIMart upstream paths or methods", async () => {
  const invalidPath = new Request(
    "https://proxy.example/apimart/v1/models",
    {
      headers: { "CF-Connecting-IP": "47.121.196.163" },
    },
  );
  const invalidMethod = new Request(
    "https://proxy.example/apimart/v1/images/generations",
    {
      method: "DELETE",
      headers: { "CF-Connecting-IP": "47.121.196.163" },
    },
  );

  const pathResult = await captureResponse(invalidPath);
  const methodResult = await captureResponse(invalidMethod);

  assert.equal(pathResult.response.status, 404);
  assert.equal(pathResult.upstreamCalled, false);
  assert.equal(methodResult.response.status, 404);
  assert.equal(methodResult.upstreamCalled, false);
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
    headers: { "CF-Connecting-IP": "47.121.196.163" },
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
