# 개인정보 Hotfix Production Release Candidate

2026-11-04 최종 로컬 확정: **LOCAL_COMPLETE / OAUTH_BROWSER_VERIFIED_USER_ATTESTED / 운영 NO-GO**. 사용자가 실제 인증·가입·세션 유지·관리자 편집/공지 표시·권한 회수 후 기존 세션 차단·공개 조회 유지를 직접 확인했다. 테스트 공지 id=34 한 행만 삭제했고 회원/identity/로그인 기록은 보존했다. 코드/SQL은 abd5e20의 검증 결과(실제 통합457/전체 회귀168)를 재사용하며 이번에는 문서만 확정한다. 최신 원격 CI·운영 상태·백업/복원·Storage 및 운영 변경 승인은 아직 없으며 아래 이전 시점의 숫자/미검증 기록과 구분한다.

2026-11-04 콘텐츠 쓰기 보호 추가안은 [content-write/README.md](content-write/README.md)를 따른다. 기존 SQL 13개와 해시는 유지하며 운영에 추가 SQL을 실행하지 않았다. 기존 010 이후 별도 콘텐츠 RLS 적용·검증이 필요하고, 운영 정책 조사·대상 seal·변경 승인 전 **NO-GO**다. 아래 이전 결과와 이력을 구분한다.

2026-11-04 최종 후속 리뷰: [자율 통합 검증 기록](AUTONOMOUS_VALIDATION_20261104.md). 전체 회귀157, 분리된 새 로컬 Supabase95, 강화된 Storage38, 가짜 provider19를 재검증했다. Docker 및 Windows 실제 localhost 주소, GraphQL 백엔드의 매핑 경로·inode·공식1.6.3 파일 해시, 재시작·실행기 복구를 확인했다. 앱/SQL이 바뀌지 않은 OFF/ON 독립 빌드·독립 PostgreSQL/REST/GraphQL 증거는 이전 결과를 재사용했다. 실제 GitHub OAuth는 **OAUTH_BROWSER_NOT_VERIFIED**이며 운영 Storage 정책 전체·백업 복원은 미검증이다. 이번 로컬 결과는 운영 현재 상태·최종 SHA의 원격 CI·배포 승인을 대신하지 않는다. 운영 SQL 적용 여부를 재조회하지 않았으며 아래 과거 기록과 구분한다. **운영 NO-GO 유지**.

2026-11-03. **로컬 RC 준비 완료, 운영 적용 NO-GO**다. 실제 GitHub OAuth 왕복, 적용 시점의 환경·preflight·백업 확인과 운영 변경 승인이 남아 있다. 운영 SQL은 미적용이며 Critical 3 / High 5 위험은 계속 존재한다. 이 문서와 RUNBOOK.md가 과거 Preview/CI 준비 문서보다 우선한다. 일반 Preview는 운영 DB를 가리키므로 사용하지 않는다.

## A 릴리스 구성과 변경 범위

기준 main은 `d95bc684a45879255b61396fdaef46218be115ce`, 검증된 앱 기준은 `5bb15db15dec73dcd4c54e683871e49ce4b49817`이다. c7a58fc RC는 앱·13개 SQL·CI workflow를 변경하지 않고 검사·절차를 추가했다. 후속 독립 OAuth와 Production 검사기 변경·최신 수동 절차는 LOCAL_OAUTH_BROWSER.md를 따른다. 정확한 최종 SHA와 해당 SHA의 CI를 승인 기록에 함께 남긴다.

main 대비 기존 Hotfix 125개 파일의 경로·diff를 검토했다.

| 범위 | 필요한 이유와 영향 |
| --- | --- |
| privacy 모듈·registration·signin·두 callback·Navigation·Editor | 공개 이메일 열거 제거, 인증된 본인 UUID/이메일, 최소 RPC, 세션 변경 시 재판정, 안전한 오류 |
| PrivacyBoard·board/order service·회원/승인 보드 | 개인정보 wildcard 조회/직접 편집/ID 재정렬 차단. 일반 콘텐츠 CRUD 유지 |
| Donators | 공개 id/name만 사용. 날짜·비공개 필드와 공개 목록 분리 |
| 일반 UI·effect·타입·로그 | 전체 ESLint/Next 16 호환, 늦은 응답 방지, 원본 오류/개인정보 로그 제거. 프로젝트 최신 학기·정렬·방문자 집계 알고리즘 유지 |
| NoticeForm | 기존 작성 요청의 중복/실패 처리와 타입 변경 포함. 새 공지 수정 기능은 없음 |
| package/lock·Next·ESLint | 기존 production 패키지 188개 버전 동일. lock 실제 Next 16.4.3, React 19.2.4, supabase-js 2.52.1. Node 24.x, dev lint/DOM 도구 정합성 수정 |
| CI·가짜 로컬 Supabase·검사·보고서 | 검증 자산. 앱의 새 관리자 라우트로 노출되지 않음 |

새 관리자 admin1~admin5 화면/API/계정/역할 설치, 방문자 시스템 개편, Demo 기능 차단 코드는 없다. SQL의 `oaz_admin_v2` 감지는 향후 구조가 이미 존재할 경우의 보호 분기이며 스키마를 설치하지 않는다. 개인정보 업무 capability 저장소는 현재 보호 정책에 필요한 최소 권한 분리다.

불필요 import/컴포넌트 정리와 타입 수정도 포함하므로 “개인정보 파일 몇 개만 변경”이라고 표현하지 않는다. 이미 검증된 변경을 되돌리거나 무관한 기능을 새로 수정하지 않았다. `ignoreBuildErrors`는 기존 값 유지지만 별도 TypeScript 검사 통과가 필수다.

## B 코드와 SQL의 네 조합

| 코드와 DB | 동작 | 근거/위험 |
| --- | --- | --- |
| 구형 main + 기존 DB | 기존 로그인·가입·Editor | 공개 회원/승인 목록 위험. 안전 상태 아님 |
| 구형 main + 보호 DB | 본인 UUID 로그인/Editor 입장 호환. 구형 가입의 익명 이메일 조회와 후원 wildcard/직접 편집 실패 가능 | d95bc68의 signin·board.service와 보호 SQL 컬럼 GRANT 대조. 최종 서비스 상태로 사용 금지 |
| Hotfix + 기존 DB, flag=false | 인증 후 본인 UUID 가입·로그인, 일반 콘텐츠·공개 후원 유지. 민감 목록/후원·승인 편집 제한 | hotfix/registration 회귀. DB 공개 API 위험은 SQL까지 남음 |
| Hotfix + 보호 DB, flag=false → true | 본인 로그인·검증 이메일 가입·기존 콘텐츠 Editor 유지. true는 최소 RPC | PG17.6/PostgREST/실제 격리 Auth·GraphQL. 설치 직후 capability 0건, 선택 쓰기 OFF |

SQL 전에 true로 잘못 빌드하면 RPC 미설치 오류로 닫히며 공개 조회로 우회하지 않는다. 순서는 **최신 대상·백업·추가안 승인 → 호환 코드(false) → 기존 010·postcheck → 별도 승인된 콘텐츠 보호·두 postcheck/API 점검 → 보호 코드(true)**다. 두 번의 Production 빌드가 필요하다. 자체 트랜잭션 두 개 사이에는 승인된 서버 측 콘텐츠 쓰기 동결을 유지하며 중첩 BEGIN으로 원문을 합치지 않는다. 운영 대상 전용 콘텐츠 migration/seal이 준비되지 않았거나 쓰기 공백을 통제할 수 없으면 배포를 시작하지 않는다. 로컬 전용 fixture 선언을 운영에서 흉내 내어 실행하는 것은 금지다.

후원 이름 편집이 필수면 사후 검증 뒤 `011-enable-donor-writes.sql`의 별도 승인을 계획한다. 승인 이메일 추가는 `012-enable-approval-writes.sql`과 `approvals.write` 개별 업무 승인, 기존 unique email 계약이 필요하다. 회원/승인/관리자 명단 업무도 담당자·필드·목적 승인 전 제한된다. flag ON만으로 권한을 부여하지 않는다.

## C 인증과 OAuth

실제 경로: 로그인 `/login_callback`, 가입 `/signin` → `/oauth_callback`, 관리자 `/editor`. Navigation의 signInWithOAuth와 privacyOAuthRedirect는 Production 기본 `https://www.oazkorea.co.kr`를 유지한다. 같은 Supabase URL/key와 SDK 기본 세션 저장 방식을 사용하며 기존 Auth/회원 UUID를 교체하지 않는다.

- 기존 회원은 Auth 이메일이 바뀌어도 본인 UUID로 등록을 찾는다.
- 새 가입은 getUser 결과, GitHub identity, 인증 이메일만 사용한다. DB가 UUID/이메일/승인·is_manager=false를 강제한다.
- 미승인 사용자가 Auth 세션을 갖는 것과 회원 등록·Editor 권한은 별개다. 일반 공개 콘텐츠는 허용된다.
- Editor/Navigation은 본인 supervisor UUID만 조회하고 세션 변경 때 재판정한다. 콘텐츠 쓰기는 별도 콘텐츠 restrictive RLS로 서버에서 재검사해야 하며 UI 차단만으로 완료 처리하지 않는다.
- 실제 격리 Auth에서 만료 JWT 401, 로그아웃 후 session 없음, 이전 refresh token 거절을 검증했다. 미만료 access JWT의 즉시 폐기를 의미하지 않는다.
- **실제 로컬 GitHub OAuth 브라우저 왕복 및 권한 회수 후 기존 세션 거절은 사용자 직접 확인으로 완료**됐다. CI 가짜 provider metadata와 구분한다. 운영 OAuth를 시험하거나 설정을 변경한 것은 아니다.

운영 확인 위치: Supabase Dashboard → Authentication → Sign In / Providers → GitHub. 기존 GitHub OAuth App callback은 `https://maoefmwpdcnugyenyiea.supabase.co/auth/v1/callback`. Authentication → URL Configuration에서 Site URL과 `https://www.oazkorea.co.kr/login_callback`, `https://www.oazkorea.co.kr/oauth_callback`의 정확한 Redirect 허용을 대조한다. 이번에는 설정을 변경하지 않았다.

### 새 클라우드 프로젝트 없는 독립 OAuth 절차

1. 사용자가 OAZ Privacy Local OAuth Test App과 새 Secret을 준비했고 이전 Secret을 폐기했다. App을 다시 생성하지 않는다. Client ID/Secret은 채팅/Git/명령 인수에 넣지 않는다.
2. 현재 노트북의 WSL/Docker/CLI2.54.11은 정상이며 재설치가 필요 없다. Main/Demo 클라우드를 재사용하지 않는다.
3. [LOCAL_OAUTH_BROWSER.md](LOCAL_OAUTH_BROWSER.md)를 따라 Start-Local-OAuth-Test.cmd를 실행한다. 선행 검사 통과 후 로컬 숨김 Secret을 입력한다. 도구가 env() 참조 임시 설정·가짜 검증·앱 실행·원본 복구·Secret 정리를 처리한다. tracked config를 수동으로 편집하지 않는다.
4. 실제 사용자가 브라우저에서 Test App 이름과 두 로컬 callback 복귀를 확인한다. 실제 GitHub 인증 계정은 로컬 Auth에만 생성한다. 로컬 가짜 승인/회원/관리자 사전조건 도구와 별도 확인 문구를 사용한다.
5. 허용/미승인 가입, 로그인·Editor, 취소·로그아웃을 확인한 뒤 실행 콘솔의 Enter로 종료한다. 결과만 기록하고 토큰/개인정보를 복사하지 않는다.

이 절차의 인증·가입·관리자 편집·권한 회수 후 거절·공개 조회는 사용자 직접 확인으로 완료됐다. 별도 보고되지 않은 취소/명시적 로그아웃 분기를 완료로 확대하지 않는다. 현재는 사용자가 실행 콘솔에서 Enter 정상 종료하면 된다. 서비스 수신 포트는 loopback만 사용한다. [GitHub Auth 공식 안내](https://supabase.com/docs/guides/auth/social-sign-in/auth-github), [로컬 provider 환경 설정](https://supabase.com/docs/guides/local-development/managing-config).

## D 운영 카탈로그와 SQL 근거

- catalog: 2026-11-03 05:32:22 UTC, Main ref 일치, PG `170006`, verify-full/read-only, 수집 전후 지문 일치. atomic snapshot은 아니다.
- **운영 surface의 graphql_extension은 null**이다. 운영 pg_graphql 1.6.3 설치를 주장하지 않는다. 과거 PASS와 API guard 계약상 검토된 inactive placeholder 경로와 호환한다. native 1.6.3은 격리 테스트 증거다. 현재 상태는 재검사 전 미확인이다.
- preflight: 2026-11-03 05:53:27 UTC `PASS: read_only_preflight_and_rollback`, 정책 적용 없음. result 자체에는 SQL/catalog SHA가 없어 단독 실행 버전 증거가 되지 않는다. 별도 seal의 6 SQL hash와 현재 후보는 일치한다.
- SQL 13개는 기준 커밋과 바이트 동일. 공개 코드 hash 목록은 `RC_SQL_HASHES.json`. 비공개 seal/surface는 Git 밖 원위치 보존.
- 010은 BEGIN, lock timeout 5초, 잠금 전후 지문 확인, 본문, postcheck, COMMIT의 단일 transaction. 기존 permissive 정책과 추가 restrictive 정책·컬럼 GRANT·역할 상속·SECURITY DEFINER·GraphQL 계약을 함께 검사한다.
- Data API 선언은 public + graphql_public / extra path public + extensions / 자동 노출 ON. Dashboard 선언과 catalog 검사를 서로 대체하지 않는다. OFF 변경은 별도 migration/default GRANT 검토 후 진행하며 이번에 묶지 않는다.

이번에는 사용자 비밀번호를 받을 안전한 로컬 대화형 콘솔이 없어 운영 재접속하지 않았다. 적용 당일 `scripts/main-p0-preflight.py check`를 사용자 콘솔에서 실행한다. 고정 기존 seal과 달라지면 의도적으로 중단한다. 새 지문을 자동 승인/강제 교체하지 않는다. 실행 HEAD·SQL13 hash·새 result를 함께 비공개 보관한다.

## E 백업과 복구 준비

`run-20261102T181350Z-8e4e09d2`를 읽기 전용 재검증했다.

| 파일 | 바이트 | 결과 |
| --- | ---: | --- |
| database.dump | 527236 | manifest SHA-256 일치 |
| schema.sql | 362123 | 일치 |
| data.sql | 410236 | 일치 |
| roles-metadata.json | 14085 | 일치 |
| toc.txt | 65237 | 일치 |

manifest SHA-256은 기존 `c199b85e2c44f0c86d156ed235a83172c850c55313541531f15915af5273cf79`와 일치. 공식 pg_restore18.6 목록·전체 디코딩 종료 코드 모두 0, TOC 동일. 저장 당시 관련 명령도 모두 0. public/auth/storage TABLE DATA, 총 TABLE DATA52 / POLICY105 / ROW SECURITY39 / ACL162 / DEFAULT ACL24 / FUNCTION51 / TRIGGER9 항목 확인. 이는 실제 행 수·전체 복구 성공 증거는 아니다.

**미검증:** 실제 복원, 관리 역할/extension 의존성, Auth/OAuth/SMTP/암호화 키, Storage 실제 bytes. 역할 메타데이터는 비밀번호 없는 목록이며 자동 복원 SQL이 아니다. PG17.6을 pg_dump18로 생성했으므로 PG17 대상으로 자동 복원 호환을 보장하지 않는다.

백업 함수/트리거 복원에는 외부 요청 가능성이 있다. native 가짜 DB 환경은 OS/VM outbound 차단 증거가 없어 실제 백업 복원을 실행하지 않았다. 기존 restore_plan.py도 실행기 없이 계획만 제공한다. 독립 폐기 가능 VM, outbound 차단, 운영 자격증명/공유 mount 제거, 관리 확장·역할 준비 후 읽기 전용 매체로 백업을 연결하여 별도 복원 연습이 필요하다.

점검 직전 Start-Main-Backup.cmd로 새 run 생성/verify. 원본은 덮어쓰지 않는다. 암호화된 외장 매체/조직 승인 저장소에 두 번째 사본을 두고 SHA를 대조하며 암호화 복구 키는 별도 보관한다. 이번에 업로드·설치·복사하지 않았다. Storage는 기존 Start-Storage-Backup.cmd에 필요한 읽기 권한을 사용자 로컬에서 제공하고 bucket/path 목록·다운로드 수·크기·SHA·재개 결과를 확인한다. 새 높은 권한 키를 발급하지 않는다. DB와 파일 수집 시각 차이를 기록한다. [공식 백업 범위](https://supabase.com/docs/guides/platform/backups).

이 Hotfix는 Storage를 바꾸지 않으므로 Storage 백업 미완료만으로 SQL 원자성이 부정되지는 않는다. 다만 **완전 재해복구는 미준비**다. 제한 복구 담당자와 이 한계를 수용한 명시적 승인 없이는 GO가 아니다.

## F Production 환경 확인

Vercel Project → Settings → Git의 Production Branch main / Ignored Build Step Only build production은 사용자 확인값. repo Hotfix deploymentEnabled=false, ignoreCommand 없음. GitHub 배포 기록은 없었으나 Vercel Dashboard 현재값은 직접 조회하지 않았다. Build and Deployment에서 Node24.x, lockfile, Next framework/root directory를 확인한다. Preview는 활성화하지 않는다.

Settings → Environment Variables의 **Production scope만** 아래와 대조하고 값은 채팅에 붙여넣지 않는다.

| 변수 | 조건 |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | 정확한 Main HTTPS origin |
| NEXT_PUBLIC_SUPABASE_KEY | 같은 Main anon/publishable 공개키. service_role/secret 금지 |
| NEXT_PUBLIC_OAZ_PRIVACY_V2 | 호환 단계 false / 보호 단계 true. 미설정 금지 |
| NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN | 비어 있어야 함 |
| NEXT_PUBLIC_PROJECT_STORAGE_URL 및 연결 alias | 공개 URL은 같은 Main public Storage 경로. 서버 전용 연동 변수는 별도 allowlist와 대상 검사 |
| VERCEL / VERCEL_ENV / VERCEL_GIT_COMMIT_REF | 자동값 1 / production / main. 임의 위조 금지 |

`check-production-release.mjs environment compatibility` 또는 `environment protected`는 네트워크 없이 값·stage를 검사하고 고정 코드만 출력한다. 키 서명/opaque key 소속은 오프라인 증명이 불가능하므로 Dashboard 대조 필수. 정상 출력도 배포 승인/DB postcheck를 대신하지 않는다.

현재 앱 build에는 Preview 보호만 연결되어 있다. 최종 승인 때 Production Build Command를 `node scripts/check-production-release.mjs environment compatibility && npm run build`로 설정하고 보호 단계는 compatibility를 protected로 바꾸어 새 빌드한다. 이번에는 Vercel 설정을 변경하지 않았다. public flag는 빌드 시 고정되므로 환경만 바꿔도 기존 번들은 바뀌지 않는다.

## G 검증과 남은 필수 조건

기준 [CI 41633687395](https://github.com/koreaoaz/oazkorea_web/actions/runs/41633687395) 3 job SUCCESS를 이번에 재확인했다. 기존 회귀109, runtime3, PG17.6 SQL ON/OFF 각144, 실제 Supabase95는 해당 커밋의 결과다. Storage owner200/내용 일치·타인/익명400/데이터 없음·독립 JWT/RLS·만료/로그아웃/refresh 거절 포함. OAuth 미포함.

이번 추가 검사는 SQL13/hash·Vercel blocker·Production 환경·단계별 flag·키/DB 혼동·NO-GO 기준이다. 현재 테스트 수치와 최종 CI URL은 최종 실행 보고에서 제공한다. SQL 미변경이므로 기존 native PG17.6/pg_graphql1.6.3/PostgREST334 검증도 재사용한다. 새 RC 커밋은 해당 SHA의 3 CI job을 다시 확인한다.

이번 RC 로컬 실행: 전체 회귀 **120 성공 / 0 실패 / 0 건너뜀**(신규 11개 포함), 실제 Next 시작 차단 **3 성공**, TypeScript **0 오류**, ESLint **0 오류 / 기존 경고 12**, 외부 통신 차단 flag OFF/ON 빌드 모두 통과, SQL13 assets 및 비밀정보 검사·git diff --check 통과. preflight의 **plan만** 실행하여 기존 비공개 근거/SQL 정합성을 확인했으며 운영 check는 실행하지 않았다.

| 우선도 | 미완료 | 해소 조건 |
| --- | --- | --- |
| P0 | 운영 노출 지속 | 승인 후 보호 SQL + postcheck/API 차단 확인 |
| 로컬 완료/운영 별도 | 독립 GitHub OAuth 왕복 | 사용자 직접 완료. 운영 callback/provider 설정은 별도 최신 확인 필요 |
| 배포 필수 | 콘텐츠 추가 보호안 | 운영 스키마/역할·뷰/함수 조사, 대상 seal·승인된 migration, 010 이후·ON 이전 적용과 실제 API 검사 |
| 배포 필수 | 현재 최종 SHA 원격 CI | validate/isolated-postgres/local-supabase 모두 실제 실행·통과. 지금은 Push/실행 안 함 |
| 배포 필수 | 현재 Production 변수·domain·Redirect | 각 Dashboard 확인, Production precheck 성공 |
| 배포 필수 | 최신 preflight·백업 | 사용자 check PASS, SQL13 일치, 새 백업 verify, drift 없음 |
| 배포 필수 | 업무 제한·복구·점검 창·승인 | 담당자/중단 기간/정확한 SHA·SQL 승인 |
| 재해복구 중요 | 실제 복원·Storage bytes | outbound 차단 VM 복원 연습·별도 파일 백업 |

## H 사용자가 지금 할 최소 작업

1. 지금은 기존 CMD 메뉴 입력 대기 줄에서 Enter로 정상 종료한다. 완료 표시를 확인하고 마지막 pause만 닫는다. GitHub 회원/identity와 볼륨은 보존한다.
2. 이후 별도 승인된 시점에 최종 hotfix/privacy-p0 SHA를 Push해 원격 CI 3개 작업을 확인한다. 이번에는 Push/PR을 하지 않았다.
3. 운영 단계는 최신 대상·환경/preflight·새 백업·격리 복원·Storage·콘텐츠 추가 migration 및 점검 창을 별도로 검토한다. 지금 운영 도구를 실행하라는 뜻이 아니다.
4. 조건 충족 후에도 **운영 코드 배포와 SQL 적용에는 별도 명시 승인**이 필요하다. 로컬 완료와 운영 NO-GO는 동시에 유지된다.
