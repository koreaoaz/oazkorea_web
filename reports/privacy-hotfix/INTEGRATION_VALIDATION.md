# CI / 독립 Preview 통합 준비 검증 — 2026-11-03

최종 판정: **BLOCKED (실제 Push·Preview 실행)**. 코드·도구와 로컬 테스트는 준비했지만 일반 Preview가 운영 Main Supabase를 가리킨다는 사용자 확인이 있다. 새 전용 테스트 프로젝트의 실제 ref·키 소속·schema·OAuth·배포 보호가 확인되지 않았다. 원격 CI/Preview/OAuth는 미실행이고 운영 개인정보 SQL도 미적용이다. Critical 3 / High 5의 운영 위험은 남아 있다.

## 이번 코드/도구

- Main과 기존 Demo ref는 Preview 대상으로 차단. Demo의 Netlify/Auth/Storage/기존 데이터를 보존한다.
- effective process env에 있는 관련 Supabase/DB/PG/visitor 변수와 공개 alias·ref·flag를 검사한다. 주 URL만 덮어쓴 상태에서 남은 운영 alias/고권한 키/알 수 없는 connection 변수도 실패한다.
- audit:preview는 이름·존재·선언 target 일치 boolean만 출력한다. 값/decoded JWT/정책 원문을 출력하지 않고 원격 분리 검증 완료로 승격하지 않는다.
- 빌드·Next config·서버 시작·client 생성의 공통 guard와 process exit 보호를 유지한다. privilege 오류 시 전체 SELECT fallback은 없다.
- CI Windows isolated-postgres job에 공식 EDB 17.6 ZIP SHA-256 검증, 새 loopback cluster, automatic grants ON/OFF SQL 검사를 추가했다. Node mock/오프라인 빌드 검사는 기존 Ubuntu job에서 유지한다. 권한은 contents:read이고 artifact/backup/DB 로그 업로드가 없다.
- 020-test-environment-catalog.sql은 PG catalog의 구조/유효 권한만 읽고 ROLLBACK한다. fixture에서 검증했으며 Main/Demo 원격에는 실행하지 않았다.

## 이번 실행 결과

| 검사 | 결과 / 범위 |
| --- | --- |
| Hotfix 전체 Node 회귀 | 66 성공 / 0 실패 / 0 skip |
| Preview 전용 회귀 | 위 66개 중 16개, 중복 합산하지 않음 |
| 실제 Next startup 거부 | 3 성공 / 0 실패, loopback synthetic settings |
| PostgreSQL 17.6 SQL-only 자동권한 ON/OFF | 각각 144 성공 / 0 실패 (새 metadata collector 2건 포함) |
| PostgreSQL 17.6 + 실제 pg_graphql 1.6.3 + PostgREST 16.5 | 334 성공 / 0 실패 |
| TypeScript | 통과, Next 생성 타입 포함 |
| ESLint | 오류 0 / 기존 img 최적화 권고 12 |
| flag OFF/ON 외부 차단 빌드 | 둘 다 통과, 새 guard 반영 |
| CI YAML·hash pin·실패 중단·권한 검사 | 통과, 실제 원격 CI는 미실행 |
| 비밀정보/운영 산출물/diff 검사 | 통과, 최종 staged 검사도 수행 |

SQL-only CI와 같은 인수로 로컬에서 ON/OFF를 실행했다. 이 검사가 실제 Auth·HTTP·GraphQL까지 수행한다고 표시하지 않는다. 실제 native/HTTP suite는 별도 로컬 검증이다. 새 메타데이터 SELECT를 추가해 종전 332개보다 2건 증가했다. 실제 사용자/DB backup을 사용하지 않았다.

실행 로그는 Git 밖 OAZ-Main-Lab/preview-integration-*.log, preview-ci-pg-on.log, preview-ci-pg-off.log에 있다. 운영 010 계열 SQL 13개는 바이트 단위로 보존한다. Main/Demo 코드·기존 docs·Netlify link·백업 보존 상태를 해시로 확인한다. 검토한 신규 변경만 별도 Hotfix 로컬 커밋 대상으로 지정한다. Push·merge·Vercel 배포·운영/기존 Demo 접속·계정 생성은 하지 않는다.

새 원격 DB 스키마가 확인되지 않아 추측한 CREATE/ALTER를 제공하지 않았다. 별도 TEST_ENV_SCHEMA_PLAN.md에 필수 계약·미적용 변경 순서·managed Auth 주의점과 보류 조건을 기록했다. 020 query와 기존 010 preflight를 검토한 후에만 전용 프로젝트의 DDL을 승인/준비한다.
