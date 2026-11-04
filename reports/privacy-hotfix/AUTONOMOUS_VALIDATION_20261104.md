# 개인정보 Hotfix 후속 리뷰·로컬 커밋 검증 — 2026-11-04

## 로컬 OAuth 최종 확정·테스트 공지 정리 — 2026-11-04

**LOCAL_COMPLETE / SECURITY_PASS(로컬) / 운영 NO-GO.** 사용자 직접 브라우저 확인과 자동 검사를 구분하여 확정했다. 이 단계 시작 HEAD는 abd5e20b5ffe7159a8331e481bf6295cfb58cfce, 브랜치는 hotfix/privacy-p0다. 앞선 계정 상세 조회 수정, OAuth 문서, 7개 테이블 콘텐츠 보호 SQL·테스트·CI 구성은 이미 이 커밋의 15개 파일에 반영되어 있었다. 중복 구현·중복 커밋하지 않는다. 시작 시 미추적 AGENTS.md만 있었고 사용자 파일로 보존한다. 이번에는 문서 확정 변경만 별도 로컬 커밋하며 최종 HEAD/상태는 build/privacy-review/OAUTH_LOCAL_COMPLETE_FINAL_STATE.md와 최종 응답에 기록한다.

### 사용자 직접 확인으로 확정된 브라우저 결과

사용자가 독립 GitHub Test App 인증, 승인 후 회원가입, 로그인 유지, 일반 회원 /editor 거절, 편집 권한 부여, 관리자 게시판 진입, 공지 등록과 메인 표시, 편집 권한 회수, **재로그인 없이 기존 세션의 /editor 거절**, 권한 회수 후 기존 공지 조회 유지를 모두 직접 확인했다고 보고했다. 이는 사용자 직접 관찰의 증거이며 Codex가 브라우저 인증을 대신 수행하거나 토큰을 수집한 결과가 아니다. 상태는 **OAUTH_BROWSER_VERIFIED_USER_ATTESTED**로 기록한다. 취소·명시적 로그아웃 등 별도 보고되지 않은 브라우저 분기까지 완료로 확대하지 않는다.

기존 서버 검사의 browserRoundTripAttested=false는 서버 명령만으로 브라우저 화면을 자동 증명하지 않는다는 뜻이며, 위 사용자 확인을 부정하는 값이 아니다. 과거 OAUTH_BROWSER_NOT_VERIFIED와 공지 보존 지시는 각 시점의 이력으로 남긴다.

### 테스트 공지 삭제: 정확히 1행

로컬 API·프로젝트·fixture provenance·기존/추가 SQL 해시를 확인했다. 사용자 지정 제목 **LOCAL OAuth 편집 권한 테스트**, public.editor_0_noti의 **id=34**가 정확히 1개였고 공지 전체 내용 지문도 직전 보안 검증 근거와 같았다. 작성자 열은 없지만 사용자 직접 작성 확인과 이전 관측, 단일 제목·ID·행 내용 지문으로 대상을 확정했다. 중복이나 원인 불명 행을 일괄 삭제하지 않았다.

사용자 지시에 따라 로컬 관리자 전용의 REPEATABLE READ 트랜잭션으로 id·제목·행 내용 지문이 모두 일치하는 1행만 삭제했다. 사용자 트리거·규칙·해당 공지를 참조하는 FK가 모두 0개임도 사전 확인했다. 삭제 건수가 1이 아니거나 다른 데이터 지문이 달라지면 전체 롤백하도록 했다. 보호 정책을 해제하거나 일반 회원 권한을 높이지 않았다.

| 항목 | 삭제 전 | 삭제 후 |
|---|---:|---:|
| 지정 테스트 제목 | 1 | 0 |
| 전체 공지 | 3 | 2 |
| 기존 synthetic one/two fixture | 2 | 2 |

같은 트랜잭션에서 다른 공지·Auth users/identities/sessions/audit_log_entries·회원·승인·supervisor 전체 행 지문이 동일함을 검증했다. 익명 REST 조회도 200/0행으로 제거를 재확인했다. **테스트 GitHub 회원, identity, 로그인 기록은 삭제하지 않았다.** 기존 테스트 공지를 남겨 둔다는 아래 과거 기록은 이번 명시적 삭제 지시로 변경됐다.

### 기존 검증 재사용과 현재 재검사

동일 기능 코드/SQL의 abd5e20 검증 기록을 확인했다. 실제 보안 통합 457 assertion·전체 회귀 168개·TypeScript 오류 0·ESLint 오류 0/기존 경고 12를 재사용한다. 이번 변경은 문서와 지정 테스트 행 삭제뿐이므로 무거운 전체 통합·OFF/ON 빌드·서버 시작/종료를 반복하지 않는다. 기존 코드/SQL/테스트/워크플로를 바꾸지 않았다.

현재 실행 중인 DB에서 기존 010 및 추가 콘텐츠 postcheck, 원본 보호 SQL 13개와 추가 SQL 2개의 무결성, 비밀정보 검사(220개 텍스트/실패 0), 현재 계정 verify를 재확인했다. githubIdentity/serverSignInRecorded/serverSessionPresent/memberPresent/approvalPresent=true, localEditorAssigned=false다. 가벼운 콘텐츠/CI 회귀 5개는 통과(실패·건너뜀 0)했고 문서 diff 공백 검사도 통과했다. 최종 결과는 커밋 후 상태 기록에도 남긴다. 과거 457·168 결과를 이번 새 실행으로 계산하거나 합산하지 않는다.

### 릴리스 계획 보완 및 CI

RUNBOOK 단계표와 실제 담당자 순서에 **010 적용·postcheck 뒤, flag ON 빌드 전 콘텐츠 보호 적용·postcheck**를 명시했다. 추가안의 로컬 fixture 선언을 운영에서 흉내 내어 실행하는 것은 금지다. 운영 스키마/정책/ACL/역할/뷰/함수·트리거 조사와 별도 대상 seal·해시·승인을 갖춘 운영용 변경안이 먼저 필요하다.

기존 010과 추가 SQL은 각각 자체 트랜잭션이므로 원문을 중첩 BEGIN으로 이어 붙이지 않는다. 두 적용 사이 일반 콘텐츠 쓰기 공백은 승인된 서버 측 쓰기 차단/점검 창으로 통제해야 한다. 이를 보장할 수 없거나 기존 관리자의 정상 CRUD를 검증할 수 없으면 OFF 호환 배포부터 시작하지 않는다. 추가 적용 실패 시 ON 빌드로 진행하지 않고 쓰기 차단을 유지한다. 기존 정책 삭제·GRANT 확대·privileged key로 우회하는 복구는 하지 않는다. 기존 010-recovery도 추가 제한 정책을 제거하는 복구가 아니다.

원격 CI는 **실행하지 않았다**. 나중에 별도 승인된 hotfix/privacy-p0 Push 시 validate(정적/회귀/OFF·ON 빌드), isolated-postgres(가짜 SQL), local-supabase(95개 기존 실제 통합 뒤 콘텐츠 보호·457 assertion)를 예상한다. 지금 Push/PR/main 병합은 하지 않는다. 최신 최종 SHA의 원격 CI, 최신 백업·격리 복원, Storage bytes·정책, 운영 데이터 접근 통제, 업무 중단·복구 담당자와 별도 운영 승인이 남아 있으므로 NO-GO다.

### 정상 종료 준비와 디스크

현재 owner가 살아 있고 ready=true, Next의 PID·시작 시각·명령 해시가 소유 기록과 일치한다. 기록된 컨테이너 5개도 실행 중인 이 프로젝트와 일치한다. 기본 config는 이미 원본으로 복원돼 있다. 계정 조회 수정 전 8e7d3ae와 현재 소스의 closeUi/stopOAuthContainers 및 lifecycle 정리 코드는 동일하다. 기존 콘솔이 이전 계정 조회 함수를 사용하더라도 정상 종료 경로는 동일함을 확인했다.

사용자가 현재 메뉴 입력란에서 **Enter**를 누르면 자기 Next 자식 트리와 저장된 소유 컨테이너만 종료·제거하고 기본 config/환경/복구 기록을 정리한다. Auth 데이터·회원·identity는 볼륨에 보존된다. Docker Desktop/이미지/볼륨은 삭제하지 않는다. PowerShell finally가 환경변수·BSTR·SecureString을 정리한다. 실제 Enter 종료와 그 후 확인은 **아직 실행하지 않았고 사용자에게 남긴다**. 정상 완료 표시는 LOCAL_OAUTH_STOPPED_CONFIG_RESTORED이며, CMD 마지막 pause는 아무 키로 닫을 수 있다. 비정상 종료/정리 실패 후에는 원래 owner가 종료된 다음 Recover-Local-OAuth.cmd를 사용한다. 현재 실행 중인 owner가 있는 상태에서 복구기를 실행하지 않는다.

14:05 KST C드라이브 여유는 12,954,185,728 bytes(약 12.06GiB)였다. 삭제한 공지 1행이 NTFS 여유 공간을 늘렸다고 주장하지 않는다. 기존 C:\Users\yjcha\AppData\Local\Temp\oaz-privacy-autonomous-20261104는 존재를 확인했고 그대로 보존했다. 이전 측정 721,966,719 bytes(약 0.672GiB)의 가짜 SQL 클러스터·휴대용 공식 바이너리이며 이번에는 크기를 다시 재귀 측정하지 않았다. 이전 자동 승인 검토가 재귀 삭제를 blocked by policy로 거절했으므로 재시도·우회 삭제하지 않았다. Docker 일괄 정리·다운로드·설치는 없다.

Production/Demo/Vercel/운영 OAuth·환경변수에 접속하거나 변경하지 않았다. Main·Demo·백업 및 관련 설정의 시작/종료 읽기 전용 비교 결과와 최종 Git/디스크/실행 상태는 커밋 후 최종 상태 기록에 남긴다. 서버는 실행 중인 채로 최종 보고한다.

---

## 서버 콘텐츠 쓰기 취약점 수정 최종 검증 — 2026-11-04 11:41 KST

**SECURITY_PASS (실제 로컬 DB 기준) / 운영 NO-GO.** 아래 권한 회수 단계의 쓰기 차단 실패는 이 단계에서 수정·재검증했다. 기존 기록은 이력으로 보존한다. 작업 브랜치는 hotfix/privacy-p0, 시작 HEAD는 8e7d3aef76dfa0224dcde790336ef56d37cc461e다. 최종 로컬 커밋 SHA와 작업 상태는 Git에서 제외되는 build/privacy-review/CONTENT_SECURITY_FINAL_STATE.md 및 최종 응답에 기록한다. Push·PR·배포는 없다.

### 1. 정확한 원인과 취약 범위

공지 public.editor_0_noti는 id(bigint identity), text, description, is_noti, created_at으로 구성된다. 기존 합성 fixture는 RLS를 켰지만 synthetic_legacy_write를 permissive ALL 정책으로 만들고 authenticated에 USING(true)/WITH CHECK(true)와 광범위한 테이블 GRANT를 부여했다. 따라서 INSERT/UPDATE/DELETE를 로그인 여부만으로 허용했다. 공지·프로젝트·스터디·시간표·일정·행사 6개 테이블에 같은 패턴이 있었다. 명예의 전당은 기존 restrictive donor 정책과 donor_writes=false로 별도 보호 중이었다. 익명에도 일반 콘텐츠 테이블의 DML·TRUNCATE 등 불필요한 ACL이 남아 있었다.

UI는 본인의 supervisor_id 존재 여부로 Editor 진입을 차단하지만, 일반 콘텐츠 서비스는 REST 테이블 DML을 직접 호출한다. REST PATCH /rest/v1/editor_0_noti 및 GraphQL updateEditor0NotiCollection도 같은 DB 역할·RLS를 사용한다. UI 차단은 해당 API를 보호하지 못했다. 기존 010 보호 SQL은 민감 테이블 5개에 집중했으며 일반 콘텐츠 6개의 쓰기 정책은 보호 범위 밖이었다. 기존 95개 통합·이전 회귀가 통과한 사실만으로 일반 콘텐츠의 서버 권한 회수까지 검증된 것은 아니었다.

**특권 계정 오탐을 배제했다.** 새 가짜 회원을 Auth에 생성하고 비밀번호 로그인으로 실제 발급된 JWT를 사용했다. role=authenticated, 주체·만료·서명·session_id·getUser를 검증한 후, 보호 전 일반 회원의 REST UPDATE와 GraphQL UPDATE가 각각 실제 1행을 변경하는 것을 재현했다. 이때 검사 요청의 apikey는 anon, Authorization은 일반 회원 JWT였다. service_role은 가짜 계정 준비·정리에만 사용했다. 재현은 난수 표식의 가짜 행만 사용했고 기존 공지에는 쓰지 않았다.

### 2. 최소 수정

- 기존 보호 SQL 13개·RC_SQL_HASHES.json을 먼저 검증했고 수정하지 않았다. 별도 content-write/011-content-write-guard.sql과 012-content-write-postcheck.sql, HASHES.json을 추가했다.
- 7개 테이블의 INSERT/UPDATE/DELETE에 restrictive 정책 21개를 추가했다. 기존 permissive 정책과 AND로 결합되며, 현재 DB의 oaz_privacy_v3.content_editor()가 true여야 한다. 공개 SELECT 정책·SELECT ACL은 그대로다.
- 기존 함수는 active_user 및 현재 supervisor/기존 관리자 상태를 읽는다. JWT의 is_admin/role 메타데이터나 요청자가 보낸 UUID를 권한 원천으로 사용하지 않는다. STABLE 문장 평가이므로 새 요청에서 DB의 권한 회수가 반영되고 토큰 재발급이 필요 없다.
- 익명 테이블/열 DML을 회수하고 PUBLIC/anon/authenticated의 TRUNCATE·TRIGGER·REFERENCES·MAINTAIN 등 우회성 ACL을 제한했다. authenticated의 정상 DML GRANT는 기존 범위에서 유지하고 RLS로 통제한다. 민감정보 capability나 업무 활성화 스위치는 부여하지 않았다.
- 신규 postcheck는 정책의 명령·역할·제한 속성·조건식·RLS·ACL을 검사한다. 기존 010-postcheck도 변경 없이 함께 통과했다. 현재 public 뷰/물질화 뷰는 0개이고, public의 SECURITY DEFINER 3개는 기존 계약으로 검증되는 세션/본인 프로필/권한별 디렉터리 읽기 함수다. GraphQL wrapper는 SECURITY INVOKER다. 새로운 owner 권한 쓰기 RPC를 만들지 않았다.
- local-content-guard.mjs는 Hotfix 브랜치·고정 localhost API·Docker 프로젝트·검토된 fixture provenance·연결 표식 부재·두 SQL 묶음 해시를 확인한다. 로컬 DB에만 적용했다. OAuth 실행기의 다음 새 시작/재개도 이 보호를 적용한다. 현재 켜진 콘솔을 재시작하지 않았다.
- CI는 기존 실제 Supabase 95개 검사에 성공한 뒤에만 disposable fixture 표식을 만들고 새 보호·실제 콘텐츠 검사를 실행하도록 추가했다. YAML 구조·순서·조건·실패 처리 검사를 통과했다. 원격 CI를 실제 실행하거나 Push하지는 않았다.

정책 결합 및 GraphQL의 DB 권한 적용 근거: [PostgreSQL 17 RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), [Supabase GraphQL 보안](https://supabase.com/docs/guides/graphql/security). 구체적 적용·제한·운영 전 순서는 [추가안 문서](content-write/README.md)를 따른다.

### 3. 최종 실제 로컬 검증 결과

최종 코드의 test-local-content-security.mjs verify가 **457개 assertion, 종료 코드 0**으로 완료됐다. 숫자는 HTTP 요청 수나 독립 취약점 수가 아니라 준비·Auth·HTTP·DB 불변·정상 CRUD·회수·위조 검사의 assertion 수다. 전체 Node 회귀 숫자와 합산하지 않는다.

| 상태/경로 | 실제 결과 |
|---|---|
| 익명 | 7개 테이블의 허용된 REST/GraphQL 조회 유지, 생성·수정·삭제 차단, 각 시도 후 전체 테이블 행 내용 지문 동일 |
| 일반 회원 | 유효한 Auth JWT로 7개 테이블 REST/GraphQL 쓰기 차단. user_metadata의 가짜 관리자 값이 들어간 Auth 발급 JWT도 동일하게 차단 |
| 편집 회원 | 일반 콘텐츠 6개 테이블에서 REST와 GraphQL 각각 생성·수정·삭제 성공, DB의 해당 행 상태를 각 단계에서 확인 |
| 명예의 전당 | 실제 donor_writes=false 유지하므로 편집자도 HTTP 쓰기 거절. 별도 미커밋 SQL 연결에서만 스위치를 켜고 동일한 Auth 발급 claims/역할로 RPC CRUD·회수 후 거절을 확인한 뒤 전체 롤백. 실제 다른 요청의 스위치와 기존 후원 자료는 변경하지 않음 |
| 회수된 편집 회원 | 권한 부여 전부터 보관한 **동일 JWT 문자열**로 검사. supervisor 행 회수 후 getUser 성공·기존 Auth session 존재를 확인하면서 7개 테이블의 REST/GraphQL 생성·수정·삭제 모두 차단 |
| 민감 관리 | 편집 권한만 있는 회원 및 회수된 회원의 회원/승인/관리자 명단 RPC 3개 각각 403/42501. 별도 capability는 빈 상태 유지 |
| 역할/주체 위조 | JWT role/sub/추가 claim을 재서명 없이 변조하면 REST/GraphQL 401. 가짜 역할/다른 사용자 ID 헤더는 RLS 차단. 잘못된 role/user_id 본문은 스키마 거절이며 RLS 성공으로 세지 않음 |
| 우회 | GraphQL alias mutation도 변경 행 0, 비공개 schema 프로필 요청은 406/PGRST106, DB 행 내용 불변 |

REST UPDATE/DELETE의 200·빈 배열 및 GraphQL affectedCount=0은 허용 성공으로 보지 않고, 존재하는 표적 가짜 행 및 전체 테이블 지문 불변과 함께 확인했다. 익명 GraphQL은 ACL에 따라 Mutation 타입이 사라지는 것을 introspection으로 확인하고, 편집자에게 실제 작동하는 canonical mutation과 대조했다. 스키마 오타나 임의 오류·500·통신 오류를 권한 거절로 인정하지 않는다.

검증기 작성 중 신규 postcheck의 CASE 괄호 오류, GraphQL 자동 ID 입력 제외·camelCase·익명 Mutation 타입 부재에 대한 처리 오류를 발견해 수정했다. 실패한 실행은 성공으로 기록하지 않았고, 가짜 자료 정리·기존 데이터 보존을 확인한 뒤 최종 소스로 457개 전체를 재검증했다.

### 4. 회귀·무결성·보존

- 전체 Node 회귀 **168개 통과, 실패/건너뜀 0**. 그 안에 신규 콘텐츠 검증 보조/CI 방어 5개와 앞선 계정 상세 조회 회귀가 포함된다. 실제 457 assertion과는 별도 결과다.
- TypeScript 오류 0, ESLint 오류 0/기존 이미지 경고 12. 기존 JSX DOM 속성 경고는 테스트 실패와 구분한다.
- 비밀정보 검사 220개 텍스트 파일, 실패 0. git diff 공백 검사 통과. 앱 src·package/lock·기본 Supabase config·Vercel 설정도 기존 커밋과 동일하다.
- 기존 SQL 13개 해시와 새 SQL 2개 해시, 기존/신규 DB postcheck 모두 통과. 추가 SQL의 Git checkout 줄바꿈 변환을 막는 .gitattributes 규칙도 추가했다.
- 실제 기존 GitHub 계정은 1명, 테스트 공지는 1개 유지됐다. Auth users/identities 전체 행·회원·승인·공지·capability·다른 supervisor 행의 지문 및 기존 session ID 집합이 시작과 동일하다. 최종 verify는 githubIdentity/serverSignInRecorded/serverSessionPresent/memberPresent/approvalPresent=true, localEditorAssigned=false다. 실제 GitHub 브라우저 토큰은 읽지 않았다.
- 기존 공지의 익명 REST 조회 200/1행, Next 홈페이지 HTTP 200. Next PID 50596 및 같은 Docker 컨테이너 5개를 유지했다. 현재 서버·콘솔을 종료하거나 재시작하지 않았다.
- 각 검사에서 만든 난수 표식의 콘텐츠/회원/supervisor와 해당 가짜 Auth 계정만 정리했다. 기존 OAuth 회원·세션·공지·다른 계정은 삭제하지 않았다. 가짜 Auth 감사 기록과 일반적인 시퀀스 번호 공백은 남을 수 있다.
- Main/Demo의 HEAD·Git 상태·변경 파일 내용, 백업 목록·크기·수정 시각, Docker 등 관련 설정의 시작/종료 비교가 모두 동일했다. Production/Demo DB·OAuth·환경변수·Vercel에 접속하거나 변경하지 않았다.
- 11:41 KST C드라이브 여유 13,029,208,064 bytes(약 12.13GiB). 추가 다운로드·대규모 빌드·전역 정리를 하지 않았다. 이번에는 실제 서버 보존을 위해 기존 전체 fixture 95개/Storage 38개/가짜 provider 시작·종료 검사와 Next OFF/ON 빌드를 재실행하지 않았다. 해당 과거 결과를 이번 실행으로 중복 계산하지 않는다.

검증된 코드·SQL·테스트·문서와 앞선 동일 Hotfix 계정 탐지 수정만 선택적으로 로컬 커밋한다. 기존 미커밋 변경을 되돌리지 않았고 자동 생성 AGENTS.md는 보존·제외한다. 커밋 후 최종 SHA/작업 상태·보안 검사 결과는 별도 최종 상태 기록과 최종 응답을 따른다.

### 5. 남은 사용자 확인 및 운영 전 조건

현재 로그인한 같은 시크릿 창에서 **http://127.0.0.1:3000/editor 를 새로고침**하여 접근 거절·홈 이동을 확인하고 메인에서 기존 테스트 공지가 계속 표시되는지 확인한다. 현재 계정은 회수 상태 그대로 유지한다. Secret 재입력·서버 재시작은 필요 없다. 이 단계의 실제 브라우저 새로고침 결과는 아직 사용자가 확인해야 한다.

기존 OAuth 왕복·가입·관리자 화면/공지 등록 성공은 사용자가 직접 확인한 이전 결과다. 이번에는 실제 세션·회원 보존 및 가짜 Auth/DB/API 검사를 확인했으며, 브라우저 전체 OAuth를 자동으로 다시 수행했다고 주장하지 않는다.

운영에서는 최신 정책/GRANT/뷰/함수·트리거/역할 상속 조사, 새 백업·복원 검증, 승인된 대상 seal·추가 migration·같은 SHA 원격 CI·무행 API 점검·별도 변경 승인이 필요하다. 로컬 fixture 정책을 운영 취약점이라고 단정하지 않으며 로컬 전용 선언을 운영에서 흉내 내어 적용하지 않는다. 기존 010 이후 별도 콘텐츠 보호 단계를 검토하고 기존 선택 업무 활성화 승인을 유지한다. 010-recovery는 함수·정책을 삭제하지 않고 업무/GraphQL을 차단하는 방식이므로 새 restrictive 정책을 제거하지 않는다. **운영 NO-GO 유지.**

---

## 최종 후속 권한 회수 검증 — 2026-11-04: 부분완료

사용자가 실제 관리자 편집 화면에서 **LOCAL OAuth 편집 권한 테스트** 공지를 등록하고 메인 화면에서 표시됨을 확인했다고 보고했다. 이번에는 기존 OAuth 콘솔·서버·로그인을 유지하면서 편집 권한 회수와 기존 로그인 계정의 쓰기 차단을 검사했다.

### 대상 확인과 실제 변경

- localhost API, Docker 프로젝트, 검토된 fixture provenance와 실행 중 OAuth owner를 확인했다. Docker DB/Auth/REST/Storage/Kong 5개와 Next 3000 포트가 계속 실행 중이다. 공개 바인딩은 127.0.0.1 및 ::1뿐이다.
- auth.identities의 실제 GitHub 계정 1명, 해당 계정의 supervisor 행 1개, 위 제목 공지 1개를 확인했다. 변경 전 verify는 githubIdentity/serverSignInRecorded/serverSessionPresent/memberPresent/approvalPresent/localEditorAssigned 모두 true였다.
- 최신 상세 계정 조회로 선택한 UUID와 DB의 유일한 GitHub identity가 일치하는지 다시 확인했다. 트랜잭션 안에서 회원·현재 세션·supervisor 1개 조건을 재검사한 뒤 **해당 UUID의 public.supervisor_id 행 1개만 삭제하여 편집 권한을 회수했다.** Auth 계정·회원·승인·공지 및 다른 supervisor 행은 삭제하거나 수정하지 않았다. 실제 UUID·이메일·Secret·JWT는 기록하지 않았다.
- 회수 후 별도 최신 verify에서 githubIdentity/serverSignInRecorded/serverSessionPresent/memberPresent/approvalPresent=true, **localEditorAssigned=false**를 확인했다. browserRoundTripAttested=false는 서버 검사 자체가 브라우저 관찰을 자동 증명하지 않는다는 뜻이다.

### 중요한 실패: 공지의 서버 측 쓰기 차단은 확인되지 않음

실제 로컬 공지 테이블 public.editor_0_noti에는 permissive 정책 legacy_select(SELECT USING true)와 **synthetic_legacy_write(ALL TO authenticated USING true WITH CHECK true)**가 있다. 이는 tests/fixtures/privacy.sql의 기존 합성 fixture 정책과 일치하며, 기존 개인정보 Hotfix SQL의 5개 민감 테이블 보호 범위와 일반 공지 쓰기 정책은 구분해야 한다. 운영 정책 상태는 조회하거나 추론하지 않았다.

대상 GitHub UUID의 authenticated 요청 claims를 SQL 세션에서 시뮬레이션하고, 공지의 사용자 트리거·규칙이 각각 0개임을 확인한 뒤 `UPDATE editor_0_noti SET text=text`를 정확한 테스트 제목에 한정하여 검사했다. 전체 트랜잭션은 **ROLLBACK**했다. 결과:

```json
{"editorRevoked":true,"noticeUpdateDenied":false,"noticeAffectedRows":1,"donorWriteDenied":true}
```

즉 content_editor()는 false지만 **공지 UPDATE 1행은 허용**됐다. 이는 실제 PostgreSQL RLS 검사이며, 브라우저의 기존 JWT를 읽거나 HTTP 요청을 재전송한 검사는 아니다. 공지 내용은 변경하지 않았고 최종 전체 행 지문도 동일하다. 별도 보호가 있는 donor 쓰기 RPC는 42501로 거절됐다. 공지 쓰기 차단 실패를 전체 권한 검증 통과라고 보고하지 않는다.

사용자가 다른 계정의 권한 수정을 금지했으므로 다른 로그인 계정에도 영향을 주는 공지 공통 정책을 임의로 변경하지 않았다. 대상 UUID만 예외 처리하는 임시 정책이나 하드코딩도 추가하지 않았다. **회수·데이터 보존은 완료, 브라우저 차단은 사용자 확인 대기, 공지 서버 측 쓰기 차단 검증은 실패**다. 추후 별도 범위에서 로컬 일반 콘텐츠 정책과 운영 정책의 일치 여부를 검토해야 하며 운영 NO-GO는 유지한다.

### 회귀와 보존 확인

오프라인 네트워크 제한 하에 local-oauth.test.mjs, release-readiness.test.mjs, hotfix.test.mjs를 실행하여 64개 통과, 실패·건너뜀 0. 기존 JSX 속성 경고 1개를 실패와 구분했다. 이 회귀 묶음 통과는 위 실제 공지 UPDATE 허용을 검증하거나 해소하지 않는다.

회수 전후 전체 행 내용 지문을 메모리에서 비교하여 Auth 사용자·identity·회원·승인·공지·capability·다른 supervisor 데이터가 동일함을 확인했고, 로그인 session ID 집합도 동일하다. 공지는 여전히 1개, 대상 supervisor는 1→0이며 동일 Docker 컨테이너 5개를 유지했다. Next의 3000 포트 소유 PID도 그대로다. 기존 미커밋 코드·테스트와 자동 생성 AGENTS.md를 보존했다. 서버 종료·재시작, Secret 재입력, 운영/Demo 접속, Push·배포는 하지 않았다.

다음 사용자 행동: **현재 로그인한 동일 시크릿 창에서 http://127.0.0.1:3000/editor 를 새로고침**하여 권한 없는 페이지 안내와 홈 이동을 확인한다. 재로그인하거나 서버를 재시작하지 않는다. UI 차단 확인과 DB 쓰기 차단 실패를 별개 결과로 기록해야 한다. 현재 서버와 테스트 공지는 그대로 유지한다.

---

## 후속 관리자 편집 권한 부여 — 2026-11-04

사용자는 실제 GitHub 인증·가입·로그인 유지 성공과 일반 회원의 `/editor` 차단을 직접 보고했다. 최신 verify에서도 githubIdentity/serverSignInRecorded/serverSessionPresent/memberPresent/approvalPresent=true, localEditorAssigned=false를 확인했다. 기존 콘솔의 메뉴 4 오류는 수정 전 계정 탐지 모듈을 이미 불러온 상태와 일치한다.

최신 CLI에는 이미 `node scripts/local-oauth.mjs administrator`가 구현되어 있어 코드 추가 없이 기존 명령을 사용했다. 먼저 localhost API·Docker 프로젝트·검토된 fixture provenance를 확인하고 DB의 실제 GitHub 계정이 정확히 1명, 해당 계정의 supervisor 행이 0개임을 확인했다. 사용자의 명시적 권한 부여 요청에 따라 기존 확인 문구 LOCAL-TEST-ACCOUNT-ONLY를 전달하여 이 계정의 public.supervisor_id 행만 1개 추가했다. 사용자 UUID·이메일·Secret·JWT는 출력하거나 문서화하지 않았다.

명령 완료 후 별도 `verify` 결과는 githubIdentity/serverSignInRecorded/serverSessionPresent/memberPresent/approvalPresent/localEditorAssigned 모두 true였다. browserRoundTripAttested=false는 서버 검사 자체가 브라우저 관찰을 자동 증명하지 않는다는 기존 의미를 유지한다. 가입·로그인 브라우저 성공은 사용자 보고이며, 관리자 화면 진입은 아직 사용자가 확인해야 한다.

권한 회귀 테스트 `local-oauth.test.mjs`, `release-readiness.test.mjs`, `hotfix.test.mjs`를 오프라인 네트워크 제한 상태로 실행하여 **64개 통과, 실패·건너뜀 0**을 확인했다. 기존 JSX 속성 경고 1개는 실패와 구분한다. 실제 로컬 DB에서도 BEGIN READ ONLY/ROLLBACK 안에서 authenticated 역할과 대상 UUID의 요청 claims를 시뮬레이션하여 다음을 확인했다. 이는 브라우저 JWT 재사용 검사가 아니다.

- 본인 supervisor UUID 행 1개 조회 가능, 다른 편집자 UUID 행은 보이지 않음.
- content_editor()=true.
- 별도 개인정보 capability는 빈 배열, approvalWrite=false.
- registered_member/allowed_user/supervisor_id 명단 RPC 3개는 모두 insufficient_privilege로 거절됨.

비교 결과 Auth 사용자·identity의 전체 행 내용, 로그인 session ID 집합, 회원·승인 전체 행 내용, 대상 이외 supervisor 행이 변경 전과 동일하다. 대상 supervisor 행만 0→1로 변경됐다. 동일 컨테이너 5개가 유지되며 서버·콘솔 종료, 재시작, Secret 재입력, 데이터 삭제, 운영/Demo 접속, Push·배포는 수행하지 않았다. 기존 코드와 미커밋 변경을 보존했다.

다음 사용자 행동: 같은 시크릿 창에서 http://127.0.0.1:3000/editor 를 새로 열거나 새로고침하여 편집 화면 진입을 확인한다. DB를 다시 조회하는 방식이므로 우선 재로그인 없이 확인한다. 개인정보 명단·가입 승인 쓰기는 별도 권한을 부여하지 않았으므로 계속 거절되는 것이 정상이다. 브라우저 관리자 접근 및 이후 로그아웃 차단 결과는 아직 미확인이다. 운영 NO-GO는 유지한다.

---

## 10:32 KST 후속 실인증 진단 — 메뉴 1 계정 탐지 수정

이번 단계는 실행 중인 서버·세션을 종료하지 않고 로컬만 읽기 전용으로 조사했다. 시작 HEAD는 8e7d3aef76dfa0224dcde790336ef56d37cc461e이며, 이 후속 수정은 미커밋 상태로 남긴다. 아래 04:40 및 이전 보고서는 당시 검증 이력이다.

### 실제 원인 및 관측

- Docker의 DB/Auth/REST/Storage/Kong 5개가 실행 중이며 healthcheck가 있는 서비스는 healthy였다. API/DB는 127.0.0.1 및 ::1, Next 3000은 127.0.0.1에서 수신한다. 종료·재시작·새 스택 생성은 하지 않았다.
- auth.users 총 9개, auth.identities는 email 8개·github 1개. GitHub 계정의 확인 상태와 마지막 로그인 기록이 있고, 해당 계정으로 범위를 한정한 login/logout 감사 기록도 있다. 현재 해당 계정의 auth.sessions·registered_member·allowed_user는 없다. 계정 식별자·이메일·자격증명·토큰·코드는 기록하지 않았다.
- 로컬 `/auth/v1/settings`에서 GitHub provider 활성화를 확인했다. 계정 목록 API는 9개를 반환하지만 모두 identities=null이라 선택되는 후보는 0개였다. 같은 계정의 상세 API에서는 실제 GitHub identity가 1개 존재했다. **listUsers의 null identity를 계정 부재로 오인한 것이 메뉴 1 오류의 정확한 원인이다.**
- 모든 계정의 app_metadata에 github 표시가 있어 metadata 대체는 합성 계정을 오선택할 수 있다. 이 방법은 사용하지 않았다.
- 원문을 출력하지 않고 Auth 컨테이너 로그를 메모리에서 집계했다. 최근 40분 범위에 callback 302 3회, user 200 18회, logout 204 3회가 있었다. 요청 횟수를 서로 다른 계정 수나 독립 인증 성공 횟수로 해석하지 않는다.
- 사용자가 **등록되지 않은 사용자입니다. 관리자에게 문의하세요.** 화면을 직접 확인했다. 코드상 홈페이지 로그인→GitHub→로컬 Auth callback→`/login_callback`→getUser→본인 회원 UUID 조회→회원 부재 시 signOut 순서와 일치한다. GitHub identity·로그인 기록·사용자 조회 성공·사용자의 복귀 화면을 함께 보면 **GitHub 인증 및 로컬 callback 도달 후 미등록 회원 차단은 확인된다.** 현재 로그인 세션 유지나 등록 회원 로그인 성공을 주장하지 않는다.
- 가입은 별도 `/signin`→`/oauth_callback` 흐름이다. 로그인 버튼은 신규 회원 행을 만들지 않는다. 미등록 차단을 인증 provider 실패로 해석하거나 이를 없애기 위해 정책을 완화하지 않는다.

### 최소 수정과 관련 검증

`scripts/local-oauth.mjs`가 목록 각 항목을 getUserById로 상세 조회하여 실제 identity로만 선택하도록 수정했다. 계정 조회 실패·목록 100개 이상·상세 ID 불일치·identity 누락은 안전하게 중단한다. 0명과 여러 명 오류를 구분하고 과거 서버 로그인 기록을 현재 세션과 별도로 표시한다. 회원/승인/관리자 변경 메뉴도 같은 선택 함수를 재사용한다. 기존 읽기 전용 verify의 DB 처리는 BEGIN READ ONLY/ROLLBACK을 유지했다.

`tests/local-oauth.test.mjs`에 목록 identity 누락, 위조성 metadata, 상세 실패·불완전 응답, 잘못된 목록, 0명·여러 명, 일부 계정만 읽힌 경우에 대한 회귀 6개를 추가했다. OAuth 28개와 기존 callback/릴리스 19개가 각각 통과했다. 후자에서 기존 JSX DOM 속성 경고가 있었으며 실패는 없다. TypeScript 및 수정 코드 ESLint 오류 0, diff 공백 검사 통과. 기존 157개 전체·실제 Supabase 95개·Storage 38개·가짜 provider 19개를 이번 단계에서 재실행한 것으로 주장하지 않는다. 실제 서버에 가짜 provider 테스트를 실행하면 컨테이너가 변경되므로 실행하지 않았다.

수정된 `node scripts/local-oauth.mjs verify`를 현재 실행 중인 로컬 서버에 직접 실행하여 다음 boolean 출력을 확인했다.

```json
{"githubIdentity":true,"serverSignInRecorded":true,"serverSessionPresent":false,"memberPresent":false,"approvalPresent":false,"localEditorAssigned":false,"browserRoundTripAttested":false}
```

browserRoundTripAttested는 서버 검사만으로 브라우저 화면을 자동 증명하지 않기 때문에 false로 유지한다. 이번 화면 증거는 사용자의 직접 확인이다. 최종 판정은 **메뉴 결함 수정·실제 읽기 전용 재검증 완료 / GitHub 인증·미등록 차단 확인 / 가입 및 등록 회원 전체 흐름 미검증 / 운영 NO-GO**다. Production/Demo·GitHub 설정·Client Secret·인증 정책은 접근하거나 변경하지 않았다. DB의 승인·회원·관리자 행을 추가하지 않았고 사용자 데이터 삭제도 하지 않았다.

최종 비교에서 Auth 사용자·identity·세션·회원·승인 테이블의 전체 행 내용을 메모리 내 지문으로 대조하여 모두 동일함을 확인했다. 실행 중인 컨테이너 5개의 ID가 동일하고 Next의 3000 포트 소유 프로세스도 동일하다. 비밀정보 검사 213개 텍스트 파일, 실패 0. 수정 파일은 실행기·관련 테스트·이 보고서·OAuth 가이드의 4개이며 미커밋으로 보존했다. 기존 자동 생성 AGENTS.md도 그대로 남겼다.

### 지금 사용자가 할 일

현재 실행기를 그대로 유지하고 **새 터미널**에서 Hotfix 폴더로 이동한 뒤 `node scripts/local-oauth.mjs verify`를 실행한다. 이미 실행 중인 메뉴는 이전 모듈을 불러온 상태라 같은 오류가 남을 수 있다. 새 명령은 Secret 재입력·서버 재시작 없이 수정 코드를 사용한다. 신규 가입까지 계속 시험하려는 경우에만 별도 명령 `node scripts/local-oauth.mjs approve`와 확인 문구로 로컬 테스트 승인을 한 뒤 시크릿 창의 `/signin`에서 가짜 프로필로 가입한다. 세부 순서와 승인 명령의 쓰기 동작은 LOCAL_OAUTH_BROWSER.md에 기록했다.

---

검증 기준: 2026-11-04 04:40 KST. 브랜치 hotfix/privacy-p0. 이 단계 시작 HEAD는 c7f6151ac87b26966f9748d368a4a8bea1e219b5다. 코드 리뷰와 필수 검증을 완료했다. **커밋 후 최종 판정·HEAD·git status는 [최종 Git 기록](../../build/privacy-review/FINAL_STATE.md)과 최종 사용자 응답에 기록한다.** 아래 03:39 단계 보고서는 과거 검증 이력으로 보존한다.

**OAUTH_BROWSER_NOT_VERIFIED / 운영 NO-GO 유지.** 이번에는 실제 Client ID/Secret을 찾거나 입력하지 않았고 GitHub 브라우저 로그인·운영 OAuth·Production/Demo DB·Vercel·원격 Git 변경을 수행하지 않았다. 숨김 입력 검사는 고정된 합성 문자열만 사용했다.

## A. 이전 변경의 출처와 이번 처리

시작 당시 수정/미추적 파일은 실제12개였다. 이전 작업의 명령·파일·보고서와 현재 diff를 대조해 Codex 수정11개와 Next 자동 생성 AGENTS.md를 구분했다. 사용자 변경이 섞여 구분 불가능한 파일은 발견하지 않았다. Main/Demo의 기존 변경은 이 분류에 포함하거나 스테이징하지 않았다.

이번에는 해당 수정과 필요한 보완·보고서만 파일명을 명시해 선택적으로 커밋한다. 자동 생성 AGENTS.md는 사용자 지시대로 제외하고 보존한다. git add ., push, PR, main 병합, 기존 변경 되돌리기는 사용하지 않는다. Git worktree의 공유 object/Hotfix ref 갱신을 제외한 Main의 작업 파일·HEAD·상태는 유지한다.

## B. 코드 리뷰에서 보완한 사항

- **localhost:** Docker 주소127.0.0.1/::1만 허용하고 wildcard·LAN·mapped IPv6는 계속 거부한다. 실행기 자체가 Windows Get-NetTCPConnection의 실제 주소도 검사한다. Secret 입력 전 probe와 시작 후 API/DB 공개 포트를 검사하며 사용자 Localhost only 설정은 변경하지 않는다. 원격 npipe도 거절한다.
- **실제 GraphQL 로딩:** 기존 설치 해시 검사에 PostgreSQL의 살아 있는 백엔드 검사를 추가했다. /proc/PID/exe의 실제 Nix .postgres-wrapped 경로를 사용하고, 실제 GraphQL 질의 후 /proc/PID/maps의 경로·실행 매핑·inode를 설치 파일과 비교한다. 그 파일의 SHA도 고정 공식 archive에서 얻은1.6.3 바이너리와 다시 비교한다. 오래된/삭제된/다른 inode 라이브러리는 거절한다.
- **로컬 대상 보호:** GraphQL 설치는 정확한 컨테이너 이름·label·공식 PG17.6 이미지·정해진 named volume mount만 허용하며 host bind를 거절한다. 새 staging 파일은 Hotfix/build 안에만 만든다. 기존 SQL TEMP 폴더는 건드리지 않는다.
- **환경·출력:** Windows의 대소문자 차이를 이용한 provider/클라우드 변수 상속도 제거한다. PowerShell 검사 자식에 Secret이 전달되지 않는다. OS 프로세스 명령 원문은 메모리에서만 비교하고 상태 파일에는 PID·시작 ticks·명령 SHA만 저장한다.
- **Storage:** 업로드의 직접 JSON 오류와 다운로드의 SDK wrapper를 구분한다. Signed URL 발급 거부·변조·상위 경로 거부도 일반 오류가 아닌 정확한 실제 HTTP/backend 응답으로 검사하도록 강화했다.500/전송 오류를 권한 보호 성공으로 세지 않는다. RLS/GRANT/REVOKE·실제 앱 정책은 변경하지 않았다.
- **Next:** 검증된 --webpack과127.0.0.1을 유지했다. 실제 OFF/ON HTTP를 다시 확인했다. 기존 Turbopack timeout의 단일 원인은 여전히 미확정이다. webpack 성공을 운영 build 또는 브라우저 로그인 성공으로 확대하지 않는다.
- **한 콘솔 메뉴:** 기존 verify/approve/existing/administrator 도구를 번호1~4로 연결했다. 실제 GitHub identity가 없으면 거절하며 가짜 app_metadata로 통과하지 않는다. 변경 메뉴는 LOCAL-TEST-ACCOUNT-ONLY 확인이 필요하다. 미래 관리자 체계나 운영 계정 복제는 추가하지 않았다.
- **복구:** 실행기가 만든 정확한 Docker ID와 Next 자식의 PID·시작 시각·명령 지문을 저장한다. 재사용 PID/다른 컨테이너는 종료하지 않는다. 소유한 컨테이너의 종료에는 네트워크 접근을 열지 않으므로 바인딩이 바뀌어도 소유권 확인 후 종료할 수 있다. UI/컨테이너 정리에 실패하면 기본 config는 복원하되 복구 소유권 기록을 남긴다. 이미 정리된 세션은 복구 재실행이 무해하다.
- **검증 중 발견해 수정한 회귀:** 새 소유권 기록이 ready 갱신에서 사라지는 버그를 실제 실행으로 확인했다. 반환값만 검사하던 단위 검사를 디스크 재읽기로 보강하고 상태 필드를 보존하도록 수정했다. 정보가 없을 때 안전장치가 정리를 거절한 것을 확인했으며, 그 합성 실행에서 만들어진 컨테이너임을 이름·label·생성 시각으로 확인한 뒤 공식 CLI로 정리했다. 수정 후 새 실행기로 강제 중단·복구를 재검증했다.

## C. 최종 코드의 실제 재검증

| 검사 | 이번 결과 | 증거의 범위 |
|---|---|---|
| Node 전체 회귀 | **157 성공 / 실패0 / 건너뜀0** | unit·DOM·합성 SDK transport. 이전147을 단순 재인용하지 않음 |
| 실제 새 Supabase 통합 | **95 성공** | 별도 임시 프로젝트에서 실제 Auth/REST/GraphQL/Storage와 SQL 수행 |
| 추가 Storage | **38 성공 / 정리 PASS** | 실제 로컬 transport, 잘못된/만료 JWT, signed URL/만료, MIME·크기, 본인/타인·공개/비공개 |
| 가짜 provider 재시작 | **19 성공** | 실제 로컬 Auth settings/두 authorize callback·복원. 외부 redirect 미추적 |
| GraphQL 로딩·재시작 | **PASS** | 실제 백엔드 매핑 경로·inode·공식 해시·query·정리 확인 |
| Windows 실제 수신 | **PASS** | Docker API/DB127.0.0.1/::1, Next127.0.0.1 직접 확인 |
| Next local-stack OFF/ON | **각76 확인 PASS** |5경로·정적 script18, privileged key literal 부재. 실제 브라우저 JS 실행은 아님 |
| CMD 실행기 | **합성 입력 PASS** | 한글 안내, SecureString 마스킹, 실제 READY·메뉴의 미인증 거부·입력 제한 확인 |
| 강제 중단 및 Recover CMD | **PASS** | 이번 소유 owner만 종료. 이 Windows에서는 Next도 종료됨. 남은 기록된 컨테이너 정리·config/잠금 복구, 재실행 무해 확인 |
| TypeScript | **오류0** | 독립 tsc |
| ESLint | **오류0 / 기존 이미지 경고12** | 새 helper 포함 |
| PowerShell | **구문 오류0 / 비대화형 사전 거절 PASS** | 한글을 위한 UTF-8 BOM. 비대화형 종료1은 Secret 입력 전 기대된 거절 |
| SQL assets | **13개 hash PASS** |010 SHA 및 원본 SQL 불변 |
| 비밀정보 검사 | **텍스트213개, 발견0** | 소스·문서 전체. 값이 아닌 count/고정 코드만 출력 |
| git diff --check | **PASS** | 줄바꿈 안내와 오류 구분 |

이 숫자는 **합산하지 않는다.**157개에는 helper 회귀가 포함되고95·38은 다른 실행 계층이지만 동작 범위가 겹친다. 가짜 provider19개는 GitHub OAuth 브라우저 인증19회가 아니다. 관리자 service_role의 fake bucket 관리 성공은 앱 관리자 권한 정책의 증명이 아니다.

95개 재실행은 기존 OAuth용 볼륨을 초기화하지 않기 위해 새 scripts/test-local-fresh-review.mjs로 수행했다. 검토한 코드·fixture·SQL을 Hotfix/build의 임시 폴더에 복사하며 프로젝트 상수와 config의 project_id만 oaz-privacy-local-review로 바꾼다. 나머지는 해시 비교로 원본과 일치시킨다. 같은 공식 이미지·localhost 포트·원래95개 테스트를 사용하고 실제 로딩 검증 marker도 요구한다. 새 프로젝트의 컨테이너·볼륨3개·복사 폴더만 정리했으며 원래 oaz-privacy-local fixture는 보존했다. 이 식별자 분리를 숨기고 바이트가 전부 같은 환경이라고 주장하지 않는다.

이전 PG automatic grants ON/OFF 각144, 독립 REST/GraphQL334, OFF/ON 새 offline build 및 그 HTTP 결과는 **이전 단계 증거를 재사용**한다. 앱 src/package·lock/Next 설정·보호 SQL13개·CI/Vercel 설정은 바뀌지 않았으므로 대용량 재설치·동일 build·독립 cluster 재생성을 반복하지 않았다. 이번 커밋의 원격 CI는 실행하지 않았다.

## D. 복구 검사의 의미와 남은 한계

실제 CMD의 숨김 입력에는 합성 값만 넣었으며 마스킹을 확인했다. 정상 Enter 종료는 중간 CMD 실행에서 확인했다. 최종 코드에서는 소유권 기록이 디스크에 유지되는 것을 확인한 후 테스트 owner만 강제로 종료하고 실제 Recover-Local-OAuth.cmd를 실행했다. Next는 owner 종료와 함께 사라져 복구기가 다른 PID를 건드리지 않았고, 기록된 컨테이너와 임시 config/잠금이 정리됐다. 복구 재실행은 LOCAL_OAUTH_RECOVERY_NOT_REQUIRED로 종료했다.

남은 Next를 종료하는 분기의 PID 재사용·시작 시각/명령 불일치 및 외부 컨테이너 보존은 단위 검사로 확인했다. 이 환경에서 강제 중단 뒤 Next가 계속 살아 있는 OS 상황까지 실제 재현했다고 주장하지 않는다. 복구 정보가 없는 초기 중단, 알 수 없는 프로세스/컨테이너, 동시 config 수정은 추측해 종료·덮어쓰기하지 않고 수동 검토를 요구한다.

**실제 GitHub 로그인·승인·취소·callback 왕복·실제 계정의 메뉴2~4는 OAUTH_BROWSER_NOT_VERIFIED다.** 서버 boolean만으로 브라우저 완료를 판단하지 않는다. 운영 버킷 정책 전체·백업 복원·전체 Storage 객체 백업·운영 환경과 최신 원격 상태도 미검증을 유지한다. 이번 로컬 커밋은 운영 승인·배포 가능 판정이 아니다.

## E. 보호 대상과 종료 결과

시작 C드라이브 여유23,609,679,872 bytes(약21.988GiB), 검사 후04:40:17 실측23,185,670,144 bytes(약21.593GiB)다. 관측값은12GiB보다 높았다. 새로운 큰 이미지나 패키지 설치·전역 정리는 하지 않았다. 최종 커밋 뒤 값은 최종 Git 기록에 남긴다.

Docker 컨테이너0, 테스트 수신 포트0, 임시 review 폴더0, OAuth 잠금·hosted link 없음. 공식 이미지5개와 원래 fake volume3개(논리68.47MB)를 보존했다. 이 볼륨은 물리 VHDX 크기와 다르다. 테스트 중 생성한 새 임시 프로젝트 자산만 제거했다.

Main HEAD·상태·기존 수정/미추적65개 파일 해시, Demo HEAD·상태, 백업191개 경로/크기/mtime가 시작과 동일했다. 이번 단계의 Docker config3개 해시도 동일하다. Main 작업 파일·Demo·백업·Docker Localhost only·WSL·개발 도구를 변경하는 작업을 하지 않았다. Git 커밋의 공유 object/Hotfix ref 기록은 허용된 로컬 Git 작업이다.

기존 C:\Users\yjcha\AppData\Local\Temp\oaz-privacy-autonomous-20261104는 보존했다. 이전 실측721,966,719 bytes(약0.672GiB)의 종료된 가짜 SQL cluster·공식 portable 파일이다. 이번에는 경로·시각·성격만 확인했고 삭제하지 않았다. **이전 자동 승인 검토가 재귀 삭제를 “blocked by policy”로 거절했으며 우회·재시도하지 않았다.** 사용자가 나중에 정확한 해당 폴더만 직접 정리할지 결정할 수 있다. OAuth 시작의 필수 조건이 아니다.

## F. 사용자의 다음 행동

1. **Start-Local-OAuth-Test.cmd**를 실행한다.
2. 독립 **OAZ Privacy Local OAuth Test**의 ID와 Secret을 로컬 콘솔에만 입력한다. Secret은 숨김 입력이며 채팅에 보낼 필요가 없다.
3. READY 후 **http://127.0.0.1:3000**을 열어 직접 GitHub 로그인·테스트 앱 승인을 수행한다.
4. 같은 콘솔 메뉴1로 서버 증거를 확인하고, 필요하면 메뉴2로 테스트 가입 승인 후 가입·일반 사용자·Editor 거절·로그아웃·취소를 확인한다. 자세한 기준은 [가이드](LOCAL_OAUTH_BROWSER.md)를 따른다.
5. Enter로 종료한다. 창 강제 종료 뒤에는 **Recover-Local-OAuth.cmd**를 사용한다.

Callback은 **http://127.0.0.1:56321/auth/v1/callback**이다. 실제 인증과 별도의 운영 승인이 남아 있으며 **운영 NO-GO**다.


---

## 이전 03:39 단계 기록 (아래 현재/미커밋 표기는 당시 기준)

# 개인정보 Hotfix 자율 통합 검증 — 2026-11-04

기준 시각: 2026-11-04 03:39:54 KST. 작업 폴더: C:/Users/yjcha/OAZ-Workspace/oazkorea_web-privacy-hotfix. 브랜치 hotfix/privacy-p0, 시작·현재 HEAD c7f6151ac87b26966f9748d368a4a8bea1e219b5.

## 1. 최종 판정과 검증 범위

**AUTO_TEST_PARTIAL.** Docker 격리 문제를 해결하고 실제 로컬 Supabase, SQL/Auth/RLS/REST/GraphQL/비공개 Storage, 가짜 OAuth provider 및 실제 Next.js HTTP 검증을 수행했다. 환경 문제로 전체 스택이 BLOCKED였던 초기 상태는 해소됐다.

**실제 GitHub OAuth 브라우저 인증: NOT_VERIFIED. 운영 배포·Production/Demo DB 변경: 미실행. 운영 릴리스: NO-GO.**

일부 요청 범위는 남아 있다. 실제 브라우저 로그인·취소·재로그인·Editor 화면 왕복, 운영 버킷 정책 전체를 재현한 검증, 외부 feed·방문자 API의 전체 데이터 계약 및 실제 백업 복원은 완료했다고 주장하지 않는다. 자동 HTTP 검사는 브라우저 JS 실행과 다르다. 서로 중복되는 검사 수를 합쳐 고유한 검증 수로 과장하지 않는다.

## 2. 중단 작업 복구와 원본 보호

- 지정된 브랜치·HEAD와 깨끗한 시작 worktree를 확인했다. 기존 CLI, 의존성, SQL, 실행기와 공식 portable archive를 재사용했다.
- node_modules는 Main의 node_modules를 가리키는 junction이다. npm install/ci, 패키지 업데이트·공유 의존성 수정은 실행하지 않았다.
- Node24.18.0, Next16.4.3, React19.2.4, supabase-js2.52.1, ESLint9.39.4가 설치되어 있고 lockfile과 일치했다.
- 루트·supabase의 .env, hosted project link, 미복구 OAuth 잠금이 없는 상태에서 시작했다. 운영 자격증명을 로컬 실행에 사용하지 않았다.
- Hotfix의 .next만 OFF/ON 새 빌드·개발 실행으로 갱신했다. Main/Demo 앱과 백업은 읽기 전용이다.
- 첫 next dev가 Hotfix 루트에 AGENTS.md를 자동 생성했다. 생성 시각과 설치된 Next의 generate-agent-files.js로 출처를 확인했다. 새 지침 및 동봉 CLI 문서를 읽었으며 이 파일을 사용자 원본으로 오인해 삭제하지 않았다.

## 3. 디스크·Docker·WSL·CLI 실측

GiB는 1,073,741,824 bytes다.

| 시점 | C드라이브 여유 bytes | 약 GiB |
|---|---:|---:|
| 전체 작업 시작 | 32,290,095,104 | 30.073 |
| 첫 Supabase 시작 직전 | 32,286,199,808 | 30.070 |
| 이미지·독립 SQL 준비 중 관측 최저 | 19,169,714,176 | 17.854 |
| 사용자 Localhost only 적용 후 | 26,505,728,000 | 24.686 |
| 최종 측정 | 23,637,590,016 | 22.014 |

관측한 값은 모두 12GiB를 넘었다. 새 다운로드·빌드 보류 12GiB, 작업 중단 10GiB 기준을 유지했다. 시작기에도 12GiB 이하 및 유효하지 않은 측정값을 거절하는 검사를 추가했다. 사용자 파일 삭제로 공간을 확보하지 않았다.

공식 고정 이미지 후보 7개의 압축 레이어 합계는 1,378,634,321 bytes였다. 압축3배+작업3GiB의 약6.85GiB는 예상 예산이다. 실제 설정에서는 공식 이미지5개가 준비됐고 Docker의 논리 크기 합계는 약5.415GB다. 실제 디스크 변동에는 pagefile·VHDX·빌드·TEMP가 포함된다. pagefile 할당12,660MiB와 낮은 가용 RAM을 관측했지만 시스템 메모리·pagefile 설정은 변경하지 않았다.

| 항목 | 실제 확인 |
|---|---|
| Docker | Desktop4.98.0 / Engine29.9.2, Linux, desktop-linux |
| endpoint | 로컬 Windows named pipe. TCP/SSH 원격 Docker 아님 |
| WSL2 | docker-desktop Version2 유지. 유휴 Stopped/실행 중 Running 확인 |
| Supabase | 기존 portable2.54.11, exe SHA-256 검증. 업데이트 안 함 |
| 포트 | API127.0.0.1:56321, DB127.0.0.1:56322, Next127.0.0.1:3000 |
| 이미지 | postgres17.6.1.029, gotrue2.180.0, storage-api1.28.2, postgrest13.0.7, kong2.8.1 |
| 초기 Docker 자산 | 이미지·컨테이너·볼륨0. 전역 prune 미사용 |

공식 버전 근거: [CLI2.54.11 Dockerfile](https://github.com/supabase/cli/blob/v2.54.11/pkg/config/templates/Dockerfile). Docker Desktop을 재설치·임의 재시작하거나 WSL을 unregister하지 않았다. 사용자 Apply에 따른 Engine 재시작은 사용자가 수행했다.

## 4. 발견한 실패와 최소 수정

### Docker localhost 격리

첫 시작은600,717ms timeout이었다. 이후 전용 bridge의 host_binding_ipv4=127.0.0.1 옵션만으로는 기본 publish가 0.0.0.0/::로 공개되는 것을 sleep probe로 재현했다. DB/Auth가 없는 probe와 소유 컨테이너만 정리했다.

사용자가 Desktop의 Port binding behavior를 Localhost only로 적용한 후 Docker inspect 및 Windows Get-NetTCPConnection 모두 127.0.0.1과 ::1만 확인했다. 재개 직후 NON_LOOPBACK_BINDING은 기존 검사가 IPv6 localhost까지 거부한 오탐이었다. 두 주소만 정확하게 허용했다. 0.0.0.0, ::, LAN, IPv4-mapped IPv6, 빈 주소는 계속 거절한다.

서비스 시작 전·숨김 Secret 입력 전 실제 default-publish probe를 실행한다. 시작 후 모든 컨테이너의 네트워크·바인딩 검사도 유지한다. probe는 sleep만 실행하며 --rm 및 직접 생성한 정확한 ID로 정리한다. 오류는 allowlist 코드로만 출력하고 Docker Env·status 원문·키·서버 로그를 출력하지 않는다.

전역 보안 설정은 직접 변경하지 않았다. [computer-use SKILL.md](C:/Users/yjcha/.codex/plugins/cache/openai-bundled/computer-use/26.1027.30824/skills/computer-use/SKILL.md)가 필수 참조하는 [guidance](C:/Users/yjcha/.codex/plugins/cache/openai-bundled/computer-use/26.1027.30824/docs/guidance.md)의 “Do not change … any in-app security or privacy settings” 제한 때문에 사용자에게 해당 설정만 맡겼고 적용 응답 후 진행했다. UI 입력 도구의 cursor/geometry 오류도 있어 설정을 대신 조작하지 않았다. [Docker Desktop 네트워킹 안내](https://docs.docker.com/desktop/features/networking/).

### GraphQL catalog와 실제 라이브러리 경로

최초 Supabase95/provider19는 응답했지만 추가 재시작 검사에서 문제가 발견됐다. catalog는1.6.3인데 Nix 서버의 실제 라이브러리 경로는 기본1.5.11을 가리켰다. pg_config의 plain PostgreSQL libdir와 실행 중 postgresql-and-plugins의 libdir가 달랐다. 따라서 최초 수치를 실제1.6.3 바이너리 검증 근거로 사용하지 않았다.

준비 도구가 실제 postgres 실행 경로·PG17·amd64·dynamic_library_path=$libdir를 검사하고 서버 bundle의 libdir를 사용하도록 수정했다. 공식 고정 SHA archive를 검증하고 정확히3개 파일을 설치한 뒤 각 설치 파일 SHA를 다시 비교한다. DB를 재시작하고 실제 readiness와 catalog·API를 검사한다. SQL의1.6.3 요구나 권한 조건을 낮추지 않았다.

수정 후 이 작업이 만든 가짜 계정8개·미사용 소유 label을 검증하여 그 가짜 볼륨3개만 제거하고 새 DB에서 Supabase95와 provider20을 다시 통과했다. 이후 컨테이너 제거·재생성 뒤에도 reviewed receipt 및 SQL postcheck를 통과한 fixture에만 파일을 재준비하여 provider19를 통과했다. 재개는 DROP EXTENSION·재seed·사용자 데이터 초기화를 하지 않는다. 출처가 다른 볼륨은 거절한다.

### Next 개발 서버

기본 Turbopack dev는 포트를 열었지만 준비 시간 안에 HTTP200을 제공하지 못했다. 단일 원인은 확정하지 않았다. 공유 node_modules junction을 유지한 채 공식 --webpack 옵션으로 비교 실행하여 OFF/ON 모두 HTTP 검사를 통과했다. 로컬 dev/OAuth 실행기에 그 옵션을 적용했다. 앱 src·전역 package dev 명령은 바꾸지 않았다. 개발 서버 준비 실패 시에도 소유 child tree를 종료하도록 OAuth 실행기 정리를 보완했다.

### 검사 실행 순서와 Storage 오류 계약

OAuth 임시 config가 적용된 동안 전체 회귀를 함께 시작해 기본 config 검사들이 실패한 실행이 있었다. 이는 검사 순서 오류다. 설정 복원·OAuth 종료 후 순차 재실행하여147개 전부 통과했다. 실패를 최초부터 성공한 것으로 기록하지 않는다.

추가 Storage 검사는 설치된 SDK 업로드 오류를 클래스라고 잘못 가정해 실패했다. 실제 SDK의 uploadOrUpdate는 실패 JSON을 직접 반환한다. 다운로드 wrapper와 구분하고 실제 HTTP·backend status·RLS 오류 및 소유자 positive control을 함께 검증하도록 수정했다.

잘못된 JWT는 REST401과 달리 고정 Storage 버전에서 HTTP400/backend403 Unauthorized로 거부된다. 이를 인증 실패로 별도 확인하며 RLS 성공으로 세지 않는다. multipart MIME 위반은 일반 바이너리 MIME 위반과 오류 serialization도 다르다. [고정 버전 JWT 처리](https://github.com/supabase/storage/blob/v1.28.2/src/http/plugins/jwt.ts), [오류 handler](https://github.com/supabase/storage/blob/v1.28.2/src/http/error-handler.ts), [uploader](https://github.com/supabase/storage/blob/v1.28.2/src/storage/uploader.ts)와 설치된 SDK 코드를 대조했다.

## 5. 실제 테스트 결과

| 검사 | 실제 결과 | 범위 |
|---|---|---|
| 시작 Node 회귀 |143 성공 | 기존 기준 |
| 최종 Node 전체 회귀 |**147 성공, 실패0, 건너뜀0** | 오류 진단·바인딩·디스크·Nix 경로 회귀 추가 |
| 관련 회귀 |41 성공 | local-supabase/local-oauth |
| TypeScript |오류0 | 별도 tsc. build의 ignoreBuildErrors로 대체하지 않음 |
| ESLint |오류0, 기존 이미지 경고12 | 추가 helper targeted lint도 수행 |
| SQL assets/hash |PASS,13개 | RC_SQL_HASHES.json 일치. 010 고정 SHA 유지 |
| 독립 PostgreSQL17.6 automatic grants ON/OFF |각144 성공 | 각각 별도 새 가짜 cluster |
| 독립 PostgREST16.5 + 실제 pg_graphql1.6.3 |334 성공 | 실제 loopback HTTP·권한 검사 |
| Docker Supabase 실제 통합 |**95 성공** | 수정한 공식 GraphQL 바이너리로 새 DB 재검증 |
| 가짜 OAuth provider |새 fixture20, 재시작19 성공 | settings·두 authorize callback·config/환경 복원. GitHub redirect 미추적 |
| Storage 추가 경계 |**38 성공, 임시 데이터 정리 PASS** | 아래 범위·한계 참조 |
| Flag OFF/ON 독립 offline webpack build |각 성공,24개 정적 페이지 | 외부 네트워크 차단, 각각 새 빌드 |
| 그 빌드의 실제 Next HTTP |OFF/ON 각31 확인 |5경로·정적 script19 |
| 실제 Supabase에 연결한 Next webpack dev |OFF/ON 각76 확인 |5경로·정적 script18, service_role/JWT secret literal 부재 |
| Next runtime 거절 |3 성공 | Main 대상·공개 secret·offline build Preview 승격 거절 |
| 보안 검사 |텍스트212개, 발견0 | 소스·문서, 값 아닌 경로/고정 코드만 출력 |
| git diff --check |통과 | LF/CRLF 안내는 오류 아님 |

010-privacy-minimal.sql SHA-256: bea86d888eea295c5ef092b2fa0f39955d494cf4b81a304615cf3079be57ed98.

독립 REST/GraphQL 최초 실행은3초 timeout으로 실패했고 동일 조건 재실행에서334개를 통과했다. 최초 timeout 원인은 확정하지 않았다. 현재 최종 수정은 로컬 미커밋 상태이므로 과거 [CI41651612037](https://github.com/koreaoaz/oazkorea_web/actions/runs/41651612037)의3개 성공 job을 이번 변경의 새 CI로 해석하지 않는다. 해당 과거 run의 HEAD와 성공 상태만 공개 API로 읽기 전용 재확인했다.

## 6. Auth·RLS·REST·GraphQL·Storage가 실제 확인한 것

Supabase95는 실제 가짜 Auth 사용자8명 발급·로그인, 독립 세션, 본인 UUID/승인 이메일만 조회, 타인 개인정보/관리자 RPC 거부, user_metadata 권한 위조 차단, 승인 신규 가입과 미승인 가입 차단, capability가 있는 관리자 최소 조회, 공개 donor id/name과 비공개 uuid 차단을 확인했다. 가입 허용(Auth signup)과 업무 회원/Editor 승인은 다른 정책이며 모델을 재설계하지 않았다.

GraphQL은 보호 전 실제 개인정보 질의가 동작하는 positive baseline을 먼저 확인하고 보호 후 차단을 검사했다. 공개 질의의 성공도 함께 요구해 고장난 endpoint를 개인정보 보호로 오판하지 않았다. 독립334에는 컬럼·관계·reflection·mutation·본인/타인/관리자·잘못된/만료 JWT·재적용·원자적 rollback·보호 유지 복구가 포함된다.

기존95의 Storage는 로컬 전용 가짜 private bucket의 소유자 upload/download, 타인·익명 숨김, 서로 다른 유효 JWT, RLS·SELECT 정책/권한을 실제로 확인했다. REST 만료 JWT401, logout8개와 refresh token 무효화도 확인했다.

추가 helper는 이 reviewed fixture에서만 별도 가짜 계정2개·작은 파일·임시 public bucket을 만들고 정확한 소유 대상만 정리한다. 타인 prefix 업로드/RLS403, 타인 삭제의 무효과와 원본 유지, 소유자 읽기·삭제, 타인·익명 다운로드 및 Signed URL 발급 차단, 유효 Signed URL 공개 다운로드·변조 거부·실제1초 TTL 경과 후 거부 및 유효 세션의 동일 파일 접근 유지, 잘못된 JWT와 서명 유효하지만 만료된 JWT의 Storage 거부, 상위 경로 변조, 가짜 public bucket의 익명 다운로드, binary/multipart MIME 거절과 크기 제한을 확인했다. MIME가 맞는 .exe 경로도 허용되는 실제 동작을 확인해 MIME 제한을 확장자 검증으로 오인하지 않는다. service_role의 가짜 bucket 관리 성공은 앱 관리자 역할 정책 검증과 구분한다. finally에서 소유한 임시 대상만 정리하고 Auth 사용자·bucket·object 수가 시작과 같은지 비교했다.

**이 Storage fixture를 운영 정책 전체와 동일하다고 주장하지 않는다.** 앱에는 project_img/study-images/card_news의 public URL 사용과 upload/remove 서비스가 있지만 운영 bucket RLS·관리자 예외·Signed URL TTL·허용 MIME·확장자 전체를 원격 접속 없이 확정할 수 없다. MIME 검사는 파일 내용 검증·확장자 allowlist와도 다르다. 실제 정책을 임의로 추가하거나 Production Storage 객체를 조회·다운로드·삭제하지 않았다.

## 7. Next·OAuth 준비와 미검증 항목

- 실제 HTTP200 확인 경로: /, /signin, /login_callback, /oauth_callback, /editor. 정적 자산도 별도 요청했다. /editor의200은 브라우저에서 관리자 권한을 얻었다는 뜻이 아니다.
- 실제 local-stack 모드는 service_role/JWT secret 값이 HTML·client script에 포함되지 않는지 메모리에서 검사했다. 로컬 public anon key만 Next 자식 환경에 전달했다.
- 가짜 provider는 로컬 Auth settings에서 GitHub 활성화, GitHub302 목적지·가짜 ID·고정 callback·state 존재를 확인한다. redirect를 따라가지 않는다. 가짜 metadata를 실제 GitHub identity로 세지 않는다.
- 실제 Test App Secret은 요청·탐색·입력·기록하지 않았다. 키·토큰·사용자 정보·callback fragment·Docker Env 원문을 로그/Git에 저장하지 않는다. 컨테이너 실행 동안 실제 provider 환경에 값이 필요하다는 점은 기존 가이드에 명시되어 있다.
- 실제 브라우저 로그인/승인/취소/재로그인·callback 왕복·Editor 화면 권한은 **NOT_VERIFIED**다. 기존 DOM/SDK 회귀 성공과 구분한다.
- /api/visitor는 최소 fake schema에 해당 전체 계약이 없고 /api/feeds는 외부 RSS/OG에 의존한다. 두 API의 실제 운영 데이터 동작을 검증했다고 보고하지 않는다. 관련 없는 스키마/기능을 새로 만들지 않았다.
- 운영 전체 Storage 정책, 실제 백업 restore·전체 Storage bytes 백업은 미검증이다.

## 8. 수정 파일과 Git 관리

| 파일 | 변경 이유 |
|---|---|
| scripts/local-supabase.mjs | 실제 publish probe·IPv4/IPv6 정확한 localhost 판정·12GiB 기준·안전 진단·reviewed fixture 판정 |
| scripts/local-oauth.mjs | Secret 전 검사·fixture GraphQL 재준비·webpack·준비 실패 child 정리 |
| scripts/local-dev.mjs | 검증된 webpack 개발 실행 |
| scripts/prepare-local-graphql.mjs | 실제 Nix server libdir·설치 파일 SHA·안전한 fixture 재개 |
| tests/local-supabase.test.mjs | 실패 경계와 Nix 경로 회귀 |
| scripts/test-local-oauth-provider.mjs | 실제 Secret 없는 provider 준비·복원 검증 |
| scripts/test-local-ui.mjs | 실제 서버 HTTP/정적 자산·로컬 secret 비노출·소유 child 종료 |
| scripts/test-local-storage-boundaries.mjs | 로컬 Storage 경계·정확한 SDK/HTTP 오류 계약·임시 데이터 정리 |
| reports/privacy-hotfix/LOCAL_OAUTH_BROWSER.md | 현재 준비 상태와 과거 설치 안내 구분 |
| reports/privacy-hotfix/PRODUCTION_RC.md | 실제 증거·미검증·운영 NO-GO |
| 이 보고서 | 하나의 단계별 진행·최종 기록 |
| AGENTS.md | Next가 자동 생성. 출처 확인 후 보존 |

앱 src, package/lock, 원래 supabase/config.toml, 보호 SQL13개, CI, Vercel 설정은 최종 변경하지 않았다. 임시 OAuth config는 원본 bytes로 복원되었고 복구 잠금은 없다. 새 Git staging/로컬 commit/push/PR/merge/브랜치 변경은 하지 않았다. HEAD는 처음과 같다. 검증 결과·변경 사항은 Hotfix 미커밋 상태로 보존한다.

## 9. 보호 대상 비교와 릴리스 검토

- Main HEAD·Git 상태 및 수정/미추적65개 파일 내용 해시·경로 집합 동일. porcelain62항목은 폴더 집계 차이다.
- Demo HEAD·깨끗한 작업 트리 동일.
- 기존 백업191개 경로·크기·수정 시각 동일: Main73/Demo30/Storage86/archive1/manifest1.
- Main 백업 database.dump/schema.sql/data.sql/roles-metadata.json/toc.txt의5개 SHA가 manifest와 일치했다. manifest 자체 SHA도 기존 기록과 일치했다. manifest의 restore_tested=false, complete_project_recovery=false는 해결되지 않았다. 실제 복원·운영 DB 실행은 하지 않았다.
- .docker/daemon.json과 .docker/config.json SHA 동일. Desktop settings-store.json은 사용자가 Localhost only를 적용하여 변경됐으므로 동일하다고 주장하지 않는다. 그 외 전역 설정을 직접 수정하지 않았다.
- Production/Demo DB·운영 OAuth·Vercel 환경/배포·main은 변경하지 않았다. Supabase link/push/pull/dump, Vercel Preview/Production deploy, Git push는 실행하지 않았다.

배포 순서는 최신 백업·환경·preflight → flag OFF 호환 코드 → 보호 SQL 전체 transaction → postcheck·실제 API 차단 확인 → flag ON 새 빌드 → 최종 기능 검사다. public flag는 build 시 반영되므로 각각 새 빌드가 필요하다. SQL commit 뒤 장애가 발생해도 개인정보 권한을 다시 열거나 구형 main 전체로 rollback하지 않는다.

실제 backup restore와 Storage 전체 백업 확인, 최신 Production 상태, 환경 별칭·일반 Preview의 Production 참조 위험, 같은 최종 SHA의 CI, 실제 OAuth 및 별도 운영 승인이 남아 있다. 이 보고서가 운영 승인이나 운영 SQL 적용 증거는 아니다.

## 10. 종료 상태와 사용자의 다음 단계

최종 Docker 컨테이너0, probe0, 전용 bridge endpoints0이다. 3000/56320/56321/56322/56329의 Windows 수신 포트가 없고 이 작업 TEMP의 PostgreSQL/PostgREST 프로세스0을 확인했다. OAuth 임시 잠금·hosted link가 없으며 기본 config가 복원됐다. Docker Desktop/WSL 설치와 실행 도구는 유지한다.

공식 이미지5개와 reviewed fake volume3개·Git 제외 fixture receipt는 다음 OAuth 검증 재개용으로 보존했다. 최종 볼륨의 사용량은 Docker 논리 합계68.47MB다. 이는 호스트 VHDX의 물리 파일 크기가 아니다. 정상 종료된 fixture에는 가짜 사용자8명과 가짜 파일만 있으며 실제 GitHub identity나 사용자 Secret이 없다. 기존 자산을 전역 정리하지 않았다.

사용자가 직접 해야 할 다음 핵심 작업은 **Start-Local-OAuth-Test.cmd 실행 후 독립 OAZ Privacy Local OAuth Test의 실제 ID/Secret을 로컬 숨김 입력하고 GitHub 브라우저 인증을 수행하는 것**이다. Localhost only 설정은 유지한다. 앱 http://127.0.0.1:3000, GitHub callback http://127.0.0.1:56321/auth/v1/callback이다. 실제 운영 OAuth App을 선택하지 않는다. 가입/승인/기존 회원/Editor/로그아웃/취소 순서는 [브라우저 검증 가이드](LOCAL_OAUTH_BROWSER.md)를 따른다. 실행 콘솔 Enter로 종료하고 비정상 종료 때만 Recover-Local-OAuth.cmd를 사용한다. Secret을 채팅에 보낼 필요는 없다.

새 TEMP C:\Users\yjcha\AppData\Local\Temp\oaz-privacy-autonomous-20261104는721,966,719 bytes(약0.672GiB) 남아 있다. 이 작업에서 생성한 종료된 가짜 cluster/공식 portable 파일이며 실행 중 프로세스는 없다. 생성 텍스트67개(log/txt/json/conf,4MiB 이하)의 token literal 검사에서 발견0이었다. binary 전체 검사를 뜻하지 않는다.

**자동 승인 검토가 이 TEMP 폴더의 재귀 삭제 명령을 실행 전에 “blocked by policy”로 거절했다.** 삭제하지 않았고 다른 도구로 우회하지 않았다. 원하면 사용자가 해당 정확한 TEMP 폴더만 수동 정리할 수 있으나 OAuth 검증의 필수 선행 작업은 아니다. 추가 대규모 디스크 정리는 수행하지 않았다.
