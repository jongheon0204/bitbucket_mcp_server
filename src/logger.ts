/**
 * Structured JSON logger. Writes to stderr only — stdout is reserved for the
 * MCP JSON-RPC stdio transport, so anything written to stdout would corrupt
 * the protocol stream.
 */
type LogLevel = "info" | "warn" | "error";

function write(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
  process.stderr.write(line + "\n");
}

export const logger = {
  info: (event: string, fields?: Record<string, unknown>) => write("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => write("error", event, fields),
};

const SENSITIVE_KEY_PATTERN = /token|secret|password|authorization/i;

/** Masks sensitive-looking values before they hit logs, per docs/error-handling.md ("민감정보 마스킹"). */
export function maskSensitive(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map(maskSensitive);
  }
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key) ? "***" : maskSensitive(value);
    }
    return out;
  }
  return input;
}

/** Truncates upstream response bodies to 500 chars before logging, per docs/error-handling.md. */
export function truncateForLog(text: string, max = 500): string {
  return text.length > max ? `${text.slice(0, max)}…(truncated)` : text;
}
