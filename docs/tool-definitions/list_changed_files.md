# list_changed_files

## 목적
PR에서 변경된 파일 목록과 각 파일의 상태(added/modified/deleted), 증감 라인 수를 조회한다. AI가 대용량 diff를 파일 단위로 청크 탐색하기 위한 첫 진입점.

## Bitbucket API 매핑
`GET {BITBUCKET_BASE_URL}/rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/changes`

## Input
| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| projectKey | string | Y | |
| repositorySlug | string | Y | |
| pullRequestId | number | Y | |

## Output
| 필드 | 타입 | 설명 |
|---|---|---|
| files | array | 변경 파일 목록 |
| files[].path | string | 파일 경로 |
| files[].status | string | ADDED / MODIFIED / DELETED |
| files[].additions | number | 추가된 라인 수 |
| files[].deletions | number | 삭제된 라인 수 |

## 에러 케이스
- PR 없음 → `NOT_FOUND`

## 호출 주체
AI (자율 탐색 시작점)

## 사용 흐름 권장
`list_changed_files` → 파일별로 필요 시 `get_file_diff` 또는 `get_file_content` 순차 호출 (전체 diff를 한 번에 받지 않고 청크 처리)
