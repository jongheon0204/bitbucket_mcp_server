import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { BitbucketClient } from "../bitbucketClient.js";
import { toBitbucketMcpError } from "../errors.js";
import { logger, maskSensitive } from "../logger.js";
import { errorShape } from "./common-schemas.js";

export interface ToolDefinition<
  In extends z.ZodRawShape,
  Out extends z.ZodRawShape
> {
  name: string;
  title: string;
  description: string;
  inputSchema: In;
  outputSchema: Out;
  handler: (client: BitbucketClient, input: z.infer<z.ZodObject<In>>) => Promise<z.infer<z.ZodObject<Out>>>;
}

/**
 * Registers a tool against the MCP server, wrapping the handler with the
 * common response envelope + logging policy from docs/error-handling.md:
 * - success:  { success: true, data: {...} }
 * - failure:  { success: false, error: { code, message } }
 * - every call logs toolName/params(masked)/durationMs/success to stderr.
 */
export function registerBitbucketTool<In extends z.ZodRawShape, Out extends z.ZodRawShape>(
  server: McpServer,
  client: BitbucketClient,
  def: ToolDefinition<In, Out>
): void {
  const outputSchema = {
    success: z.boolean(),
    data: z.object(def.outputSchema).optional(),
    error: z.object(errorShape).optional(),
  };

  // McpServer.registerTool's InputArgs/OutputArgs generics can't be resolved
  // from a still-generic `In`/`Out` inside this wrapper (a generic function
  // being passed into another generic-typed overloaded method), which makes
  // tsc dump a huge structural mismatch even though the runtime shapes line
  // up. Bridge across that inference boundary explicitly instead of fighting
  // it — the rest of this module (and every call site) stays fully typed.
  const registerTool = server.registerTool.bind(server) as (
    name: string,
    config: {
      title?: string;
      description?: string;
      inputSchema?: z.ZodRawShape;
      outputSchema?: z.ZodRawShape;
    },
    cb: (rawInput: Record<string, unknown>) => Promise<CallToolResult>
  ) => unknown;

  registerTool(
    def.name,
    {
      title: def.title,
      description: def.description,
      inputSchema: def.inputSchema,
      outputSchema,
    },
    async (rawInput): Promise<CallToolResult> => {
      const start = Date.now();
      const maskedParams = maskSensitive(rawInput);
      try {
        const input = z.object(def.inputSchema).parse(rawInput);
        const data = await def.handler(client, input);
        const durationMs = Date.now() - start;
        logger.info("tool_call", { toolName: def.name, params: maskedParams, durationMs, success: true });
        const payload = { success: true as const, data };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
          structuredContent: payload,
        };
      } catch (err) {
        const durationMs = Date.now() - start;
        const mcpErr = toBitbucketMcpError(err);
        logger.error("tool_call", {
          toolName: def.name,
          params: maskedParams,
          durationMs,
          success: false,
          errorCode: mcpErr.code,
          upstream: mcpErr.upstreamSnippet,
        });
        const payload = mcpErr.toResponse();
        return {
          content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
          structuredContent: payload,
          isError: true,
        };
      }
    }
  );
}
