import { z } from "zod";

const envSchema = z.object({
  BITBUCKET_BASE_URL: z
    .string({ required_error: "BITBUCKET_BASE_URL is required" })
    .url("BITBUCKET_BASE_URL must be a valid URL")
    .transform((url) => url.replace(/\/+$/, "")),
  BITBUCKET_HTTP_ACCESS_TOKEN: z
    .string({ required_error: "BITBUCKET_HTTP_ACCESS_TOKEN is required" })
    .min(1, "BITBUCKET_HTTP_ACCESS_TOKEN must not be empty"),
  MAX_FILE_CONTENT_BYTES: z.coerce.number().int().positive().default(51200),
  MCP_TRANSPORT: z.enum(["stdio", "http"]).default("stdio"),
  BITBUCKET_API_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  RETRY_MAX_ATTEMPTS: z.coerce.number().int().min(0).default(3),
});

export interface AppConfig {
  bitbucketBaseUrl: string;
  bitbucketHttpAccessToken: string;
  maxFileContentBytes: number;
  mcpTransport: "stdio" | "http";
  bitbucketApiTimeoutMs: number;
  retryMaxAttempts: number;
}

/**
 * Loads and validates environment configuration per docs/env-config.md.
 * Throws a readable error at startup if required variables are missing/invalid,
 * rather than failing lazily on the first tool call.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  if (parsed.data.MCP_TRANSPORT === "http") {
    // Architecture roadmap (docs/architecture.md): stdio for POC, HTTP transport is future work.
    throw new Error(
      "MCP_TRANSPORT=http is not implemented yet in this POC. Use MCP_TRANSPORT=stdio."
    );
  }

  return {
    bitbucketBaseUrl: parsed.data.BITBUCKET_BASE_URL,
    bitbucketHttpAccessToken: parsed.data.BITBUCKET_HTTP_ACCESS_TOKEN,
    maxFileContentBytes: parsed.data.MAX_FILE_CONTENT_BYTES,
    mcpTransport: parsed.data.MCP_TRANSPORT,
    bitbucketApiTimeoutMs: parsed.data.BITBUCKET_API_TIMEOUT_MS,
    retryMaxAttempts: parsed.data.RETRY_MAX_ATTEMPTS,
  };
}
