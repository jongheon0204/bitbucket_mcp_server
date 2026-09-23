import { z } from "zod";
import type { BitbucketClient } from "../bitbucketClient.js";
import { encodePathSegments } from "../bitbucketClient.js";
import { prRefSchema } from "../lib/common-schemas.js";
import { BitbucketMcpError } from "../errors.js";
import { buildFileHunks, findFileDiff, type BitbucketDiffResponse } from "../lib/diff.js";
import type { ToolDefinition } from "../lib/register-tool.js";

const inputSchema = {
  ...prRefSchema,
  filePath: z.string().min(1).describe("list_changed_files 결과의 path"),
};

const hunkSchema = z.object({
  header: z.string(),
  oldLines: z.array(z.string()),
  newLines: z.array(z.string()),
});

const outputSchema = {
  filePath: z.string(),
  hunks: z.array(hunkSchema),
};

export const getFileDiffTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: "get_file_diff",
  title: "Get File Diff",
  description:
    "파일 단위 diff(hunk 목록)를 조회한다. 대용량 PR에서 토큰 낭비 없이 필요한 파일만 청크 단위로 " +
    "분석하기 위한 핵심 tool. list_changed_files 이후 파일별로 순차 호출한다.",
  inputSchema,
  outputSchema,
  async handler(client: BitbucketClient, input) {
    const res = await client.getJson<BitbucketDiffResponse>(
      `/projects/${input.projectKey}/repos/${input.repositorySlug}/pull-requests/${input.pullRequestId}/diff/${encodePathSegments(
        input.filePath
      )}`
    );

    const fileDiff = findFileDiff(res, input.filePath);
    if (!fileDiff) {
      throw new BitbucketMcpError(
        "NOT_FOUND",
        `PR diff에서 파일을 찾을 수 없습니다: ${input.filePath}`
      );
    }

    return {
      filePath: input.filePath,
      hunks: buildFileHunks(fileDiff),
    };
  },
};
