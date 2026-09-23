# Error Handling Policy

## Bitbucket API 호출 실패

| 상황 | 처리 방침 |
|---|---|
| 401 / 403 | 즉시 실패 응답 (토큰 만료/권한 부족), 재시도 안 함. MCP 응답에 `error: "AUTH_ERROR"` 포함 |
| 404 | PR/파일/리소스 없음. 재시도 안 함. `error: "NOT_FOUND"` |
| 429 (rate limit) | 지수 백오프로 최대 3회 재시도 (1s → 2s → 4s) |
| 타임아웃 / 5xx | 최대 2회 재시도 후 실패 응답. `error: "UPSTREAM_ERROR"` |

## 대용량 파일/diff 처리 (get_file_content, get_file_diff)

- 파일당 `MAX_FILE_CONTENT_BYTES`(기본 51200, 약 50KB) 초과 시 전체 대신 앞부분만 반환하고 `truncated: true` 플래그 포함
- 초과분은 AI가 필요 시 `get_file_diff`로 hunk 단위 재조회하도록 유도

## MCP Tool 공통 에러 응답 포맷

```json
{
  "success": false,
  "error": {
    "code": "AUTH_ERROR | NOT_FOUND | RATE_LIMITED | UPSTREAM_ERROR | VALIDATION_ERROR",
    "message": "사람이 읽을 수 있는 설명"
  }
}
```

## 로깅

- 모든 tool 호출: `toolName`, `params`(민감정보 마스킹), `durationMs`, `success` 기록
- 실패 시 upstream 응답 status/body 일부(500자 이내) 함께 기록
