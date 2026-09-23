# get_pr_metadata

## 목적
PR의 최신 제목/설명/브랜치/작성자/상태를 조회한다. webhook payload는 스냅샷이라 신뢰성이 낮으므로, Spring이 AI 호출 전 초기 컨텍스트를 결정적으로 준비하기 위해 사용한다.

## Bitbucket API 매핑
`GET {BITBUCKET_BASE_URL}/rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}`

## Input
| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| projectKey | string | Y | Bitbucket 프로젝트 키 |
| repositorySlug | string | Y | 저장소 slug |
| pullRequestId | number | Y | PR 번호 |

## Output
| 필드 | 타입 | 설명 |
|---|---|---|
| title | string | PR 제목 |
| description | string | PR 설명 |
| author | string | 작성자 displayName |
| sourceBranch | string | 소스 브랜치 |
| destBranch | string | 대상 브랜치 |
| state | string | OPEN / MERGED / DECLINED |

## 에러 케이스
- PR 없음 → `NOT_FOUND`
- 권한 없음 → `AUTH_ERROR`

## 호출 주체
Spring (오케스트레이션 초기 단계, 결정적 흐름)
