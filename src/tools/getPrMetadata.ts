import { z } from "zod";
import type { BitbucketClient } from "../bitbucketClient.js";
import { prRefSchema } from "../lib/common-schemas.js";
import type { ToolDefinition } from "../lib/register-tool.js";

const inputSchema = { ...prRefSchema };

const outputSchema = {
  title: z.string(),
  description: z.string(),
  author: z.string(),
  sourceBranch: z.string(),
  destBranch: z.string(),
  state: z.string(),
};

interface BitbucketPrResponse {
  title?: string;
  description?: string;
  state?: string;
  author?: { user?: { displayName?: string; name?: string } };
  fromRef?: { displayId?: string };
  toRef?: { displayId?: string };
}

export const getPrMetadataTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: "get_pr_metadata",
  title: "Get PR Metadata",
  description:
    "PR의 최신 제목/설명/브랜치/작성자/상태를 조회한다. webhook payload는 스냅샷이라 신뢰성이 낮으므로 " +
    "AI 호출 전 초기 컨텍스트를 결정적으로 준비할 때 사용한다.",
  inputSchema,
  outputSchema,
  async handler(client: BitbucketClient, input) {
    const res = await client.getJson<BitbucketPrResponse>(
      `/projects/${input.projectKey}/repos/${input.repositorySlug}/pull-requests/${input.pullRequestId}`
    );
    return {
      title: res.title ?? "",
      description: res.description ?? "",
      author: res.author?.user?.displayName ?? res.author?.user?.name ?? "",
      sourceBranch: res.fromRef?.displayId ?? "",
      destBranch: res.toRef?.displayId ?? "",
      state: res.state ?? "",
    };
  },
};
