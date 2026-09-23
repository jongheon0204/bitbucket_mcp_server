import { describe, it, expect, vi } from "vitest";
import { getPrCommentsTool } from "../../src/tools/getPrComments.js";
import type { BitbucketClient } from "../../src/bitbucketClient.js";

describe("getPrCommentsTool", () => {
  it("flattens top-level comments and replies, ignoring non-comment activities", async () => {
    const getJson = vi.fn().mockResolvedValue({
      values: [
        { action: "OPENED" },
        {
          action: "COMMENTED",
          comment: {
            author: { displayName: "Reviewer" },
            text: "Please add a test",
            createdDate: 1700000000000,
            comments: [
              { author: { name: "author2" }, text: "Sure, will do", createdDate: 1700000100000 },
            ],
          },
        },
      ],
      isLastPage: true,
    });
    const client = { getJson, postJson: vi.fn() } as unknown as BitbucketClient;

    const result = await getPrCommentsTool.handler(client, {
      projectKey: "PRJ",
      repositorySlug: "repo",
      pullRequestId: 1,
    });

    expect(result.comments).toHaveLength(2);
    expect(result.comments[0]).toMatchObject({
      author: "Reviewer",
      content: "Please add a test",
      createdDate: new Date(1700000000000).toISOString(),
    });
    expect(result.comments[1]).toMatchObject({ author: "author2", content: "Sure, will do" });
  });

  it("returns an empty list when there are no comments", async () => {
    const getJson = vi.fn().mockResolvedValue({ values: [], isLastPage: true });
    const client = { getJson, postJson: vi.fn() } as unknown as BitbucketClient;

    const result = await getPrCommentsTool.handler(client, {
      projectKey: "PRJ",
      repositorySlug: "repo",
      pullRequestId: 1,
    });

    expect(result.comments).toEqual([]);
  });
});
