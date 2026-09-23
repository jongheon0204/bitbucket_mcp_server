import { describe, it, expect, vi } from "vitest";
import { makeGetPrDiffTool } from "../../src/tools/getPrDiff.js";
import type { BitbucketClient } from "../../src/bitbucketClient.js";

describe("getPrDiffTool", () => {
  it("builds unified diff text from the Bitbucket diff response", async () => {
    const getJson = vi.fn().mockResolvedValue({
      diffs: [
        {
          source: { toString: "a.ts" },
          destination: { toString: "a.ts" },
          hunks: [
            {
              sourceLine: 1,
              sourceSpan: 2,
              destinationLine: 1,
              destinationSpan: 3,
              segments: [
                { type: "CONTEXT", lines: [{ line: "unchanged" }] },
                { type: "ADDED", lines: [{ line: "new line" }] },
              ],
            },
          ],
        },
      ],
    });
    const client = { getJson, postJson: vi.fn() } as unknown as BitbucketClient;
    const tool = makeGetPrDiffTool({ maxFileContentBytes: 51200 });

    const result = await tool.handler(client, {
      projectKey: "PRJ",
      repositorySlug: "repo",
      pullRequestId: 1,
    });

    expect(result.truncated).toBe(false);
    expect(result.diff).toContain("--- a/a.ts");
    expect(result.diff).toContain("+++ b/a.ts");
    expect(result.diff).toContain("@@ -1,2 +1,3 @@");
    expect(result.diff).toContain(" unchanged");
    expect(result.diff).toContain("+new line");
    expect(getJson).toHaveBeenCalledWith(
      "/projects/PRJ/repos/repo/pull-requests/1/diff"
    );
  });

  it("truncates oversized diffs and flags truncated:true", async () => {
    const bigLine = "x".repeat(100);
    const getJson = vi.fn().mockResolvedValue({
      diffs: [
        {
          source: { toString: "a.ts" },
          destination: { toString: "a.ts" },
          hunks: [
            {
              sourceLine: 1,
              sourceSpan: 1,
              destinationLine: 1,
              destinationSpan: 1,
              segments: [
                { type: "ADDED", lines: Array.from({ length: 50 }, () => ({ line: bigLine })) },
              ],
            },
          ],
        },
      ],
    });
    const client = { getJson, postJson: vi.fn() } as unknown as BitbucketClient;
    const tool = makeGetPrDiffTool({ maxFileContentBytes: 100 });

    const result = await tool.handler(client, {
      projectKey: "PRJ",
      repositorySlug: "repo",
      pullRequestId: 1,
    });

    expect(result.truncated).toBe(true);
    expect(Buffer.byteLength(result.diff, "utf8")).toBeLessThanOrEqual(100);
  });
});
