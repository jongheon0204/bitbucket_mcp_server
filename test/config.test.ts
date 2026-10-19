import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config.js";

const base = {
  BITBUCKET_BASE_URL: "https://bitbucket.example.com/",
  BITBUCKET_HTTP_ACCESS_TOKEN: "t",
};

describe("loadConfig", () => {
  it("defaults BITBUCKET_TLS_REJECT_UNAUTHORIZED to true (verification on)", () => {
    expect(loadConfig(base).bitbucketTlsRejectUnauthorized).toBe(true);
  });

  it.each([
    ["false", false],
    ["FALSE", false],
    ["0", false],
    [" false ", false],
    ["true", true],
    ["1", true],
  ])("parses BITBUCKET_TLS_REJECT_UNAUTHORIZED=%j as %s", (value, expected) => {
    expect(
      loadConfig({ ...base, BITBUCKET_TLS_REJECT_UNAUTHORIZED: value }).bitbucketTlsRejectUnauthorized
    ).toBe(expected);
  });

  it("rejects values other than true/false/1/0", () => {
    expect(() => loadConfig({ ...base, BITBUCKET_TLS_REJECT_UNAUTHORIZED: "no" })).toThrow(
      /BITBUCKET_TLS_REJECT_UNAUTHORIZED must be true or false/
    );
  });
});
