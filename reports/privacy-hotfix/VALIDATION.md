# Hotfix 후속 통합 검증 — 2026-11-03

판정: **CONDITIONAL GO (로컬 후보 준비 완료)**. 실제 운영 배포는 독립 Preview/실제 OAuth/백업·복구·승인 조건 충족 전 NO-GO다. 운영 SQL은 미적용이며 Critical 3 / High 5는 계속 남는다.

## 이번에 실제 실행한 결과

| 검사 | 성공 | 실패 | 건너뜀 / 한계 |
| --- | ---: | ---: | --- |
| Hotfix 서비스·DOM·가입·권한·Preview/CI 검사 | 50 | 0 | 테스트 runner skipped 0 |
| PostgreSQL 17.6 + 실제 pg_graphql 1.6.3 + PostgREST 16.5 + Hotfix RPC 클라이언트 | 332 | 0 | synthetic only, 실제 Supabase Auth/provider 미검증 |
| 전체 ESLint | 통과 | 0 | img 최적화 권고 12건, 규칙 변경/면제 없음 |
| TypeScript | 통과 | 0 | Next 생성 타입 포함 별도 검사 |
| flag OFF / ON 외부 통신 차단 빌드 | 2 | 0 | 가짜 공개 환경 값, 실제 외부 데이터 없음 |
| 격리 폴더 실제 npm ci --ignore-scripts --offline | 통과 | 0 | 524 packages, Windows, Linux 원격 CI와 구분 |
| workflow YAML/권한/단계/우회 금지 검사 | 통과 | 0 | 실제 GitHub Actions는 미실행 |
| 비밀정보 패턴·비공개 산출물·SQL 해시 검사 | 통과 | 0 | 패턴 검사이며 모든 개인정보 부재의 수학적 증명은 아님 |
| git diff --check | 통과 | 0 | 변경 파일 별도 검토 |

로그: 저장소 밖 ../OAZ-Main-Lab/hotfix-*-release*.log 및 hotfix-lint-release-final.json.
실제 clean 설치: ../OAZ-Main-Lab/hotfix-ci-install-66bd1507/install.log.

## 시작 기준선과 수정

이번 시작점에서 재측정한 전체 오류 84 / 경고 16. 과거 운영 기준 90건은 이전 조사 결과이며 이번에 다시 측정했다고 표시하지 않는다.

- 미사용 변수/import 56건: 사용되지 않는 선언 제거. 실제 UI/테이블 컬럼 유지.
- explicit any 14건: EditorPost/unknown/문자열·숫자 union, 런타임 이미지 입력 검사, Supabase 결과 추론.
- effect 동기 상태 변경 9건: 파생 이미지 URL 직접 계산, 요청 effect 범위·취소 처리, 이벤트에서 상태 변경.
- 선언 전 참조 2건: 초기 요청 함수를 effect 안에 배치.
- prefer-const 2건, 불필요한 표현식 1건 수정.
- 접근성: 행사 미리보기 alt 2곳 추가. img 최적화 경고는 UI/이미지 전달 정책을 보존해 남김.
- 새 오류: 없음. ESLint 설정 완화, any/ts-ignore 추가, 테스트 삭제 없음.

추가로 발견해 해결한 문제: Editor/Navigation의 오래된 권한 응답, OAuth 오류 후 기존 세션 재사용, 로그/화면의 DB 오류 원문, 재사용 가능한 구형 승인 폼의 이메일 존재 조회, 공지 저장 실패 시 잠긴 버튼, 다른 게시판의 오래된 응답.
공지 수정 기능을 새로 이식하지 않았다. 기존 공지 작성/조회 실패 처리만 보강했다. 방문자 API는 오류 문자열만 정리했고 집계 방식은 바꾸지 않았다.

신규 공개 사전 검사 스크립트는 Preview가 Main 프로젝트로 연결되면 빌드 전에 거부한다. opaque publishable key가 실제로 어느 프로젝트 키인지는 Dashboard 확인이 필요하다.
Git의 core.autocrlf=true가 SQL 바이트 해시를 바꾸는 문제를 .gitattributes의 SQL -text 지정으로 방지했다. SQL 13개 원문은 원래 개발 저장소와 바이트 단위 일치한다.

## Auth와 외부 검증의 범위

설치된 supabase-js 2.52.1/auth-js 2.71.1의 실제 코드를 사용하여 모의 fetch transport로 GitHub authorize URL, 본인 확인, 가입 허용/거부, 세션 만료, 로그아웃을 검사했다. 실제 Auth 서버·GitHub 왕복 검증은 아니다.
현재 SDK 기본 implicit 흐름을 유지했다. PKCE로 바꾸거나 자체 state 처리를 만들지 않았다. OAuth state/제공자 secret/redirect allowlist는 독립 환경에서 종단 확인해야 한다.
Vercel/gh/Supabase/Docker CLI와 Vercel 로컬 연결 정보 및 사용 가능한 WSL 런타임을 확인하지 못했다. 새 로그인/설치/외부 실행은 하지 않았다.

기존 테스트의 모든 assertion을 유지했다. 새 프로젝트 아카이브 DOM 테스트에서 모의 default export 및 기존 대문자 Projects prop을 잘못 지정해 실패했으며, 실제 컴포넌트 계약에 맞춰 모의 객체를 고친 뒤 통과했다. 기존 소스/검증을 완화하지 않았다.

## 외부 필수 조건

1. Vercel Production Branch=main, Hotfix Preview branch 및 분리 환경변수·Deployment Protection 확인.
2. 독립 Supabase + 가짜 사용자 A/B + 전용 GitHub OAuth App 및 정확한 callback 설정.
3. 승인된 push 뒤 GitHub CI와 Vercel Preview 실제 성공, GitHub OAuth 왕복 및 실패/가입/Editor 시나리오 검증.
4. 최신 카탈로그·seal·preflight와 현재 SQL의 일치, 최신 백업·보호 유지 복구 책임자·점검 창·별도 적용 승인.

기존 preflight PASS는 유지하지만 실행 당시 SQL/카탈로그 해시를 result.json만으로 독립 입증할 수 없다는 한계도 유지한다. 적용 시점 재확인을 생략하지 않는다.
원래 main=d95bc68, feature/main-integration=b143d62, audit=e223501 보존. 이전 단계 종료 시 Hotfix는 d95bc68 위의 미커밋 변경 상태였다. 이번 후속 준비 단계의 로컬 커밋 결과는 아래 기록과 Git 이력을 따른다. push/배포/운영 SQL 실행은 계속 없음.

## 후속 GitHub CI / Preview push 준비 검증

이후 작업의 판정은 LOCAL READY이며 PREVIEW READY가 아니다. 독립 환경 존재/배포 보호/실제 OAuth가 미확인이라 실제 Push·Preview 실행은 보류한다. 이전 50개 결과는 위 단계의 기록이며 이번에는 Preview/runtime 회귀 9개를 추가해 전체 59개가 성공했다. PostgreSQL 17.6 332개도 이번에 다시 성공했다.

- 전체 ESLint 오류 0 / 기존 img 최적화 권고 12, TypeScript 및 생성된 Next 타입 검사 통과.
- flag OFF/ON 외부 차단 빌드 통과. Node 24를 package engines/CI에 명시.
- 실제 offline Next 서버 시작 거부 3/3 성공: Main target, 높은 권한 키, build/runtime 배포 종류 불일치. 단순 instrumentation 예외로 Next가 Ready를 표시하던 문제를 명시적 프로세스 종료로 수정했다. 실제 Vercel 런타임을 실행한 결과는 아니다.
- workflow YAML, 최소 읽기 권한, 가짜 CI env, Preview 회귀 단계, 보안 검사, diff 검사 검증. 원격 Actions는 미실행.
- 비밀정보 패턴·JWT 리터럴·운영 백업/비공개 산출물 검사 통과. 실제 JWT 리터럴 0개. 모의 데이터 응답은 실제 회원 데이터가 아니다.
- SQL 13개 원문은 변경하지 않았다. Windows/Linux checkout 바이트 보존을 유지한다.
- 읽기 전용 ls-remote 결과 GitHub main=d95bc684a45879255b61396fdaef46218be115ce, 원격 Hotfix branch 없음. fetch/push 없이 조회했다. 이 결과는 Vercel 설정 확인이 아니다.

검사 로그는 저장소 밖 OAZ-Main-Lab/push-prep-*.log 및 push-prep-lint-final.json에 있다. 기존 Main 미커밋 파일·docs의 내용 해시를 시작/종료 시 비교한다. 모든 조건 통과 후 명시적 파일 목록만 스테이징해 fix: prepare privacy hotfix for secure preview 메시지로 로컬 커밋한다. 최종 SHA는 Git 이력/작업 결과를 따른다. 운영 main 및 feature/main-integration에는 커밋하지 않는다.

최종 스테이징에서 SQL의 CRLF를 공백으로 오인하는 문제도 확인했다. .gitattributes에 cr-at-eol과 기존 blank-at-eol/blank-at-eof/space-before-tab 검사를 함께 명시했다. 실제 줄 끝 공백은 13개 SQL 모두 0줄이며 SQL 바이트/해시 변경 없이 staged diff --check가 통과했다.
