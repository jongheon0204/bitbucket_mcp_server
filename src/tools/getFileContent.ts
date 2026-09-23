import { z } from "zod";
import type { BitbucketClient } from "../bitbucketClient.js";
import { encodePathSegments } from "../bitbucketClient.js";
import { projectKeySchema, repositorySlugSchema } from "../lib/common-schemas.js";
import { BitbucketMcpError } from "../errors.js";
import { truncateToBytes } from "../lib/diff.js";
import type { ToolDefinition } from "../lib/register-tool.js";
import type { AppConfig } from "../config.js";

// Note: pullRequestId is intentionally not part of this tool's input —
// see docs/tool-definitions/get_file_content.md (keyed by commitHash instead).
const inputSchema = {
  projectKey: projectKeySchema,
  repositorySlug: repositorySlugSchema,
  filePath: z.string().min(1),
  commitHash: z.string().min(1).describe("조회할 커밋 (보통 PR의 source commit)"),
};

const outputSchema = {
  content: z.string(),
  encoding: z.string(),
  truncated: z.boolean(),
};

interface BitbucketBrowseResponse {
  lines?: { text?: string }[];
  isLastPage?: boolean;
  nextPageStart?: number | null;
  binary?: boolean;
}

export function makeGetFileContentTool(
  config: Pick<AppConfig, "maxFileContentBytes">
): ToolDefinition<typeof inputSchema, typeof outputSchema> {
  return {
    name: "get_file_content",
    title: "Get File Content",
    description:
      "diff만으로 맥락 파악이 어려울 때, 특정 커밋 시점의 파일 전체 내용을 조회한다. " +
      `MAX_FILE_CONTENT_BYTES(${config.maxFileContentBytes} bytes) 초과 시 앞부분만 반환하고 truncated:true.`,
    inputSchema,
    outputSchema,
    async handler(client: BitbucketClient, input) {
      const lines: string[] = [];
      let start = 0;
      let truncated = false;

      for (let page = 0; page < 200; page++) {
        const res = await client.getJson<BitbucketBrowseResponse>(
          `/projects/${input.projectKey}/repos/${input.repositorySlug}/browse/${encodePathSegments(
            input.filePath
          )}`,
          { at: input.commitHash, start }
        );

        if (res.binary || !res.lines) {
          throw new BitbucketMcpError(
            "VALIDATION_ERROR",
            `바이너리 파일은 지원하지 않습니다: ${input.filePath}`
          );
        }

        for (const line of res.lines) {
          lines.push(line.text ?? "");
        }

        const currentBytes = Buffer.byteLength(lines.join("\n"), "utf8");
        if (currentBytes >= config.maxFileContentBytes) {
          truncated = true;
          break;
        }

        if (res.isLastPage || res.nextPageStart === undefined || res.nextPageStart === null) {
          break;
        }
        start = res.nextPageStart;
      }

      const joined = lines.join("\n");
      const result = truncateToBytes(joined, config.maxFileContentBytes);

      return {
        content: result.text,
        encoding: "utf-8",
        truncated: truncated || result.truncated,
      };
    },
  };
}
