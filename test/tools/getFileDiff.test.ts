import { describe, it, expect, vi } from "vitest";
import { getFileDiffTool } from "../../src/tools/getFileDiff.js";
import type { BitbucketClient } from "../../src/bitbucketClient.js";

describe("getFileDiffTool", () => {
  it("splits hunk segments into oldLines/newLines for the requested file", async () => {
    const getJson = vi.fn().mockResolvedValue({
      diffs: [
        {
          destination: { toString: "src/a.ts" },
          hunks: [
            {
              sourceLine: 5,
              sourceSpan: 2,
              destinationLine: 5,
              destinationSpan: 2,
              segments: [
                { type: "CONTEXT", lines: [{ line: "ctx" }] },
                { type: "REMOVED", lines: [{ line: "old" }] },
                { type: "ADDED", lines: [{ line: "new" }] },
              ],
            },
          ],
        },
      ],
    });
    const client = { getJson, postJson: vi.fn() } as unknown as BitbucketClient;

    const result = await getFileDiffTool.handler(client, {
      projectKey: "PRJ",
      repositorySlug: "repo",
      pullRequestId: 1,
      filePath: "src/a.ts",
    });

    expect(result.filePath).toBe("src/a.ts");
    expect(result.hunks).toHaveLength(1);
    expect(result.hunks[0].oldLines).toEqual(["ctx", "old"]);
    expect(result.hunks[0].newLines).toEqual(["ctx", "new"]);
    expect(getJson).toHaveBeenCalledWith(
      "/projects/PRJ/repos/repo/pull-requests/1/diff/src/a.ts"
    );
  });

  it("URL-encodes path segments with spaces while preserving slashes", async () => {
    const getJson = vi.fn().mockResolvedValue({
      diffs: [{ destination: { toString: "my folder/file a.ts" }, hunks: [] }],
    });
    const client = { getJson, postJson: vi.fn() } as unknown as BitbucketClient;

    await getFileDiffTool.handler(client, {
      projectKey: "PRJ",
      repositorySlug: "repo",
      pullRequestId: 1,
      filePath: "my folder/file a.ts",
    });

    expect(getJson).toHaveBeenCalledWith(
      "/projects/PRJ/repos/repo/pull-requests/1/diff/my%20folder/file%20a.ts"
    );
  });

  it("throws NOT_FOUND when the file has no entry in the diff response", async () => {
    const getJson = vi.fn().mockResolvedValue({ diffs: [] });
    const client = { getJson, postJson: vi.fn() } as unknown as BitbucketClient;

    await expect(
      getFileDiffTool.handler(client, {
        projectKey: "PRJ",
        repositorySlug: "repo",
        pullRequestId: 1,
        filePath: "missing.ts",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
