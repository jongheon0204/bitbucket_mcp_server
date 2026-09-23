#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { BitbucketClient } from "./bitbucketClient.js";
import { registerAllTools } from "./tools/index.js";
import { logger } from "./logger.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new BitbucketClient(config);

  const server = new McpServer(
    { name: "bitbucket-mcp-server", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  registerAllTools(server, client, config);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("server_started", { transport: "stdio" });
}

main().catch((err) => {
  logger.error("fatal_startup_error", {
    message: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
