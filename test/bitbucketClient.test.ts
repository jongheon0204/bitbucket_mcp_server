import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BitbucketClient, encodePathSegments } from "../src/bitbucketClient.js";
import type { AppConfig } from "../src/config.js";

const config: AppConfig = {
  bitbucketBaseUrl: "https://bitbucket.example.com",
  bitbucketHttpAccessToken: "test-token",
  maxFileContentBytes: 51200,
  mcpTransport: "stdio",
  bitbucketApiTimeoutMs: 5000,
  retryMaxAttempts: 3,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("BitbucketClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON and sends a Bearer auth header on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { hello: "world" }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new BitbucketClient(config);
    const result = await client.getJson("/foo");

    expect(result).toEqual({ hello: "world" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://bitbucket.example.com/rest/api/1.0/foo");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
  });

  it("maps 401 to AUTH_ERROR without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, {}));
    vi.stubGlobal("fetch", fetchMock);

    const client = new BitbucketClient(config);
    await expect(client.getJson("/foo")).rejects.toMatchObject({ code: "AUTH_ERROR" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps 404 to NOT_FOUND without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(404, {}));
    vi.stubGlobal("fetch", fetchMock);

    const client = new BitbucketClient(config);
    await expect(client.getJson("/foo")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries 429 with exponential backoff and fails with RATE_LIMITED once attempts are exhausted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(429, {}));
    vi.stubGlobal("fetch", fetchMock);

    const client = new BitbucketClient(config);
    const promise = client.getJson("/foo");
    const assertion = expect(promise).rejects.toMatchObject({ code: "RATE_LIMITED" });

    await vi.runAllTimersAsync();
    await assertion;

    // initial attempt + retryMaxAttempts (3) retries = 4 calls total
    expect(fetchMock).toHaveBeenCalledTimes(1 + config.retryMaxAttempts);
  });

  it("succeeds after a transient 429", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, {}))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new BitbucketClient(config);
    const promise = client.getJson("/foo");
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries 5xx up to a fixed 2 attempts then fails with UPSTREAM_ERROR", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(503, {}));
    vi.stubGlobal("fetch", fetchMock);

    const client = new BitbucketClient(config);
    const promise = client.getJson("/foo");
    const assertion = expect(promise).rejects.toMatchObject({ code: "UPSTREAM_ERROR" });

    await vi.runAllTimersAsync();
    await assertion;

    // initial attempt + 2 retries = 3 calls total, regardless of retryMaxAttempts
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("sends a JSON body and Content-Type on POST", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { id: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new BitbucketClient(config);
    await client.postJson("/comments", { text: "hi" });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ text: "hi" }));
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });
});

describe("encodePathSegments", () => {
  it("encodes each path segment individually while preserving slashes", () => {
    expect(encodePathSegments("src/my file.ts")).toBe("src/my%20file.ts");
    expect(encodePathSegments("a/b/c.ts")).toBe("a/b/c.ts");
  });
});
