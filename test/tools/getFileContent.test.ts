import { describe, it, expect, vi } from "vitest";
import { makeGetFileContentTool } from "../../src/tools/getFileContent.js";
import type { BitbucketClient } from "../../src/bitbucketClient.js";

describe("getFileContentTool", () => {
  it("joins paginated lines and reports truncated:false for small files", async () => {
    const getJson = vi.fn().mockResolvedValue({
      lines: [{ text: "line1" }, { text: "line2" }],
      isLastPage: true,
    });
    const client = { getJson, postJson: vi.fn() } as unknown as BitbucketClient;
    const tool = makeGetFileContentTool({ maxFileContentBytes: 51200 });

    const result = await tool.handler(client, {
      projectKey: "PRJ",
      repositorySlug: "repo",
      filePath: "a.ts",
      commitHash: "abc123",
    });

    expect(result).toEqual({ content: "line1\nline2", encoding: "utf-8", truncated: false });
    expect(getJson).toHaveBeenCalledWith(
      "/projects/PRJ/repos/repo/browse/a.ts",
      { at: "abc123", start: 0 }
    );
  });

  it("follows pagination across multiple pages", async () => {
    const getJson = vi
      .fn()
      .mockResolvedValueOnce({ lines: [{ text: "line1" }], isLastPage: false, nextPageStart: 1 })
      .mockResolvedValueOnce({ lines: [{ text: "line2" }], isLastPage: true });
    const client = { getJson, postJson: vi.fn() } as unknown as BitbucketClient;
    const tool = makeGetFileContentTool({ maxFileContentBytes: 51200 });

    const result = await tool.handler(client, {
      projectKey: "PRJ",
      repositorySlug: "repo",
      filePath: "a.ts",
      commitHash: "abc123",
    });

    expect(result.content).toBe("line1\nline2");
    expect(getJson).toHaveBeenCalledTimes(2);
  });

  it("throws VALIDATION_ERROR for binary files", async () => {
    const getJson = vi.fn().mockResolvedValue({ binary: true });
    const client = { getJson, postJson: vi.fn() } as unknown as BitbucketClient;
    const tool = makeGetFileContentTool({ maxFileContentBytes: 51200 });

    await expect(
      tool.handler(client, {
        projectKey: "PRJ",
        repositorySlug: "repo",
        filePath: "img.png",
        commitHash: "abc123",
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("truncates content exceeding MAX_FILE_CONTENT_BYTES", async () => {
    const bigText = "x".repeat(200);
    const getJson = vi.fn().mockResolvedValue({ lines: [{ text: bigText }], isLastPage: true });
    const client = { getJson, postJson: vi.fn() } as unknown as BitbucketClient;
    const tool = makeGetFileContentTool({ maxFileContentBytes: 50 });

    const result = await tool.handler(client, {
      projectKey: "PRJ",
      repositorySlug: "repo",
      filePath: "a.ts",
      commitHash: "abc123",
    });

    expect(result.truncated).toBe(true);
    expect(Buffer.byteLength(result.content, "utf8")).toBeLessThanOrEqual(50);
  });
});
