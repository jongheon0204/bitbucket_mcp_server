# bitbucket-mcp-server 프로젝트 산출물

이 폴더는 Claude.ai 채팅에서 설계·검토한 문서를 Claude Code 개발 시작점으로 전달하기 위한 산출물입니다.
`docs/` 폴더를 프로젝트 루트에 그대로 두고 Claude Code를 시작하면, 별도 설명 없이 이 문서들을 컨텍스트로 참조해 구현을 진행할 수 있습니다.

## ⚠️ 중요: Bitbucket 배포 형태 확정 사항

대화 중 확인된 대로, 귀하의 환경은 **Bitbucket Cloud가 아닌 Bitbucket Data Center**입니다 (망분리 정책상 사내 자체 URL 접속, HTTP access token 사용).
이에 따라 이전 논의에서 사용했던 Cloud 방식 파라미터(`workspace`, `repo_slug`)를 **Data Center 방식(`projectKey`, `repositorySlug`, `pullRequestId`)으로 정정**하여 아래 tool 정의서에 반영했습니다.

- Base API: `{BITBUCKET_BASE_URL}/rest/api/1.0/`
- 인증: `Authorization: Bearer {BITBUCKET_HTTP_ACCESS_TOKEN}` (Basic auth 불가)

## 폴더 구조

```
bitbucket-mcp-server/
├── README.md
└── docs/
    ├── architecture.md
    ├── webhook-payload-spec.md
    ├── error-handling.md
    ├── env-config.md
    └── tool-definitions/
        ├── get_pr_metadata.md
        ├── list_changed_files.md
        ├── get_pr_diff.md
        ├── get_file_diff.md
        ├── get_file_content.md
        ├── get_pr_comments.md
        └── post_pr_comment.md
```

## Claude Code 시작 시 제안 프롬프트

```
docs/ 폴더의 문서를 참고해서 bitbucket-mcp-server를 Node.js(TypeScript) + stdio 기반으로 구현해줘.
docs/tool-definitions/ 하위 문서 순서대로 tool을 하나씩 구현하고, 각 tool 구현 후 간단한 단위 테스트도 작성해줘.
```

## POC 일정 메모
- 목표: 11월 말까지 POC 완료 (Claude 작업 범위: Bitbucket MCP, Spring 서버, 일정/리스크 관리)
- 다음 단계: MCP tool 7종 구현 → Spring 연동 → webhook 플로우 e2e 테스트

## 구현 (Node.js + TypeScript, stdio)

`docs/` 산출물을 기반으로 `src/`에 MCP tool 7종을 구현했습니다.

```
src/
├── index.ts               # entrypoint: stdio transport로 McpServer 기동
├── config.ts               # env 로드/검증 (docs/env-config.md)
├── logger.ts                # stderr 전용 구조화 로깅 + 민감정보 마스킹
├── errors.ts                 # 공통 에러 코드/응답 포맷 (docs/error-handling.md)
├── bitbucketClient.ts          # Bearer 인증 fetch + 상태코드별 재시도 정책
├── lib/
│   ├── diff.ts                  # Bitbucket diff JSON → unified diff / hunk 변환
│   ├── pagination.ts             # start/nextPageStart/isLastPage 페이지네이션
│   ├── common-schemas.ts          # projectKey/repositorySlug/pullRequestId 공통 zod 스키마
│   └── register-tool.ts            # 공통 success/error 응답 envelope + 로깅 wrapper
└── tools/                            # get_pr_metadata 등 7개 tool (문서 1:1 대응)
```

### 실행

```bash
npm install
cp .env.example .env   # BITBUCKET_BASE_URL / BITBUCKET_HTTP_ACCESS_TOKEN 채우기
npm run build
npm start               # 또는 개발 중에는: npm run dev (tsx, 빌드 없이 실행)
```

Spring 등 stdio MCP 클라이언트는 `node dist/index.js`를 로컬 프로세스로 스폰해 stdin/stdout으로 통신합니다. 모든 로그는 stdout(JSON-RPC 채널) 오염을 피하기 위해 stderr로만 출력됩니다.

### 테스트

```bash
npm test          # vitest run (재시도/백오프, diff 파싱, tool별 성공/에러 케이스)
npm run typecheck
```

### 구현 시 참고/가정 사항 (실제 Bitbucket 연동 전 검증 필요)

- `get_pr_diff`/`get_file_diff`는 Bitbucket Data Center REST API의 diff 리소스(`{ diffs: [{ source, destination, hunks: [{ segments: [{ type, lines }] }] }] }`) 구조를 가정해 unified diff 텍스트/hunk 배열로 변환합니다. `docs/webhook-payload-spec.md`가 명시한 것처럼, 실제 사내 Bitbucket 응답으로 한 번 검증이 필요합니다.
- `list_changed_files`의 `additions`/`deletions`는 Bitbucket Server `/changes` 응답이 라인 증감 수를 안정적으로 포함하지 않는 경우가 많아, 값이 없으면 0으로 반환합니다(AI는 필요 시 `get_file_diff`로 보완).
- 재시도 정책은 `docs/error-handling.md`를 그대로 구현: 429는 `RETRY_MAX_ATTEMPTS`(기본 3) 지수 백오프(1s→2s→4s), 타임아웃/5xx는 문서에 명시된 대로 고정 2회 재시도.
- `MCP_TRANSPORT=http`는 아직 미구현이며(로드맵상 이후 작업), 설정 시 기동 단계에서 즉시 에러를 발생시킵니다.
