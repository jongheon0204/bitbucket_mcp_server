# get_file_content

## 목적
diff만으로 맥락 파악이 어려울 때, 특정 커밋 시점의 파일 전체 내용을 조회한다.

## Bitbucket API 매핑
`GET {BITBUCKET_BASE_URL}/rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/browse/{filePath}?at={commitHash}`

## Input
| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| projectKey | string | Y | |
| repositorySlug | string | Y | |
| filePath | string | Y | |
| commitHash | string | Y | 조회할 커밋 (보통 PR의 source commit) |

## Output
| 필드 | 타입 | 설명 |
|---|---|---|
| content | string | 파일 전체 내용 |
| encoding | string | 인코딩 |
| truncated | boolean | `MAX_FILE_CONTENT_BYTES` 초과로 잘렸는지 여부 |

## 크기 제한 정책
- `env-config.md`의 `MAX_FILE_CONTENT_BYTES`(기본 50KB) 초과 시 앞부분만 반환하고 `truncated: true`
- 초과분이 필요하면 AI는 `get_file_diff`로 대체 조회

## 에러 케이스
- 파일/커밋 없음 → `NOT_FOUND`
- 바이너리 파일 → `VALIDATION_ERROR` (텍스트만 지원)

## 호출 주체
AI (diff만으로 판단 어려운 경우에 한해 제한적으로 사용)
