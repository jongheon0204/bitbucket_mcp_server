import { z } from "zod";
import type { BitbucketClient } from "../bitbucketClient.js";
import { errorShape, prRefSchema } from "../lib/common-schemas.js";
import { mapWithConcurrency } from "../lib/concurrency.js";
import { truncateHunksToBytes } from "../lib/diff.js";
import { BitbucketMcpError, toBitbucketMcpError } from "../errors.js";
import type { ToolDefinition } from "../lib/register-tool.js";
import type { AppConfig } from "../config.js";
import { fetchFileHunks, hunkSchema } from "./getFileDiff.js";

export const MAX_BATCH_FILES = 20;
/** Max in-flight Bitbucket diff requests per call, to stay clear of the 429 rate limit. */
const DIFF_CONCURRENCY = 5;

const inputSchema = {
  ...prRefSchema,
  filePaths: z
    .array(z.string().min(1))
    .min(1)
    .max(MAX_BATCH_FILES)
    .describe(`list_changed_files 결과의 path 배열 (1~${MAX_BATCH_FILES}개, 중복 경로는 1회만 조회)`),
};

const fileDiffSchema = z.object({
  filePath: z.string(),
  hunks: z.array(hunkSchema),
  truncated: z.boolean(),
  error: z.object(errorShape).nullable(),
});

const outputSchema = {
  diffs: z.array(fileDiffSchema),
  succeeded: z.number(),
  failed: z.number(),
};

export function makeGetFileDiffsTool(
  config: Pick<AppConfig, "maxFileContentBytes">
): ToolDefinition<typeof inputSchema, typeof outputSchema> {
  return {
    name: "get_file_diffs",
    title: "Get File Diffs (batch)",
    description:
      "여러 파일의 diff(hunk 목록)를 한 번의 tool-call로 조회한다. list_changed_files 결과에서 분석할 파일을 " +
      `골라 filePaths로 한 번에 요청한다 (최대 ${MAX_BATCH_FILES}개). 파일 단위 실패는 diffs[].error로 ` +
      "표시되고 나머지 파일은 정상 반환된다. 단건 재확인은 get_file_diff를 사용한다.",
    inputSchema,
    outputSchema,
    async handler(client: BitbucketClient, input) {
      const filePaths = [...new Set(input.filePaths)];

      const diffs = await mapWithConcurrency(filePaths, DIFF_CONCURRENCY, async (filePath) => {
        try {
          const { hunks, truncated } = truncateHunksToBytes(
            await fetchFileHunks(client, input, filePath),
            config.maxFileContentBytes
          );
          return { filePath, hunks, truncated, error: null };
        } catch (err) {
          const mcpErr = toBitbucketMcpError(err);
          // Credentials are call-wide: no point returning N identical per-file auth failures.
          if (mcpErr.code === "AUTH_ERROR") throw mcpErr;
          return {
            filePath,
            hunks: [],
            truncated: false,
            error: { code: mcpErr.code, message: mcpErr.message },
          };
        }
      });

      const failed = diffs.filter((d) => d.error !== null).length;
      // The per-file diff endpoint returns 404 for a missing PR as well, so every file
      // failing with NOT_FOUND is reported as a call-wide NOT_FOUND.
      if (failed === diffs.length && diffs.every((d) => d.error?.code === "NOT_FOUND")) {
        throw new BitbucketMcpError(
          "NOT_FOUND",
          "PR을 찾을 수 없거나 요청한 모든 파일 경로가 PR diff에 없습니다"
        );
      }

      return { diffs, succeeded: diffs.length - failed, failed };
    },
  };
}
