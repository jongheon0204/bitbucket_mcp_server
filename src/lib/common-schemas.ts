import { z } from "zod";

export const projectKeySchema = z.string().min(1).describe("Bitbucket 프로젝트 키");
export const repositorySlugSchema = z.string().min(1).describe("저장소 slug");
export const pullRequestIdSchema = z.number().int().positive().describe("PR 번호");

export const prRefSchema = {
  projectKey: projectKeySchema,
  repositorySlug: repositorySlugSchema,
  pullRequestId: pullRequestIdSchema,
};

export const errorShape = {
  code: z.enum(["AUTH_ERROR", "NOT_FOUND", "RATE_LIMITED", "UPSTREAM_ERROR", "VALIDATION_ERROR"]),
  message: z.string(),
};
