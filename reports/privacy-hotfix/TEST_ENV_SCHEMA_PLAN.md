# Hotfix 독립 테스트 스키마·가짜 데이터 계획

## 현재 준비한 실행 가능 환경

기존 scripts/test-isolated-db.py, tests/fixtures/privacy.sql, privacy_v3_regression.py, privacy_http_regression.py, privacy_graphql_regression.py를 재사용한다. 도구는 새 임시 디렉터리·임의 loopback port·합성 데이터만 사용하고 외부 DSN/운영 자격증명을 받지 않는다. 기존 PostgreSQL 17.6, PostgREST 16.5, 실제 pg_graphql 1.6.3 파일을 무결성 검사 후 재사용한다. 기존 backup을 복원하지 않는다.

가짜 회원 A/B, 승인/미승인 이메일, 기존 관리자·최고관리자 후보·비활성 관리자, 후원자와 콘텐츠 행이 fixture에 있다. 익명/타 회원 조회, 권한 상승, 승인 가입, donor 최소 컬럼/쓰기, stale auth, 세션 만료, RPC 거부와 SQL 복구 후 보호 유지까지 검사한다. 테스트의 auth.users/identities는 모의 테이블이다. Hosted Supabase Auth에 그대로 복사할 SQL이 아니다.

## 현재 스키마 차이와 미적용 마이그레이션 순서

| 대상 | 근거/현재 차이 | 별도 준비 또는 승인 필요 |
| --- | --- | --- |
| 신규 테스트 Supabase | 아직 프로젝트/ref/설정 미확인 | 전용 프로젝트·가짜 데이터 전용 범위 확보 |
| 콘텐츠 7개 테이블 | fixture는 보안 최소 계약, 실제 폼은 추가 컬럼 사용 | 프로젝트 duration/category/year/semester/team_size/members/detailed_description/tech_stack/filename 등과 스터디 leader/year/semester/filename, 행사 filenames jsonb 등 타입·기본값을 승인된 스키마와 대조 |
| 회원/승인/관리자/후원 | Demo reference는 자체 정책·함수 계약, v3 RPC 미확인 | fresh test의 테이블/컬럼/고유키·own UUID 계약 검토 |
| Auth | Hosted는 관리형, fixture는 모의 | 독립 Auth의 GitHub identity/이메일 인증 구조 확인. 실제 테스트 사용자도 독립 프로젝트에서 별도 승인 후 생성 |
| 개인정보 v3 RPC | 기존 010 후보 재사용, Demo 적용 여부 없음 | fresh test의 preflight·함수 소유자/GRANT/extension 검증 후에만 010 적용 승인 |
| Storage | 기존 Demo public bucket은 보존 대상 | 새 프로젝트에 별도 테스트 bucket/가짜 이미지만 준비, upload/delete는 별도 승인 |
| GraphQL/Data API | 테스트 프로젝트의 exposed schema/버전 미확인 | 현재 010-api-guard 계약과 대조, 실제 wrapper/extension별 검사 |

적용하지 않은 단계별 변경안:

1. 신규 테스트 프로젝트에서 관리형 Auth/Storage를 유지하고, 앱 스키마의 컬럼/타입/constraints/RLS를 별도 검토한다. 020-test-environment-catalog.sql은 메타데이터 SELECT만 준비한 파일이며 이번에 원격 실행하지 않는다.
2. 모의 fixture나 운영 dump를 Hosted 프로젝트에 import하지 않는다. 검토된 테스트용 콘텐츠/프로필 스키마 DDL을 승인한 뒤에만 생성한다. 현재 원격 타입이 없으므로 완성된 범용 CREATE/ALTER SQL을 임의로 만들지 않는다.
3. 기존 검증된 010-preflight/010-privacy-minimal/010-postcheck를 별도 승인된 새 테스트 프로젝트에서만 사용한다. 기존 Demo에는 적용하지 않는다. 읽기 capability, donor/approval 쓰기는 별도 승인 계약이다.
4. Auth가 만든 가짜 사용자 UUID로 회원 A/B·승인·관리자·후원 테스트 데이터를 연결한다. 운영 UUID/개인정보를 복사하지 않는다.
5. exact OAuth callback과 공개키의 실제 소속을 확인한 후 flag OFF → 보호 DB → 필요한 승인 후 ON을 검사한다.

미확인 원격 스키마를 추측해 적용 가능한 마이그레이션으로 표시하지 않았다. 운영 적용 010 SQL 13개는 수정하지 않았다. 이 문서는 별도 스키마 변경안이며 자동 실행 기능은 없다.

## CI 격리 DB 범위

Windows job은 공식 EDB 17.6 archive의 SHA-256을 확인하고 설치 서비스 없이 임시 loopback cluster 두 개를 순차 실행한다(auto-grant ON/OFF). 실제 로컬에서 같은 인수로 검증한다. CI job은 SQL RLS/GRANT 검증이며 실제 Auth/REST/GraphQL 서비스 검증으로 표시하지 않는다. 실제 pg_graphql/PostgREST 332-check suite는 기존 로컬 전용 provenance-checked bundle로 별도 실행한다. 원격 CI에는 이 bundle이나 민감 산출물을 업로드하지 않는다.
