# 로컬 Supabase 전환 검증 결과 — 2026-11-03

브랜치 hotfix/privacy-p0, 시작/종료 HEAD 9b1f9e1c53f706883be74421078c3b5a2bd40b36. 이번 변경은 미커밋 상태다.
Main/Demo/운영 백업은 변경하지 않았다. 운영 접속, push, 배포, 시스템 프로그램 설치는 하지 않았다.

## 이번에 실제 실행한 검사

| 검사 | 결과 |
| --- | --- |
| Hotfix 전체 Node 회귀/SDK 모의/로컬 환경 안전장치 | 72 성공 / 0 실패 / 0 건너뜀 |
| 신규 로컬 환경 안전장치 | 위 72개 중 6개: endpoint, Docker context/포트, SDK transport, CI, Vercel branch rule, UI env 격리 |
| 기존 PG17.6 + 실제 PostgREST + 실제 pg_graphql | 334 성공 / 0 실패, 가짜 데이터, automatic grants ON |
| 실제 Next 서버 시작 환경 거절 | 3 성공 / 0 실패 |
| TypeScript | 0 오류, 두 빌드 후에도 통과 |
| ESLint 전체 | 0 오류 / 기존 no-img-element 경고 12개 |
| 외부 통신 차단 build, privacy flag OFF / ON | 둘 다 성공 |
| 민감정보 검사 | 소스 179개, 발견 0 (이 결과 문서 추가 전 수치) |
| git diff --check | 통과 |
| local:start 사전 조건 실패 동작 | CLI/Docker 부재 상태에서 고정 STOP으로 종료, DB 접속 없음 |

원본 PostgreSQL 17.6 공식 zip과 기존 native pg_graphql/PostgREST 자산을 재사용했다. 설치·실제 회원정보·운영 백업 복원이 없다. 종료 후 lab PostgreSQL/PostgREST 프로세스가 0개임을 확인했다.
010-privacy-minimal.sql SHA-256는 bea86d888eea295c5ef092b2fa0f39955d494cf4b81a304615cf3079be57ed98로 유지했다.

## 실행하지 못한 검사

- 전체 로컬 Supabase Auth/PostgreSQL/REST/GraphQL/Storage 통합: Docker/CLI 미설치로 실행하지 못함. tests 72개의 건너뜀 0이라는 수치에 이 미실행 통합 검사를 포함하지 않는다.
- 새 local:dev 실제 UI 실행: 동일한 이유로 미실행.
- GitHub Actions: push하지 않아 원격 실행 미검증. 새 local-supabase job의 실제 image/config/SQL guard 호환성도 미검증이다. 실패를 무시하는 옵션은 없다.
- Vercel 원격 Git 배포 차단 효과: vercel.json 구조와 브랜치 범위만 로컬 검증. 원격 설정/실제 배포 이벤트는 미검증.
- GitHub OAuth 실제 왕복: 별도 Test App 및 로컬 provider 설정 전이므로 미검증. SDK URL/모의 세션 테스트와 혼동하지 않는다.

현재 판단: 로컬 준비 파일과 기존 격리 검증은 완료. Docker 전체 통합/원격 CI/OAuth/운영 배포 준비는 조건부 대기. 운영 SQL 적용은 NO-GO. 운영 정책을 바꾸지 않았으므로 Critical 3 / High 5는 계속 남는다.
사용자 실행 순서는 LOCAL_SUPABASE_PLAN.md를 따른다. PC 설치를 보류하고 GitHub CI만 사용할 수도 있지만, 별도 commit/push 승인이 필요하고 Git 자동 배포 차단을 포함한 커밋이어야 한다.
