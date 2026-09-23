# get_file_diff

## 목적
파일 단위 diff(hunk 목록)를 조회한다. 대용량 PR에서 토큰 낭비 없이 필요한 파일만 청크 단위로 분석하기 위한 핵심 tool.

## Bitbucket API 매핑
`GET {BITBUCKET_BASE_URL}/rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/diff/{filePath}`

## Input
| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| projectKey | string | Y | |
| repositorySlug | string | Y | |
| pullRequestId | number | Y | |
| filePath | string | Y | `list_changed_files` 결과의 path |

## Output
| 필드 | 타입 | 설명 |
|---|---|---|
| filePath | string | 파일 경로 |
| hunks | array | diff hunk 목록 |
| hunks[].oldLines | array | 변경 전 라인 |
| hunks[].newLines | array | 변경 후 라인 |

## 에러 케이스
- 파일 없음/경로 오류 → `NOT_FOUND`

## 호출 주체
AI (`list_changed_files` 이후 파일별 순차 호출)
