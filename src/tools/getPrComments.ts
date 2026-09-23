import { z } from "zod";
import type { BitbucketClient } from "../bitbucketClient.js";
import { prRefSchema } from "../lib/common-schemas.js";
import { paginateAll, type BitbucketPage } from "../lib/pagination.js";
import type { ToolDefinition } from "../lib/register-tool.js";

const inputSchema = { ...prRefSchema };

const commentSchema = z.object({
  author: z.string(),
  content: z.string(),
  createdDate: z.string(),
});

const outputSchema = {
  comments: z.array(commentSchema),
};

interface BitbucketComment {
  author?: { displayName?: string; name?: string };
  text?: string;
  createdDate?: number;
  comments?: BitbucketComment[]; // nested replies
}

interface BitbucketActivity {
  action?: string;
  comment?: BitbucketComment;
}

function flattenComment(comment: BitbucketComment): { author: string; content: string; createdDate: string }[] {
  const self = {
    author: comment.author?.displayName ?? comment.author?.name ?? "",
    content: comment.text ?? "",
    createdDate: comment.createdDate ? new Date(comment.createdDate).toISOString() : "",
  };
  const replies = (comment.comments ?? []).flatMap(flattenComment);
  return [self, ...replies];
}

export const getPrCommentsTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: "get_pr_comments",
  title: "Get PR Comments",
  description:
    "기존 리뷰 코멘트를 조회해 컨텍스트를 보강한다 (선택적 사용 — 리뷰어가 이미 지적한 " +
    "우려사항을 테스트케이스에 반영할 때 참고).",
  inputSchema,
  outputSchema,
  async handler(client: BitbucketClient, input) {
    const activities = await paginateAll<BitbucketActivity>((start) =>
      client.getJson<BitbucketPage<BitbucketActivity>>(
        `/projects/${input.projectKey}/repos/${input.repositorySlug}/pull-requests/${input.pullRequestId}/activities`,
        { start }
      )
    );

    const comments = activities
      .filter((a) => a.action === "COMMENTED" && a.comment)
      .flatMap((a) => flattenComment(a.comment as BitbucketComment));

    return { comments };
  },
};
