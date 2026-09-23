# Bitbucket Webhook Payload Spec (PR 이벤트 기준)

> Bitbucket Data Center 기준. Cloud와 필드명이 다를 수 있으므로 실제 연동 전 사내 Bitbucket에서 webhook payload 샘플을 한 번 캡처해 검증 필요.

## 주요 필드

| 필드 | 설명 |
|---|---|
| `eventKey` | 이벤트 종류 (예: `pr:opened`, `pr:modified`) |
| `pullRequest.id` | PR 번호 |
| `pullRequest.title`, `pullRequest.description` | PR 제목/설명 |
| `pullRequest.state` | OPEN / MERGED / DECLINED |
| `pullRequest.author.user.name`, `displayName` | 작성자 |
| `pullRequest.fromRef.displayId`, `fromRef.latestCommit` | 소스 브랜치/커밋 |
| `pullRequest.toRef.displayId`, `toRef.latestCommit` | 대상 브랜치/커밋 |
| `pullRequest.toRef.repository.project.key` | projectKey (MCP tool 호출 시 필요) |
| `pullRequest.toRef.repository.slug` | repositorySlug (MCP tool 호출 시 필요) |
| `pullRequest.createdDate`, `updatedDate` | 생성/수정 시각 (epoch millis) |
| `actor.name` | 이벤트를 발생시킨 사용자 |

## ⚠️ 핵심 주의사항

**webhook payload 자체에는 diff 본문이 없음.** Spring은 payload에서 `projectKey`, `repositorySlug`, `pullRequest.id`만 추출해 MCP tool(`get_pr_metadata`, `get_pr_diff` 등)을 통해 나머지 정보를 재조회해야 함.

## Spring에서 추출해 MCP 호출에 사용할 최소 필드

```json
{
  "projectKey": "pullRequest.toRef.repository.project.key",
  "repositorySlug": "pullRequest.toRef.repository.slug",
  "pullRequestId": "pullRequest.id"
}
```
