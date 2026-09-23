import { z } from "zod";

/** Error codes per docs/error-handling.md "MCP Tool 공통 에러 응답 포맷". */
export type BitbucketErrorCode =
  | "AUTH_ERROR"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "VALIDATION_ERROR";

export class BitbucketMcpError extends Error {
  readonly code: BitbucketErrorCode;
  /** Upstream status/body snippet (<=500 chars), kept for logging only — never sent to the client message. */
  readonly upstreamSnippet?: string;

  constructor(code: BitbucketErrorCode, message: string, upstreamSnippet?: string) {
    super(message);
    this.name = "BitbucketMcpError";
    this.code = code;
    this.upstreamSnippet = upstreamSnippet;
  }

  toResponse(): { success: false; error: { code: BitbucketErrorCode; message: string } } {
    return { success: false, error: { code: this.code, message: this.message } };
  }
}

/** Normalizes any thrown value into a BitbucketMcpError so every tool handler returns the same envelope. */
export function toBitbucketMcpError(err: unknown): BitbucketMcpError {
  if (err instanceof BitbucketMcpError) {
    return err;
  }
  if (err instanceof z.ZodError) {
    const message = err.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    return new BitbucketMcpError("VALIDATION_ERROR", message);
  }
  const message = err instanceof Error ? err.message : String(err);
  return new BitbucketMcpError("UPSTREAM_ERROR", message);
}
