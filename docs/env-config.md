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
| `BITBUCKET_TLS_REJECT_UNAUTHORIZED` | `false`면 Bitbucket 요청의 HTTPS 인증서 검증을 끔 (`true`/`false`/`1`/`0`). 아래 "HTTPS 인증서" 참고 | `true` |

## 인증 방식 유의사항

Bitbucket Data Center HTTP access token은:
- Git over HTTPS 및 REST API 인증 겸용 가능
- 웹 UI 로그인 불가, 사용자 대신 변경 작업(토큰 생성 등) 불가
- 프로젝트/레포지토리 레벨 토큰은 **Bearer 인증만 가능** (Basic auth에 사용 불가)

## HTTPS 인증서 (사내 CA)

사내 CA나 SSL 검사 장비가 발급한 인증서를 Node가 신뢰하지 않으면 tool 호출이
`fetch failed`(원인 `SELF_SIGNED_CERT_IN_CHAIN` 등)로 실패한다. 권장 순서:

1. `NODE_EXTRA_CA_CERTS=사내루트CA.pem` — 사내 루트 인증서만 추가로 신뢰 (Node 20 포함 모든 버전)
2. `node --use-system-ca` — Windows 인증서 저장소 사용 (Node 22.15 이상)
3. `BITBUCKET_TLS_REJECT_UNAUTHORIZED=false` — 인증서 검증 자체를 끔 (**최후 수단**)

3번은 상대가 진짜 Bitbucket인지 확인하지 않으므로 중간자 공격 시 Bearer 토큰과 소스 diff가 노출될 수 있다.
이 서버의 Bitbucket 요청에만 적용되며(`NODE_TLS_REJECT_UNAUTHORIZED`처럼 프로세스 전체를 끄지 않음),
켜져 있으면 기동 시 `tls_verification_disabled` 경고 로그를 남긴다. 임시 테스트 용도로만 사용한다.

`NODE_EXTRA_CA_CERTS`는 Node 기동 시점에 읽히므로 `.env` 파일(`--env-file`)에 넣으면 적용되지 않는다.
mcp.json의 `env` 블록이나 실제 환경변수로 지정한다.

## .env.example

```
BITBUCKET_BASE_URL=https://bitbucket.internal.company.com
BITBUCKET_HTTP_ACCESS_TOKEN=
MAX_FILE_CONTENT_BYTES=51200
MCP_TRANSPORT=stdio
BITBUCKET_API_TIMEOUT_MS=10000
RETRY_MAX_ATTEMPTS=3
BITBUCKET_TLS_REJECT_UNAUTHORIZED=true
```
