import { z } from "zod";
import type { BitbucketClient } from "../bitbucketClient.js";
import { prRefSchema } from "../lib/common-schemas.js";
import { buildUnifiedDiffText, truncateToBytes, type BitbucketDiffResponse } from "../lib/diff.js";
import type { ToolDefinition } from "../lib/register-tool.js";
import type { AppConfig } from "../config.js";

const inputSchema = { ...prRefSchema };

const outputSchema = {
  diff: z.string(),
  truncated: z.boolean(),
};

export function makeGetPrDiffTool(
  config: Pick<AppConfig, "maxFileContentBytes">
): ToolDefinition<typeof inputSchema, typeof outputSchema> {
  return {
    name: "get_pr_diff",
    title: "Get PR Diff",
    description:
      "PR 전체의 unified diff를 조회한다. 변경 규모가 작은 PR에서 빠르게 전체 맥락을 파악할 때 사용한다. " +
      "대용량 PR에서는 truncated:true가 반환될 수 있으며, 이 경우 get_file_diff로 전환을 권장한다.",
    inputSchema,
    outputSchema,
    async handler(client: BitbucketClient, input) {
      const res = await client.getJson<BitbucketDiffResponse>(
        `/projects/${input.projectKey}/repos/${input.repositorySlug}/pull-requests/${input.pullRequestId}/diff`
      );
      const fullText = buildUnifiedDiffText(res);
      const { text, truncated } = truncateToBytes(fullText, config.maxFileContentBytes);
      return { diff: text, truncated };
    },
  };
}
