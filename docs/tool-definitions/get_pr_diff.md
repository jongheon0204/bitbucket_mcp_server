# get_pr_diff

## 목적
PR 전체의 unified diff를 조회한다. 변경 규모가 작은 PR에서 빠르게 전체 맥락을 파악할 때 사용. 대용량 PR에서는 `get_file_diff`로 대체 권장.

## Bitbucket API 매핑
`GET {BITBUCKET_BASE_URL}/rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/diff`

## Input
| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| projectKey | string | Y | |
| repositorySlug | string | Y | |
| pullRequestId | number | Y | |

## Output
| 필드 | 타입 | 설명 |
|---|---|---|
| diff | string | unified diff 전체 텍스트 |
| truncated | boolean | 응답 크기 제한으로 잘렸는지 여부 |

## 에러 케이스
- PR 없음 → `NOT_FOUND`
- diff 크기 과다 → `truncated: true`로 응답 (실패 아님, AI가 `list_changed_files`로 전환하도록 유도)

## 호출 주체
AI (자율 판단, 소규모 PR에 한해 우선 사용 권장)
