# get_file_diffs

## 목적
`list_changed_files`로 얻은 파일 경로 배열을 입력받아, 여러 파일의 diff(hunk 목록)를 한 번의 MCP tool-call로 반환하는 batch tool.

**`get_file_diff`와의 차이점**
- `get_file_diff`: 파일 1개 = tool-call 1회. 파일 수만큼 AI ↔ MCP 왕복이 발생한다.
- `get_file_diffs`: 파일 N개 = tool-call 1회. AI가 분석 대상 파일을 먼저 골라 한 번에 요청하므로 왕복 횟수와 tool-call 오버헤드가 줄어든다.
- 단건 정밀 조회(특정 파일만 재확인)는 계속 `get_file_diff`를 사용한다.

## Bitbucket API 매핑
`GET {BITBUCKET_BASE_URL}/rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/diff/{filePath}`

- 내부적으로 **파일 수(N)만큼 N회** 호출한다 (Bitbucket에 다중 파일 diff API가 없음). 줄어드는 것은 MCP tool-call 횟수이지 Bitbucket REST 호출 횟수가 아니다.
- 호출은 병렬로 수행하되 rate limit(429) 방지를 위해 동시 실행 수를 제한한다.

## Input
| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| projectKey | string | Y | Bitbucket 프로젝트 키 |
| repositorySlug | string | Y | 저장소 slug |
| pullRequestId | number | Y | PR 번호 |
| filePaths | string[] | Y | `list_changed_files` 결과의 path 배열 (1~20개, 중복 경로는 1회만 조회) |

## Output
| 필드 | 타입 | 설명 |
|---|---|---|
| diffs | array | 파일별 diff 결과 (입력 `filePaths` 순서 유지) |
| diffs[].filePath | string | 파일 경로 |
| diffs[].hunks | array | diff hunk 목록 (실패 시 빈 배열) |
| diffs[].hunks[].oldLines | array | 변경 전 라인 |
| diffs[].hunks[].newLines | array | 변경 후 라인 |
| diffs[].truncated | boolean | 파일당 `MAX_FILE_CONTENT_BYTES` 초과로 잘렸는지 여부 |
| diffs[].error | object \| null | 파일 단위 실패 시 `{ code, message }`, 성공 시 `null` |
| succeeded | number | 성공한 파일 수 |
| failed | number | 실패한 파일 수 |

## 예상 토큰 사용량
diff 본문 토큰은 개별 호출과 동일하고, 차이는 tool-call 오버헤드(tool_use 입력 JSON + tool_result 래퍼 + 호출 사이 AI 추론 턴)에서 발생한다.

| 기준 (파일 10개) | tool-call 횟수 | 오버헤드 추정 |
|---|---|---|
| `get_file_diff` 개별 호출 | 10회 | 약 1,000 토큰 (호출당 약 100) |
| `get_file_diffs` 1회 | 1회 | 약 250 토큰 (기본 100 + 경로당 약 15) |

→ 파일 10개 기준 `get_file_diff` 개별 호출 대비 tool-call 오버헤드 **약 75% 감소**, AI ↔ MCP 왕복 10회 → 1회.
(호출당 오버헤드 수치는 추정치이며 실제 값은 모델·프롬프트 구성에 따라 달라진다.)

## 에러 케이스
- `filePaths` 비어 있음 또는 20개 초과 → `VALIDATION_ERROR` (호출 전체 실패)
- PR 없음 → `NOT_FOUND` (호출 전체 실패)
- 권한 없음 → `AUTH_ERROR` (호출 전체 실패)
- 일부 파일 경로 오류 → 해당 항목만 `diffs[].error.code = "NOT_FOUND"`, 나머지 파일은 정상 반환 (부분 성공)
- 일부 파일 재시도 후에도 5xx/타임아웃 → 해당 항목만 `diffs[].error.code = "UPSTREAM_ERROR"`
- 재시도 정책은 `error-handling.md`를 파일별로 동일하게 적용

## 호출 주체
AI (자율 호출 — `list_changed_files` 결과를 보고 분석할 파일을 선별한 뒤 한 번에 요청)
