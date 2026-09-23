import { describe, it, expect, vi } from "vitest";
import { postPrCommentTool } from "../../src/tools/postPrComment.js";
import type { BitbucketClient } from "../../src/bitbucketClient.js";

describe("postPrCommentTool", () => {
  it("posts the comment body and maps the response", async () => {
    const postJson = vi.fn().mockResolvedValue({ id: 99, createdDate: 1700000000000 });
    const client = { getJson: vi.fn(), postJson } as unknown as BitbucketClient;

    const result = await postPrCommentTool.handler(client, {
      projectKey: "PRJ",
      repositorySlug: "repo",
      pullRequestId: 1,
      content: "See wiki: https://wiki.internal/testcases/123",
    });

    expect(result).toEqual({
      commentId: 99,
      createdDate: new Date(1700000000000).toISOString(),
    });
    expect(postJson).toHaveBeenCalledWith(
      "/projects/PRJ/repos/repo/pull-requests/1/comments",
      { text: "See wiki: https://wiki.internal/testcases/123" }
    );
  });
});
