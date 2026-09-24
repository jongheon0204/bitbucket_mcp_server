import { z } from "zod";
import type { BitbucketClient } from "../bitbucketClient.js";
import { prRefSchema } from "../lib/common-schemas.js";
import type { ToolDefinition } from "../lib/register-tool.js";
import { getPrMetadataTool } from "./getPrMetadata.js";
import { listChangedFilesTool } from "./listChangedFiles.js";

const inputSchema = { ...prRefSchema };

const outputSchema = {
  metadata: z.object(getPrMetadataTool.outputSchema),
  files: listChangedFilesTool.outputSchema.files,
  summary: z.object({
    totalFiles: z.number(),
    totalAdditions: z.number(),
    totalDeletions: z.number(),
  }),
};

export const getPrContextTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: "get_pr_context",
  title: "Get PR Context",
  description:
    "get_pr_metadata + list_changed_files 결과를 하나로 합쳐 반환한다. Spring이 AI 최초 호출 전 " +
    "초기 컨텍스트(PR 최신 정보 + 변경 파일 목록)를 1회 조회로 결정적으로 준비할 때 사용한다. " +
    "둘 중 하나라도 실패하면 전체 실패로 응답한다.",
  inputSchema,
  outputSchema,
  async handler(client: BitbucketClient, input) {
    // Promise.all rejects on the first failure, so a partial context is never returned.
    const [metadata, { files }] = await Promise.all([
      getPrMetadataTool.handler(client, input),
      listChangedFilesTool.handler(client, input),
    ]);

    return {
      metadata,
      files,
      summary: {
        totalFiles: files.length,
        totalAdditions: files.reduce((sum, f) => sum + f.additions, 0),
        totalDeletions: files.reduce((sum, f) => sum + f.deletions, 0),
      },
    };
  },
};
