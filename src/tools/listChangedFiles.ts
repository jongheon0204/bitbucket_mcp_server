import { z } from "zod";
import type { BitbucketClient } from "../bitbucketClient.js";
import { prRefSchema } from "../lib/common-schemas.js";
import { paginateAll, type BitbucketPage } from "../lib/pagination.js";
import type { ToolDefinition } from "../lib/register-tool.js";

const inputSchema = { ...prRefSchema };

const fileEntrySchema = z.object({
  path: z.string(),
  status: z.enum(["ADDED", "MODIFIED", "DELETED"]),
  additions: z.number(),
  deletions: z.number(),
});

const outputSchema = {
  files: z.array(fileEntrySchema),
};

interface BitbucketChange {
  path?: { toString?: string };
  type?: string; // ADD | MODIFY | DELETE | COPY | MOVE
  // Not consistently present on Bitbucket Data Center's /changes endpoint;
  // populated only when the server includes it.
  linesAdded?: number;
  linesRemoved?: number;
}

function mapStatus(type: string | undefined): "ADDED" | "MODIFIED" | "DELETED" {
  if (type === "ADD") return "ADDED";
  if (type === "DELETE") return "DELETED";
  return "MODIFIED"; // MODIFY, COPY, MOVE, etc.
}

export const listChangedFilesTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: "list_changed_files",
  title: "List Changed Files",
  description:
    "PR에서 변경된 파일 목록과 각 파일의 상태(added/modified/deleted), 증감 라인 수를 조회한다. " +
    "AI가 대용량 diff를 파일 단위로 청크 탐색하기 위한 첫 진입점.",
  inputSchema,
  outputSchema,
  async handler(client: BitbucketClient, input) {
    const changes = await paginateAll<BitbucketChange>((start) =>
      client.getJson<BitbucketPage<BitbucketChange>>(
        `/projects/${input.projectKey}/repos/${input.repositorySlug}/pull-requests/${input.pullRequestId}/changes`,
        { start }
      )
    );

    return {
      files: changes.map((change) => ({
        path: change.path?.toString ?? "",
        status: mapStatus(change.type),
        // Bitbucket Server's /changes endpoint does not reliably expose line
        // counts; use them when present, otherwise 0 (AI should fall back to
        // get_file_diff for exact hunk-level detail).
        additions: change.linesAdded ?? 0,
        deletions: change.linesRemoved ?? 0,
      })),
    };
  },
};
