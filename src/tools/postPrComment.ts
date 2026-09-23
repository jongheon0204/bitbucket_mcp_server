import { z } from "zod";
import type { BitbucketClient } from "../bitbucketClient.js";
import { prRefSchema } from "../lib/common-schemas.js";
import type { ToolDefinition } from "../lib/register-tool.js";

const inputSchema = {
  ...prRefSchema,
  content: z.string().min(1).describe("코멘트 본문 (wiki 링크 포함 가능)"),
};

const outputSchema = {
  commentId: z.number(),
  createdDate: z.string(),
};

interface BitbucketCommentResponse {
  id?: number;
  createdDate?: number;
}

export const postPrCommentTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: "post_pr_comment",
  title: "Post PR Comment",
  description:
    "처리 결과(예: 생성된 테스트케이스 요약, 사내 wiki 업로드 링크)를 PR에 텍스트 코멘트로 등록한다. " +
    "Bitbucket Data Center는 댓글 파일 첨부를 지원하지 않으므로 링크만 남기는 방식으로 사용한다.",
  inputSchema,
  outputSchema,
  async handler(client: BitbucketClient, input) {
    const res = await client.postJson<BitbucketCommentResponse>(
      `/projects/${input.projectKey}/repos/${input.repositorySlug}/pull-requests/${input.pullRequestId}/comments`,
      { text: input.content }
    );

    return {
      commentId: res.id ?? 0,
      createdDate: res.createdDate ? new Date(res.createdDate).toISOString() : "",
    };
  },
};
