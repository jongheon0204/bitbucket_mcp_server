/**
 * Parses the Bitbucket Data Center REST API diff resource shape:
 * { diffs: [ { source, destination, hunks: [ { sourceLine, sourceSpan,
 *   destinationLine, destinationSpan, segments: [ { type: CONTEXT|ADDED|REMOVED,
 *   lines: [ { line } ] } ] } ] } ] }
 * into the plain shapes docs/tool-definitions/get_pr_diff.md and
 * get_file_diff.md ask for. Field names/shape should be re-verified against a
 * real captured payload before production use (see docs/webhook-payload-spec.md's
 * own caveat about verifying real Bitbucket payloads).
 */

export interface BitbucketDiffLine {
  line?: string;
}

export interface BitbucketDiffSegment {
  type?: "CONTEXT" | "ADDED" | "REMOVED" | string;
  lines?: BitbucketDiffLine[];
}

export interface BitbucketDiffHunk {
  sourceLine?: number;
  sourceSpan?: number;
  destinationLine?: number;
  destinationSpan?: number;
  segments?: BitbucketDiffSegment[];
}

export interface BitbucketFileDiff {
  source?: { toString?: string } | null;
  destination?: { toString?: string } | null;
  hunks?: BitbucketDiffHunk[];
}

export interface BitbucketDiffResponse {
  diffs?: BitbucketFileDiff[];
}

export interface FileHunk {
  header: string;
  oldLines: string[];
  newLines: string[];
}

function hunkHeader(hunk: BitbucketDiffHunk): string {
  return `@@ -${hunk.sourceLine ?? 0},${hunk.sourceSpan ?? 0} +${hunk.destinationLine ?? 0},${hunk.destinationSpan ?? 0} @@`;
}

export function buildFileHunks(fileDiff: BitbucketFileDiff): FileHunk[] {
  return (fileDiff.hunks ?? []).map((hunk) => {
    const oldLines: string[] = [];
    const newLines: string[] = [];
    for (const segment of hunk.segments ?? []) {
      for (const line of segment.lines ?? []) {
        const text = line.line ?? "";
        if (segment.type === "CONTEXT") {
          oldLines.push(text);
          newLines.push(text);
        } else if (segment.type === "REMOVED") {
          oldLines.push(text);
        } else if (segment.type === "ADDED") {
          newLines.push(text);
        }
      }
    }
    return { header: hunkHeader(hunk), oldLines, newLines };
  });
}

function filePath(fileDiff: BitbucketFileDiff): string {
  return (
    fileDiff.destination?.toString ?? fileDiff.source?.toString ?? "/dev/null"
  );
}

/** Finds the diff entry for a single file path within a multi-file diff response. */
export function findFileDiff(
  response: BitbucketDiffResponse,
  path: string
): BitbucketFileDiff | undefined {
  return (response.diffs ?? []).find(
    (d) => d.destination?.toString === path || d.source?.toString === path
  ) ?? (response.diffs?.length === 1 ? response.diffs[0] : undefined);
}

/** Reconstructs a standard unified-diff text block from the whole PR diff response. */
export function buildUnifiedDiffText(response: BitbucketDiffResponse): string {
  const parts: string[] = [];
  for (const fileDiff of response.diffs ?? []) {
    const path = filePath(fileDiff);
    parts.push(`--- a/${path}`);
    parts.push(`+++ b/${path}`);
    for (const hunk of fileDiff.hunks ?? []) {
      parts.push(hunkHeader(hunk));
      for (const segment of hunk.segments ?? []) {
        const prefix = segment.type === "ADDED" ? "+" : segment.type === "REMOVED" ? "-" : " ";
        for (const line of segment.lines ?? []) {
          parts.push(`${prefix}${line.line ?? ""}`);
        }
      }
    }
  }
  return parts.join("\n");
}

export interface TruncatedText {
  text: string;
  truncated: boolean;
}

/** Truncates text to a byte budget (UTF-8), matching MAX_FILE_CONTENT_BYTES semantics. */
export function truncateToBytes(text: string, maxBytes: number): TruncatedText {
  const buf = Buffer.from(text, "utf8");
  if (buf.byteLength <= maxBytes) {
    return { text, truncated: false };
  }
  return { text: buf.subarray(0, maxBytes).toString("utf8"), truncated: true };
}
