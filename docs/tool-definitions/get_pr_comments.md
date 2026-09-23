# get_pr_comments

## 목적
기존 리뷰 코멘트를 조회해 컨텍스트를 보강한다 (선택적 사용 — 리뷰어가 이미 지적한 우려사항을 테스트케이스에 반영).

## Bitbucket API 매핑
`GET {BITBUCKET_BASE_URL}/rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/activities`
(활동 스트림에서 comment 타입만 필터링)

## Input
| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| projectKey | string | Y | |
| repositorySlug | string | Y | |
| pullRequestId | number | Y | |

## Output
| 필드 | 타입 | 설명 |
|---|---|---|
| comments | array | 코멘트 목록 |
| comments[].author | string | 작성자 |
| comments[].content | string | 코멘트 내용 |
| comments[].createdDate | string | 작성 시각 (ISO 8601) |

## 에러 케이스
- PR 없음 → `NOT_FOUND`

## 호출 주체
AI (optional, 필요 판단 시에만 호출)
