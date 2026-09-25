import { describe, it, expect, vi } from "vitest";
import { makeGetFileDiffsTool } from "../../src/tools/getFileDiffs.js";
import { BitbucketMcpError } from "../../src/errors.js";
import type { BitbucketClient } from "../../src/bitbucketClient.js";

const ref = { projectKey: "PRJ", repositorySlug: "repo", pullRequestId: 1 };

function diffFor(path: string, lines: string[] = ["new"]) {
  return {
    diffs: [
      {
        destination: { toString: path },
        hunks: [{ segments: [{ type: "ADDED", lines: lines.map((line) => ({ line })) }] }],
      },
    ],
  };
}

describe("getFileDiffsTool", () => {
  const tool = makeGetFileDiffsTool({ maxFileContentBytes: 51200 });

  it("returns diffs for every file in input order, deduplicating paths", async () => {
    const getJson = vi.fn((path: string) =>
      Promise.resolve(diffFor(decodeURIComponent(path.split("/diff/")[1])))
    );
    const client = { getJson, postJson: vi.fn() } as unknown as BitbucketClient;

    const result = await tool.handler(client, {
      ...ref,
      filePaths: ["b.ts", "a.ts", "b.ts"],
    });

    expect(result.diffs.map((d) => d.filePath)).toEqual(["b.ts", "a.ts"]);
    expect(result.diffs[0]).toMatchObject({ truncated: false, error: null });
    expect(result.diffs[0].hunks[0].newLines).toEqual(["new"]);
    expect(result).toMatchObject({ succeeded: 2, failed: 0 });
    expect(getJson).toHaveBeenCalledTimes(2);
  });

  it("reports per-file failures without failing the whole call", async () => {
    const getJson = vi.fn((path: string) =>
      path.endsWith("/missing.ts")
        ? Promise.reject(new BitbucketMcpError("NOT_FOUND", "not found"))
        : path.endsWith("/flaky.ts")
          ? Promise.reject(new BitbucketMcpError("UPSTREAM_ERROR", "5xx"))
          : Promise.resolve(diffFor("ok.ts"))
    );
    const client = { getJson, postJson: vi.fn() } as unknown as BitbucketClient;

    const result = await tool.handler(client, {
      ...ref,
      filePaths: ["ok.ts", "missing.ts", "flaky.ts"],
    });

    expect(result).toMatchObject({ succeeded: 1, failed: 2 });
    expect(result.diffs[1]).toMatchObject({ hunks: [], error: { code: "NOT_FOUND" } });
    expect(result.diffs[2].error?.code).toBe("UPSTREAM_ERROR");
  });

  it("fails the whole call on AUTH_ERROR", async () => {
    const getJson = vi.fn().mockRejectedValue(new BitbucketMcpError("AUTH_ERROR", "401"));
    const client = { getJson, postJson: vi.fn() } as unknown as BitbucketClient;

    await expect(tool.handler(client, { ...ref, filePaths: ["a.ts"] })).rejects.toMatchObject({
      code: "AUTH_ERROR",
    });
  });

  it("fails the whole call with NOT_FOUND when every file is NOT_FOUND (PR missing)", async () => {
    const getJson = vi.fn().mockRejectedValue(new BitbucketMcpError("NOT_FOUND", "404"));
    const client = { getJson, postJson: vi.fn() } as unknown as BitbucketClient;

    await expect(
      tool.handler(client, { ...ref, filePaths: ["a.ts", "b.ts"] })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("truncates a file's hunks past MAX_FILE_CONTENT_BYTES", async () => {
    const small = makeGetFileDiffsTool({ maxFileContentBytes: 10 });
    const getJson = vi.fn().mockResolvedValue(diffFor("a.ts", ["12345", "67890", "abcde"]));
    const client = { getJson, postJson: vi.fn() } as unknown as BitbucketClient;

    const result = await small.handler(client, { ...ref, filePaths: ["a.ts"] });

    expect(result.diffs[0].truncated).toBe(true);
    expect(result.diffs[0].hunks[0].newLines).toEqual(["12345", "67890"]);
  });

  it("limits in-flight Bitbucket requests", async () => {
    let inFlight = 0;
    let peak = 0;
    const getJson = vi.fn(async (path: string) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return diffFor(path.split("/diff/")[1]);
    });
    const client = { getJson, postJson: vi.fn() } as unknown as BitbucketClient;

    const filePaths = Array.from({ length: 12 }, (_, i) => `f${i}.ts`);
    const result = await tool.handler(client, { ...ref, filePaths });

    expect(result.succeeded).toBe(12);
    expect(peak).toBeLessThanOrEqual(5);
  });
});
