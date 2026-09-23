# Architecture

## 시스템 개요

```
Bitbucket Data Center
   │ webhook (PR 생성/업데이트 이벤트)
   ▼
Spring Server
   ├─ ① get_pr_metadata 호출 (초기 컨텍스트 확보, 결정적 처리)
   ├─ ② AI Pro 호출 (메타데이터 + 사용 가능한 MCP tool 목록 전달)
   │      │
   │      ▼
   │   AI Pro (agentic loop)
   │      ├─ list_changed_files
   │      ├─ get_pr_diff / get_file_diff (파일 단위, 대용량 대비)
   │      ├─ get_file_content (필요 시 맥락 파악)
   │      ├─ get_pr_comments (필요 시 기존 리뷰 참고)
   │      └─ 테스트케이스 JSON 반환 (output-schema 준수)
   │
   ├─ ③ AI 응답(JSON) → 엑셀 생성 (Spring 내부 로직, Apache POI 등)
   └─ ④ 엑셀을 사내 wiki에 업로드 (wiki REST API 직접 호출 또는 별도 wiki-mcp-server)
```

## 프로세스 단계별 근거

| 단계 | 주체 | 근거 |
|---|---|---|
| webhook 수신 | Bitbucket → Spring | webhook payload는 트리거 신호일 뿐 diff 본문이 없어, 이후 능동 조회가 필요 |
| get_pr_metadata | Spring | webhook payload는 스냅샷이라 신뢰성 낮음. AI 호출 전 결정적으로 최신 정보 확보 |
| AI 호출 | Spring → AI | 초기 컨텍스트 + tool 목록만 전달, 실제 탐색 범위는 AI가 diff 크기·복잡도에 따라 자율 판단 |
| tool 자율 호출 | AI | 대용량 diff를 한 번에 전달하면 토큰 낭비·컨텍스트 초과 위험 → 필요한 만큼만 탐색 (agentic loop) |
| 테스트케이스 생성 | AI | 구조화된 JSON 출력으로 후속 처리(엑셀 변환) 시 파싱 리스크 제거 |
| 엑셀 생성 | Spring (내부 로직) | 결정적 변환 작업이라 AI tool-calling 불필요, MCP 서버 책임 범위 밖 (Bitbucket 도메인 아님) |
| wiki 업로드 | Spring 또는 별도 wiki 연동 | bitbucket-mcp-server와 도메인이 다르므로 분리, 인증 체계도 별도 |

## 컴포넌트 책임 분리 원칙

- **bitbucket-mcp-server**: Bitbucket 리소스 접근 전담 (단일 책임, 도메인 분리)
- **Spring Server**: 오케스트레이션 — webhook 수신, AI 호출 전/후 결정적 흐름 제어, 엑셀 생성, wiki 업로드
- **AI Pro**: diff 분석 및 tool 자율 호출을 통한 비결정적 탐색, 테스트케이스 생성

## Transport 로드맵

- POC: stdio/stdout (Spring ↔ MCP 로컬 프로세스 통신)
- 이후: streamable HTTP로 전환 (다중 클라이언트, 원격 배포 대응)
