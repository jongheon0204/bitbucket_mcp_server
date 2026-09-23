import { describe, it, expect, vi } from "vitest";
import { listChangedFilesTool } from "../../src/tools/listChangedFiles.js";
import type { BitbucketClient } from "../../src/bitbucketClient.js";

describe("listChangedFilesTool", () => {
  it("maps change types and follows pagination to completion", async () => {
    const getJson = vi
      .fn()
      .mockResolvedValueOnce({
        values: [{ path: { toString: "a.ts" }, type: "ADD" }],
        isLastPage: false,
        nextPageStart: 1,
      })
      .mockResolvedValueOnce({
        values: [
          { path: { toString: "b.ts" }, type: "MODIFY" },
          { path: { toString: "c.ts" }, type: "DELETE" },
        ],
        isLastPage: true,
      });
    const client = { getJson, postJson: vi.fn() } as unknown as BitbucketClient;

    const result = await listChangedFilesTool.handler(client, {
      projectKey: "PRJ",
      repositorySlug: "repo",
      pullRequestId: 1,
    });

    expect(result.files).toEqual([
      { path: "a.ts", status: "ADDED", additions: 0, deletions: 0 },
      { path: "b.ts", status: "MODIFIED", additions: 0, deletions: 0 },
      { path: "c.ts", status: "DELETED", additions: 0, deletions: 0 },
    ]);
    expect(getJson).toHaveBeenCalledTimes(2);
    expect(getJson).toHaveBeenNthCalledWith(
      2,
      "/projects/PRJ/repos/repo/pull-requests/1/changes",
      { start: 1 }
    );
  });

  it("uses linesAdded/linesRemoved when the API provides them", async () => {
    const getJson = vi.fn().mockResolvedValue({
      values: [{ path: { toString: "a.ts" }, type: "MODIFY", linesAdded: 5, linesRemoved: 2 }],
      isLastPage: true,
    });
    const client = { getJson, postJson: vi.fn() } as unknown as BitbucketClient;

    const result = await listChangedFilesTool.handler(client, {
      projectKey: "PRJ",
      repositorySlug: "repo",
      pullRequestId: 1,
    });

    expect(result.files[0]).toMatchObject({ additions: 5, deletions: 2 });
  });
});
