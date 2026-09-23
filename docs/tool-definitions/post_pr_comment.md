# post_pr_comment

## 목적
처리 결과(예: 생성된 테스트케이스 요약, 사내 wiki 업로드 링크)를 PR에 텍스트 코멘트로 등록한다.

> 참고: Bitbucket Data Center는 댓글에 파일(엑셀 등) 직접 첨부를 지원하지 않으므로, 엑셀 산출물은 wiki 업로드 후 **링크만 이 tool로 댓글에 남기는 방식**을 사용한다.

## Bitbucket API 매핑
`POST {BITBUCKET_BASE_URL}/rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/comments`

## Input
| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| projectKey | string | Y | |
| repositorySlug | string | Y | |
| pullRequestId | number | Y | |
| content | string | Y | 코멘트 본문 (wiki 링크 포함 가능) |

## Output
| 필드 | 타입 | 설명 |
|---|---|---|
| commentId | number | 생성된 코멘트 ID |
| createdDate | string | 생성 시각 |

## 에러 케이스
- PR 없음 → `NOT_FOUND`
- 권한 없음 → `AUTH_ERROR`

## 호출 주체
Spring (흐름의 마지막 확정 동작, 결정적 처리 — 실패 시 재시도/로깅 제어를 위해 AI가 아닌 Spring이 직접 실행)
