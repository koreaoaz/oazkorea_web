# P0 개인정보 Hotfix — 운영 기준 d95bc68

최신 방향: 추가 클라우드 프로젝트 없이 로컬 Supabase와 GitHub CI를 사용한다. Main/Demo는 보존하고 Vercel Hotfix 자동 배포는 vercel.json으로 차단한다. 사용자 Dashboard에서 Production=main / Only build production도 확인됐다. 최신 CI 검증·커밋·승인 절차는 CI_RELEASE_READINESS.md를 따른다. 실제 Docker 전체 실행 및 원격 차단 실동작은 미확인이다. LOCAL_SUPABASE_PLAN.md는 로컬 실행 안내이며, 이전 PREVIEW_SPLIT_PLAN.md의 새 클라우드 프로젝트 제안은 폐기된 과거 계획이다.

작업 경로: C:/Users/yjcha/OAZ-Workspace/oazkorea_web-privacy-hotfix
브랜치: hotfix/privacy-p0. 시작 커밋 d95bc68. 원래 main과 feature/main-integration의 코드/작업 트리는 수정하지 않았다.
운영 DB·Auth·Storage 접속/변경, push, Vercel 배포는 수행하지 않았다. 이번 준비 단계에서는 검증한 Hotfix 파일만 전용 브랜치에 로컬 커밋한다. 운영 개인정보 위험 Critical 3 / High 5는 남아 있다.

## 선별 범위

- 개인정보 v3 RPC 클라이언트·응답 최소 컬럼 검사·안전 오류·feature flag만 선별했다.
  privacy policy 모듈의 새 관리자 시스템 의존성을 제거했다.
- 기존 Editor의 본인 supervisor UUID 판정을 유지하고 개인정보 보드만 분리했다.
  회원·승인 이메일·관리자 목록의 직접 wildcard SELECT·직접 편집·개인정보 ID 재정렬을 차단했다.
- 승인 이메일 추가는 approvals.write와 별도 SQL 활성화가 필요하다. 목록 조회 권한이 없어도 승인된 추가는 가능하다.
- 공개 후원자는 id/name만 조회한다. 편집은 이름만 RPC로 처리하며 별도 활성화 전 제한한다.
- 가입 화면의 익명 이메일 조회를 제거했다. getUser로 확인한 GitHub 이메일·UUID와 프로필만 등록한다.
  기존 회원은 자신의 UUID로 확인하며 기존 Auth 계정/회원 데이터를 바꾸지 않는다.
- OAuth 기본 Production 주소를 유지한다. 명시적으로 승인된 정확한 테스트 origin만 로컬/Preview 콜백에 사용할 수 있다.
  외부 returnTo/query 주소는 입력받지 않는다. 실제 Redirect URL allowlist는 아직 미확인이다.
- 기존 framework 타입 오류는 공지 상세 페이지의 params 타입 두 곳만 Promise로 수정했다.
  기존 코드가 이미 await params를 사용하고 있어 동작 변경은 없다. 빌드가 생성한 Next 16 타입 검사에 필요했다.

새 관리자 화면/API·계정/역할 생성·방문자 집계·일반 정렬 개선·공지 수정 기능의 신규 이식·Storage 정책은 포함하지 않았다.
010 SQL의 선택적 관리자 스키마 호환 처리는 검증된 원문 그대로이며 새 관리자 스키마를 설치하지 않는다.
테스트의 가짜 관리자 행은 격리 DB에만 존재한다. 운영용 SQL은 010 후보 하나이고 001/002/003 등은 가져오지 않았다.

## 네 전환 상태

| 상태 | 실제 동작 / 검증 | 제한·위험 |
| --- | --- | --- |
| A 기존 코드 + 기존 DB | 운영 기준 서비스 소스로 가짜 DB 응답 테스트. 기존 본인 UUID 로그인/Editor 계약 확인 | 기존 wildcard 개인정보 조회 위험이 존재함. 안전 상태로 표시하지 않음 |
| B Hotfix + 기존 DB, flag 미설정/false | 가입은 인증 후 본인 UUID/이메일만 사용. 기존 콘텐츠 경로 유지. 공개 후원자 이름 정상 | 개인정보 목록/편집은 네트워크 요청 전에 제한. 기존 DB의 공개 API 위험 자체는 SQL 적용까지 남음 |
| C Hotfix + 보호 DB, flag=false | 본인 UUID 로그인·기존 관리자 콘텐츠·승인된 가입·공개 후원자 이름 유지 | 개인정보 업무·후원 편집은 의도적으로 제한. 익명 이메일 명단을 복구하지 않음 |
| D Hotfix + 보호 DB, flag=true | 최소 RPC 사용. 실제 Hotfix 클라이언트와 로컬 PostgREST의 허용/차단 일치 확인 | 설치 직후 capability 0건, 후원·승인 쓰기 OFF. 별도 업무/쓰기 승인 전 일부 관리자 업무는 계속 제한 |

flag=true + 기존 DB처럼 RPC가 없는 조합은 오류를 표시하며 전체 SELECT로 되돌아가지 않는다.
flag는 NEXT_PUBLIC_OAZ_PRIVACY_V2이며 true만 활성이다. Next 공개 변수이므로 변경 시 새 빌드/배포가 필요하다.
flag는 UI 전환 장치이고 실제 개인정보 접근 통제는 DB RLS/GRANT/RPC가 강제한다.

## 기존 운영 preflight PASS

Git 밖 p0-preflight-20261103T055307Z-c455e513/result.json의 Main 프로젝트·PASS·ROLLBACK·적용 미실행을 확인했다.
그 결과는 운영 변경 승인이 아니다. 원본을 Git으로 복사하거나 수정하지 않았다.
결과 파일 자체에는 SQL/카탈로그 해시와 project ref 필드가 없어 실행 버전을 독립적으로 증명하지는 못한다.
별도 catalog-check-20261103T053221Z-eba7f9b5의 프로젝트 ref·수집 쿼리/SQL 해시와 현재 후보를 대조해 일치를 확인했다.
이 Hotfix의 SQL은 개발 경로의 검증 후보와 바이트 단위로 같다. 실제 적용 파일은 현재 지문을 잠금 전후 다시 검증한다.

## Auth/OAuth 상태

인증·가입 순수 로직과 모의 getUser, 별도 가짜 auth 테이블/JWT의 RLS는 검증했다.
실제 Supabase Auth 서비스·GitHub OAuth 왕복·Vercel Preview는 실행하지 않았다.
독립 검증에는 별도 테스트 Supabase 프로젝트/로컬 Auth, 가짜 계정, 검증 환경의 공개 URL/key,
Supabase의 두 정확한 callback allowlist 및 GitHub provider 설정이 필요하다. 운영 계정을 생성하거나 설정을 바꾸지 않았다.
Preview에서는 NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN에 정확한 origin(끝 slash 없음)을 명시한 뒤 두 콜백을 허용해야 한다.
Production에서는 이 테스트 설정을 비워 기존 www.oazkorea.co.kr 콜백을 유지한다.

## 의존성·CI·검증 환경

기존 로컬 node_modules를 junction으로 재사용했다. 추가 프로그램/런타임 설치나 온라인 패키지 설치는 하지 않았다. 별도 테스트 폴더에서 npm 캐시의 의존성을 실제 설치했다.
ESLint/Next 버전 정합성과 DOM 회귀를 위해 devDependency eslint-config-next 16.4.3, jsdom 30.1.3의 lock 메타데이터만
로컬 npm 캐시로 준비했다. 기존 운영 lock의 production 패키지 버전은 모두 보존했다.
이전 caniuse-lite의 부수 갱신도 되돌려 production 패키지 버전 변경을 없앴다.
개발 도구의 새 browserslist는 최신 caniuse-lite를 별도 중첩 dev 패키지로 사용한다.
이번 후속 작업에서는 별도 격리 폴더의 실제 npm ci --ignore-scripts --offline 설치도 통과했다(524 packages). GitHub Actions의 원격 Linux 실행은 아직 수행하지 않았다.

privacy-hotfix.yml은 타입·테스트·두 offline build·전체 lint를 검사한다. 전체 lint의 기존 오류를 면제하지 않는다.
전체 lint 오류 84건은 이번 후속 작업에서 0건으로 해결했다. 기존 img 최적화 권고 12건은 경고로 남아 있다. 원격 CI 성공으로 표시하지 않는다.
격리 DB 테스트는 Git 밖 검증된 EDB 17.6/PostgREST/native pg_graphql bundle을 재사용한다.
외부 호스트/운영 자격증명을 받는 테스트 인수는 없으며 실제 운영 백업 데이터도 사용하지 않는다.

최종 검증 수치와 배포 순서는 VALIDATION.md와 RUNBOOK.md를 따른다.

후속 마무리: 사용하지 않는 코드/타입/React effect 수정, 인증 상태 경쟁 조건 차단, OAuth 실패 콜백 거부, 공개키 보호, Preview 빌드 사전 검사, 전체 CI와 비밀정보 검사를 추가했다. 현재 수치와 외부 차단 조건은 VALIDATION.md 및 PREVIEW_AUTH.md를 따른다.

GitHub CI/Preview 준비 단계의 현재 결과와 원격 미확인 조건은 PUSH_PREPARATION.md를 따른다. 빌드 전·Next 설정·서버 시작·Supabase 클라이언트 생성에 공통 Preview 보호를 적용했다.
