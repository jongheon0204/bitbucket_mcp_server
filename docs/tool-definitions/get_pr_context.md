# get_pr_context

## 목적
`get_pr_metadata`와 `list_changed_files` 두 tool의 결과를 하나로 합쳐 반환하는 컨텍스트 통합 tool.
Spring이 AI Pro를 최초 호출하기 전에 초기 컨텍스트(PR 최신 정보 + 변경 파일 목록)를 **1회 조회**로 준비하기 위해 사용한다.
AI는 변경 파일 목록을 이미 받은 상태로 시작하므로 `list_changed_files` 호출 없이 바로 diff 탐색(`get_file_diffs` 등)에 들어갈 수 있다.

## Bitbucket API 매핑
내부적으로 **2회**의 Bitbucket REST API를 병렬 호출한다.

1. `GET {BITBUCKET_BASE_URL}/rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}` (메타데이터)
2. `GET {BITBUCKET_BASE_URL}/rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/changes` (변경 파일 목록)

- 변경 파일 수가 `/changes` 응답의 페이지 크기를 넘으면 2번 호출이 페이지 수만큼 추가된다.

## Input
| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| projectKey | string | Y | Bitbucket 프로젝트 키 |
| repositorySlug | string | Y | 저장소 slug |
| pullRequestId | number | Y | PR 번호 |

## Output
| 필드 | 타입 | 설명 |
|---|---|---|
| metadata | object | `get_pr_metadata` Output과 동일 |
| metadata.title | string | PR 제목 |
| metadata.description | string | PR 설명 |
| metadata.author | string | 작성자 displayName |
| metadata.sourceBranch | string | 소스 브랜치 |
| metadata.destBranch | string | 대상 브랜치 |
| metadata.state | string | OPEN / MERGED / DECLINED |
| files | array | `list_changed_files` Output의 `files`와 동일 |
| files[].path | string | 파일 경로 |
| files[].status | string | ADDED / MODIFIED / DELETED |
| files[].additions | number | 추가된 라인 수 |
| files[].deletions | number | 삭제된 라인 수 |
| summary.totalFiles | number | 변경 파일 수 |
| summary.totalAdditions | number | 전체 추가 라인 수 |
| summary.totalDeletions | number | 전체 삭제 라인 수 |

## 예상 토큰 사용량
응답 본문 토큰은 두 tool 결과의 합과 같고(`summary` 약 20 토큰 추가), 차이는 호출 횟수에서 발생한다.

| 기준 | Spring → MCP 호출 | AI tool-call | 오버헤드 추정 |
|---|---|---|---|
| 기존: Spring `get_pr_metadata` + AI `list_changed_files` | 1회 | 1회 | AI 측 약 100 토큰 + 추론 턴 1회 |
| `get_pr_context` | 1회 | 0회 | AI 측 0 토큰 |

→ 기존 개별 tool 2회 호출 대비 MCP 호출 **50% 감소**(2회 → 1회), AI agentic loop의 첫 tool-call 1회(약 100 토큰 + 추론 턴)가 제거된다.
(오버헤드 수치는 추정치이며 실제 값은 모델·프롬프트 구성에 따라 달라진다.)

## 에러 케이스
- PR 없음 → `NOT_FOUND`
- 권한 없음 → `AUTH_ERROR`
- 재시도 후에도 5xx/타임아웃 → `UPSTREAM_ERROR`
- 두 API 중 하나라도 실패하면 **전체 실패**로 응답 (부분 결과 반환 안 함 — Spring이 불완전한 컨텍스트로 AI를 호출하지 않도록)

## 호출 주체
Spring (결정적 호출 — webhook 수신 후 AI Pro 최초 호출 직전 1회 실행, 기존 `get_pr_metadata` 단계를 대체)
