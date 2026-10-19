# MCP 클라이언트 설정 가이드 (mcp.json)

AI Pro, VS Code 등 MCP 클라이언트에 bitbucket-mcp-server를 등록하는 방법이다.
로컬 실행(`pnpm exec tsx --env-file=.env src/index.ts`)이 성공한 상태를 전제로 한다.

## 동작 방식

```
MCP 클라이언트 (mcp.json을 읽음)
   │ ① mcp.json의 command + args로 서버 프로세스를 직접 띄움
   │    이때 env 블록 값을 환경변수로 주입 (.env 파일은 사용 안 함)
   ▼
bitbucket-mcp-server (node 프로세스)
   │ ② stdin/stdout으로 JSON-RPC 통신 (tool 목록 조회, tool 호출)
   ▼
Bitbucket Data Center REST API
```

- 서버를 사람이 미리 띄워 둘 필요 없다. 클라이언트가 필요할 때 띄우고 종료한다.
- 토큰은 서버 기동 시 env로 1회 전달된다. AI에게는 전달되지 않는다.

## 1단계. 빌드

```powershell
cd D:\sfmi_project\workspace\bitbucket_mcp_server
pnpm build
```

`dist\index.js` 파일이 생겼는지 확인한다. 코드를 수정하면 다시 빌드해야 반영된다.

## 2단계. mcp.json 작성

### 표준 형식 (`mcpServers`) — Claude Desktop, Cursor 등 대부분의 클라이언트

```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "node",
      "args": ["D:/sfmi_project/workspace/bitbucket_mcp_server/dist/index.js"],
      "env": {
        "BITBUCKET_BASE_URL": "https://bitbucket.사내도메인.com",
        "BITBUCKET_HTTP_ACCESS_TOKEN": "발급받은_토큰",
        "MAX_FILE_CONTENT_BYTES": "51200",
        "BITBUCKET_API_TIMEOUT_MS": "10000",
        "RETRY_MAX_ATTEMPTS": "3"
      }
    }
  }
}
```

### VS Code 형식 (`.vscode/mcp.json`)

VS Code는 최상위 키가 `servers`이고 `type`을 적는다. `envFile`로 `.env`를 그대로 쓸 수도 있다.

```json
{
  "servers": {
    "bitbucket": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/dist/index.js"],
      "envFile": "${workspaceFolder}/.env"
    }
  }
}
```

사용하는 클라이언트가 어느 형식인지는 해당 클라이언트 문서에서 확인한다. 어느 형식이든 `command` / `args` / `env` 의미는 같다.

## 3단계. 작성 규칙 (가장 많이 틀리는 부분)

| 항목 | 규칙 | 틀린 예 → 맞는 예 |
|---|---|---|
| 경로 구분자 | JSON에서 `\`는 특수문자. `/`를 쓰거나 `\\`로 두 번 적는다 | `D:\sfmi\...` → `D:/sfmi/...` |
| 경로 | 절대경로로 적는다 (클라이언트의 작업 폴더가 프로젝트 폴더가 아님) | `dist/index.js` → `D:/.../dist/index.js` |
| env 값 | 숫자도 문자열로 따옴표 안에 적는다. 단위·설명을 붙이지 않는다 | `51200 (약 50KB)` → `"51200"` |
| env 생략 | 선택 항목(`MAX_FILE_CONTENT_BYTES` 등)은 줄을 통째로 빼면 기본값 적용 | `"MAX_FILE_CONTENT_BYTES": ""` → 줄 삭제 |
| BASE_URL | `https://` 포함, `/rest/api/...`는 붙이지 않는다 | `bitbucket.사내도메인.com` → `https://bitbucket.사내도메인.com` |

### command에 `pnpm run`을 쓰지 말 것

```json
"command": "pnpm", "args": ["run", "dev"]
```

위처럼 쓰면 동작하지 않는다. `pnpm run`은 실행 전에 `> bitbucket-mcp-server@0.1.0 dev` 같은 안내 문구를
stdout에 출력하는데, MCP는 stdout을 JSON-RPC 통신 채널로 쓰기 때문에 클라이언트가 응답을 해석하지 못한다.
반드시 `node`로 직접 실행한다.

빌드 없이 TypeScript 소스를 바로 쓰고 싶다면(개발 중에만) tsx를 node로 직접 실행한다.

```json
"command": "node",
"args": [
  "D:/sfmi_project/workspace/bitbucket_mcp_server/node_modules/tsx/dist/cli.mjs",
  "D:/sfmi_project/workspace/bitbucket_mcp_server/src/index.ts"
]
```

### node를 찾지 못할 때

클라이언트가 `node`를 못 찾으면(`spawn node ENOENT`) 전체 경로를 적는다.

```powershell
(Get-Command node).Source    # 예: C:\Program Files\nodejs\node.exe
```

```json
"command": "C:/Program Files/nodejs/node.exe"
```

## 4단계. 연결 확인

1. 클라이언트를 재시작한다 (mcp.json은 보통 시작 시 1회 읽음).
2. 클라이언트의 MCP 서버 목록에서 `bitbucket`이 연결됨 상태인지 확인한다.
3. tool이 **9개** 보이는지 확인한다.
   `get_pr_metadata`, `list_changed_files`, `get_pr_diff`, `get_file_diff`, `get_file_content`,
   `get_pr_comments`, `post_pr_comment`, `get_file_diffs`, `get_pr_context`
4. 실제 PR로 조회 tool을 호출해 본다. 예: "PRJ 프로젝트 repo 저장소 1번 PR의 get_pr_context 결과를 보여줘"
   - `post_pr_comment`는 실제 PR에 댓글이 달리므로 테스트용 PR에서만 호출한다.

## 문제 해결

서버 로그는 stderr로 출력되며, 클라이언트의 MCP 로그 화면(VS Code는 OUTPUT 패널 → MCP 서버 선택)에서 볼 수 있다.

| 증상 / 로그 | 원인 | 조치 |
|---|---|---|
| `BITBUCKET_BASE_URL is required` | env 블록 누락 또는 키 오타 | 2단계 env 블록 확인 |
| `Expected number, received nan` | 숫자 항목에 단위·설명이 붙음 | 숫자만 남기거나 줄 삭제 |
| `spawn node ENOENT` | 클라이언트가 node를 못 찾음 | `command`에 node.exe 전체 경로 |
| `Cannot find module ...dist/index.js` | 빌드 안 됨 또는 경로 오류 | 1단계 빌드, 절대경로 확인 |
| 연결 직후 끊김 / 응답 파싱 오류 | `pnpm run` 사용 등으로 stdout 오염 | `node`로 직접 실행 |
| tool 호출 시 `AUTH_ERROR` | 토큰 오류·만료·권한 부족 | 토큰 재발급, 저장소 읽기 권한 확인 |
| tool 호출 시 `fetch failed` (`SELF_SIGNED_CERT_IN_CHAIN` 등) | 사내 CA 인증서를 Node가 신뢰하지 않음 | `env`에 `"NODE_EXTRA_CA_CERTS": "D:/certs/사내루트CA.pem"`. 임시로는 `"BITBUCKET_TLS_REJECT_UNAUTHORIZED": "false"` (`docs/env-config.md` HTTPS 인증서 참고) |
| tool 호출 시 `UPSTREAM_ERROR` (timeout) | 사내망에서 Bitbucket 접근 불가 | 브라우저로 BASE_URL 접속 확인, 프록시 설정 확인 |

## 보안 주의

- mcp.json의 `env`에는 토큰이 평문으로 들어간다. **mcp.json을 git에 커밋하지 않는다.**
  프로젝트 안(`.vscode/mcp.json`)에 둘 경우 토큰은 `envFile`로 `.env`(gitignore 대상)에서 읽게 한다.
- 토큰은 읽기 권한 위주로 최소 권한만 부여한다. `post_pr_comment`를 쓰려면 PR 댓글 작성 권한이 추가로 필요하다.

## Spring 연동 시

Spring이 MCP 클라이언트 역할을 하면 mcp.json 대신 Spring 설정에서 같은 값(command, args, env)을 지정한다.
토큰은 `application.yml`에 직접 적지 말고 사내 secret 저장소나 환경변수에서 주입한다.
