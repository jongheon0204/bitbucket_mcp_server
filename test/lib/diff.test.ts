import { describe, it, expect } from "vitest";
import {
  buildFileHunks,
  buildUnifiedDiffText,
  findFileDiff,
  truncateToBytes,
  type BitbucketDiffResponse,
} from "../../src/lib/diff.js";

const response: BitbucketDiffResponse = {
  diffs: [
    {
      source: { toString: "a.ts" },
      destination: { toString: "a.ts" },
      hunks: [
        {
          sourceLine: 1,
          sourceSpan: 1,
          destinationLine: 1,
          destinationSpan: 2,
          segments: [
            { type: "CONTEXT", lines: [{ line: "ctx" }] },
            { type: "ADDED", lines: [{ line: "added" }] },
          ],
        },
      ],
    },
  ],
};

describe("findFileDiff", () => {
  it("matches by destination path", () => {
    expect(findFileDiff(response, "a.ts")).toBe(response.diffs![0]);
  });

  it("falls back to the sole diff entry when there is exactly one and nothing matches", () => {
    expect(findFileDiff(response, "typo.ts")).toBe(response.diffs![0]);
  });

  it("returns undefined when there are no diffs at all", () => {
    expect(findFileDiff({ diffs: [] }, "a.ts")).toBeUndefined();
  });
});

describe("buildFileHunks", () => {
  it("splits CONTEXT/ADDED/REMOVED segments into oldLines/newLines", () => {
    const hunks = buildFileHunks({
      hunks: [
        {
          sourceLine: 5,
          sourceSpan: 2,
          destinationLine: 5,
          destinationSpan: 2,
          segments: [
            { type: "CONTEXT", lines: [{ line: "ctx" }] },
            { type: "REMOVED", lines: [{ line: "old" }] },
            { type: "ADDED", lines: [{ line: "new" }] },
          ],
        },
      ],
    });

    expect(hunks).toHaveLength(1);
    expect(hunks[0].oldLines).toEqual(["ctx", "old"]);
    expect(hunks[0].newLines).toEqual(["ctx", "new"]);
    expect(hunks[0].header).toBe("@@ -5,2 +5,2 @@");
  });
});

describe("buildUnifiedDiffText", () => {
  it("renders standard unified diff markers", () => {
    const text = buildUnifiedDiffText(response);
    expect(text).toContain("--- a/a.ts");
    expect(text).toContain("+++ b/a.ts");
    expect(text).toContain("@@ -1,1 +1,2 @@");
    expect(text).toContain(" ctx");
    expect(text).toContain("+added");
  });
});

describe("truncateToBytes", () => {
  it("leaves short text untouched", () => {
    const result = truncateToBytes("hello", 100);
    expect(result).toEqual({ text: "hello", truncated: false });
  });

  it("truncates to the UTF-8 byte budget", () => {
    const result = truncateToBytes("hello world", 5);
    expect(result.truncated).toBe(true);
    expect(Buffer.byteLength(result.text, "utf8")).toBe(5);
  });
});
