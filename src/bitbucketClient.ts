import type { AppConfig } from "./config.js";
import { BitbucketMcpError } from "./errors.js";
import { logger, truncateForLog } from "./logger.js";

/**
 * Fixed retry budget for timeout/5xx per docs/error-handling.md:
 * "타임아웃 / 5xx | 최대 2회 재시도 후 실패 응답". This is intentionally NOT tied to
 * RETRY_MAX_ATTEMPTS (which docs/env-config.md documents for the 429 path — see
 * docs/error-handling.md's explicit "1s → 2s → 4s" / 3-attempt spec for 429).
 */
const UPSTREAM_MAX_RETRIES = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Encodes a repo-relative path's segments individually, preserving literal "/" separators. */
export function encodePathSegments(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

type QueryValue = string | number | boolean | undefined;

function buildQueryString(query?: Record<string, QueryValue>): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }
  const str = params.toString();
  return str ? `?${str}` : "";
}

export class BitbucketClient {
  constructor(private readonly config: AppConfig) {}

  async getJson<T>(path: string, query?: Record<string, QueryValue>): Promise<T> {
    const res = await this.requestWithRetry("GET", path, query);
    return (await res.json()) as T;
  }

  async postJson<T>(path: string, body: unknown): Promise<T> {
    const res = await this.requestWithRetry("POST", path, undefined, body);
    return (await res.json()) as T;
  }

  private buildUrl(path: string, query?: Record<string, QueryValue>): string {
    return `${this.config.bitbucketBaseUrl}/rest/api/1.0${path}${buildQueryString(query)}`;
  }

  private async fetchOnce(
    method: string,
    url: string,
    body?: unknown
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.bitbucketApiTimeoutMs);
    try {
      return await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.config.bitbucketHttpAccessToken}`,
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async requestWithRetry(
    method: string,
    path: string,
    query?: Record<string, QueryValue>,
    body?: unknown
  ): Promise<Response> {
    const url = this.buildUrl(path, query);
    let rateLimitRetries = 0;
    let upstreamRetries = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      let res: Response;
      try {
        res = await this.fetchOnce(method, url, body);
      } catch (err) {
        // Network error or timeout (AbortError).
        if (upstreamRetries < UPSTREAM_MAX_RETRIES) {
          upstreamRetries++;
          await sleep(1000 * 2 ** (upstreamRetries - 1));
          continue;
        }
        const message = err instanceof Error ? err.message : String(err);
        throw new BitbucketMcpError(
          "UPSTREAM_ERROR",
          `Bitbucket 요청 실패 (timeout/network): ${message}`
        );
      }

      if (res.status === 401 || res.status === 403) {
        throw new BitbucketMcpError(
          "AUTH_ERROR",
          `Bitbucket 인증/권한 오류 (HTTP ${res.status})`,
          await this.snippet(res)
        );
      }

      if (res.status === 404) {
        throw new BitbucketMcpError(
          "NOT_FOUND",
          "요청한 리소스를 찾을 수 없습니다 (PR/파일/저장소 확인 필요)",
          await this.snippet(res)
        );
      }

      if (res.status === 429) {
        if (rateLimitRetries < this.config.retryMaxAttempts) {
          rateLimitRetries++;
          await sleep(1000 * 2 ** (rateLimitRetries - 1));
          continue;
        }
        throw new BitbucketMcpError(
          "RATE_LIMITED",
          "Bitbucket API rate limit 초과 (재시도 소진)",
          await this.snippet(res)
        );
      }

      if (res.status >= 500) {
        if (upstreamRetries < UPSTREAM_MAX_RETRIES) {
          upstreamRetries++;
          await sleep(1000 * 2 ** (upstreamRetries - 1));
          continue;
        }
        throw new BitbucketMcpError(
          "UPSTREAM_ERROR",
          `Bitbucket 서버 오류 (HTTP ${res.status})`,
          await this.snippet(res)
        );
      }

      if (!res.ok) {
        throw new BitbucketMcpError(
          "UPSTREAM_ERROR",
          `예상치 못한 Bitbucket 응답 (HTTP ${res.status})`,
          await this.snippet(res)
        );
      }

      return res;
    }
  }

  private async snippet(res: Response): Promise<string> {
    try {
      const text = await res.clone().text();
      const line = truncateForLog(text);
      logger.warn("bitbucket_error_response", { status: res.status, body: line });
      return line;
    } catch {
      return "";
    }
  }
}
