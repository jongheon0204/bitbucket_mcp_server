# Environment Configuration

## 필수 환경 변수

| 변수명 | 설명 | 예시 |
|---|---|---|
| `BITBUCKET_BASE_URL` | Bitbucket Data Center 사내 URL (망분리 환경) | `https://bitbucket.internal.company.com` |
| `BITBUCKET_HTTP_ACCESS_TOKEN` | Data Center HTTP access token. **Bearer 인증 전용**, Basic auth 사용 금지 | (secret) |
| `MAX_FILE_CONTENT_BYTES` | `get_file_content` 응답 최대 크기. 초과 시 truncated 처리 | `51200` (약 50KB, ~12,000 토큰 근거) |

## 선택 환경 변수

| 변수명 | 설명 | 기본값 |
|---|---|---|
| `MCP_TRANSPORT` | `stdio`(POC) 또는 `http`(이후 전환) | `stdio` |
| `BITBUCKET_API_TIMEOUT_MS` | Bitbucket API 호출 타임아웃 | `10000` |
| `RETRY_MAX_ATTEMPTS` | 5xx/429 재시도 횟수 | `3` |

## 인증 방식 유의사항

Bitbucket Data Center HTTP access token은:
- Git over HTTPS 및 REST API 인증 겸용 가능
- 웹 UI 로그인 불가, 사용자 대신 변경 작업(토큰 생성 등) 불가
- 프로젝트/레포지토리 레벨 토큰은 **Bearer 인증만 가능** (Basic auth에 사용 불가)

## .env.example

```
BITBUCKET_BASE_URL=https://bitbucket.internal.company.com
BITBUCKET_HTTP_ACCESS_TOKEN=
MAX_FILE_CONTENT_BYTES=51200
MCP_TRANSPORT=stdio
BITBUCKET_API_TIMEOUT_MS=10000
RETRY_MAX_ATTEMPTS=3
```
