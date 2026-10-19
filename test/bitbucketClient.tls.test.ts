import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:https";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { BitbucketClient } from "../src/bitbucketClient.js";
import type { AppConfig } from "../src/config.js";

// Real HTTPS round-trips against a self-signed server (stands in for a corporate CA
// that Node doesn't trust), so this file deliberately doesn't stub fetch.
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer(
    { key: fixture("self-signed-key.pem"), cert: fixture("self-signed-cert.pem") },
    (_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    }
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `https://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

function makeConfig(bitbucketTlsRejectUnauthorized: boolean): AppConfig {
  return {
    bitbucketBaseUrl: baseUrl,
    bitbucketHttpAccessToken: "t",
    maxFileContentBytes: 51200,
    mcpTransport: "stdio",
    bitbucketApiTimeoutMs: 5000,
    retryMaxAttempts: 0,
    bitbucketTlsRejectUnauthorized,
  };
}

describe("BitbucketClient TLS verification", () => {
  it("rejects a self-signed certificate by default", async () => {
    const client = new BitbucketClient(makeConfig(true));
    await expect(client.getJson("/foo")).rejects.toMatchObject({ code: "UPSTREAM_ERROR" });
  }, 15000);

  it("accepts a self-signed certificate when BITBUCKET_TLS_REJECT_UNAUTHORIZED=false", async () => {
    const client = new BitbucketClient(makeConfig(false));
    await expect(client.getJson("/foo")).resolves.toEqual({ ok: true });
  });

  it("does not disable verification for other fetch calls in the process", async () => {
    new BitbucketClient(makeConfig(false));
    await expect(fetch(`${baseUrl}/foo`)).rejects.toThrow();
  });
});
