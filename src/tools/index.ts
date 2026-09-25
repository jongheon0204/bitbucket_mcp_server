import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BitbucketClient } from "../bitbucketClient.js";
import type { AppConfig } from "../config.js";
import { registerBitbucketTool } from "../lib/register-tool.js";

import { getPrMetadataTool } from "./getPrMetadata.js";
import { listChangedFilesTool } from "./listChangedFiles.js";
import { makeGetPrDiffTool } from "./getPrDiff.js";
import { getFileDiffTool } from "./getFileDiff.js";
import { makeGetFileContentTool } from "./getFileContent.js";
import { getPrCommentsTool } from "./getPrComments.js";
import { postPrCommentTool } from "./postPrComment.js";
import { makeGetFileDiffsTool } from "./getFileDiffs.js";
import { getPrContextTool } from "./getPrContext.js";

export function registerAllTools(server: McpServer, client: BitbucketClient, config: AppConfig): void {
  registerBitbucketTool(server, client, getPrMetadataTool);
  registerBitbucketTool(server, client, listChangedFilesTool);
  registerBitbucketTool(server, client, makeGetPrDiffTool(config));
  registerBitbucketTool(server, client, getFileDiffTool);
  registerBitbucketTool(server, client, makeGetFileContentTool(config));
  registerBitbucketTool(server, client, getPrCommentsTool);
  registerBitbucketTool(server, client, postPrCommentTool);
  registerBitbucketTool(server, client, makeGetFileDiffsTool(config));
  registerBitbucketTool(server, client, getPrContextTool);
}
