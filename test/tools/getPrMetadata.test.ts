import { describe, it, expect, vi } from "vitest";
import { getPrMetadataTool } from "../../src/tools/getPrMetadata.js";
import type { BitbucketClient } from "../../src/bitbucketClient.js";

function fakeClient(getJson: ReturnType<typeof vi.fn>): BitbucketClient {
  return { getJson, postJson: vi.fn() } as unknown as BitbucketClient;
}

describe("getPrMetadataTool", () => {
  it("maps Bitbucket PR fields to the documented output shape", async () => {
    const getJson = vi.fn().mockResolvedValue({
      title: "Add feature",
      description: "desc",
      state: "OPEN",
      author: { user: { displayName: "Jane Doe", name: "jane" } },
      fromRef: { displayId: "feature/x" },
      toRef: { displayId: "main" },
    });

    const result = await getPrMetadataTool.handler(fakeClient(getJson), {
      projectKey: "PRJ",
      repositorySlug: "repo",
      pullRequestId: 42,
    });

    expect(result).toEqual({
      title: "Add feature",
      description: "desc",
      author: "Jane Doe",
      sourceBranch: "feature/x",
      destBranch: "main",
      state: "OPEN",
    });
    expect(getJson).toHaveBeenCalledWith("/projects/PRJ/repos/repo/pull-requests/42");
  });

  it("falls back to username when displayName is missing", async () => {
    const getJson = vi.fn().mockResolvedValue({
      author: { user: { name: "jane" } },
    });

    const result = await getPrMetadataTool.handler(fakeClient(getJson), {
      projectKey: "PRJ",
      repositorySlug: "repo",
      pullRequestId: 1,
    });

    expect(result.author).toBe("jane");
  });
});
