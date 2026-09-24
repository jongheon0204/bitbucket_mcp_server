import { describe, it, expect, vi } from "vitest";
import { getPrContextTool } from "../../src/tools/getPrContext.js";
import { BitbucketMcpError } from "../../src/errors.js";
import type { BitbucketClient } from "../../src/bitbucketClient.js";

const ref = { projectKey: "PRJ", repositorySlug: "repo", pullRequestId: 1 };

const prResponse = {
  title: "Add feature",
  description: "desc",
  state: "OPEN",
  author: { user: { displayName: "Dev" } },
  fromRef: { displayId: "feature" },
  toRef: { displayId: "main" },
};

describe("getPrContextTool", () => {
  it("combines metadata and changed files with a summary", async () => {
    const getJson = vi.fn((path: string) =>
      Promise.resolve(
        path.endsWith("/changes")
          ? {
              values: [
                { path: { toString: "a.ts" }, type: "ADD", linesAdded: 10, linesRemoved: 0 },
                { path: { toString: "b.ts" }, type: "MODIFY", linesAdded: 3, linesRemoved: 4 },
              ],
              isLastPage: true,
            }
          : prResponse
      )
    );
    const client = { getJson, postJson: vi.fn() } as unknown as BitbucketClient;

    const result = await getPrContextTool.handler(client, ref);

    expect(result.metadata).toEqual({
      title: "Add feature",
      description: "desc",
      author: "Dev",
      sourceBranch: "feature",
      destBranch: "main",
      state: "OPEN",
    });
    expect(result.files).toHaveLength(2);
    expect(result.summary).toEqual({ totalFiles: 2, totalAdditions: 13, totalDeletions: 4 });
    expect(getJson).toHaveBeenCalledWith("/projects/PRJ/repos/repo/pull-requests/1");
    expect(getJson).toHaveBeenCalledWith("/projects/PRJ/repos/repo/pull-requests/1/changes", {
      start: 0,
    });
  });

  it("fails entirely when either call fails", async () => {
    const getJson = vi.fn((path: string) =>
      path.endsWith("/changes")
        ? Promise.reject(new BitbucketMcpError("UPSTREAM_ERROR", "5xx"))
        : Promise.resolve(prResponse)
    );
    const client = { getJson, postJson: vi.fn() } as unknown as BitbucketClient;

    await expect(getPrContextTool.handler(client, ref)).rejects.toMatchObject({
      code: "UPSTREAM_ERROR",
    });
  });
});
