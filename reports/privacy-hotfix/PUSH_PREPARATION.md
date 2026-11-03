# GitHub CI / Preview push 준비 — 2026-11-03

현재 판정은 LOCAL READY이며, 로컬 검사가 모두 통과해 지정된 메시지로 Hotfix에만 커밋한다. 최종 커밋 SHA와 실제 완료 결과는 실행 결과에서 확인한다. 원격 설정을 직접 확인하지 못했으므로 PREVIEW READY가 아니다. Push/Preview 배포는 사용자 지시로 이번에는 실행하지 않는다.

## Git 범위 검토

운영 기준 d95bc68 대비 선택한 개인정보 변경과 이전 ESLint 정리 작업을 보존한다. 새 관리자 시스템·정렬 기능 개선·방문자 집계 방식은 추가하지 않는다. 개인정보 테이블 재정렬 거부, 기존 방문자/공개 API의 오류 메시지 정리, 공지 저장 실패 처리, 미사용 UI/import와 effect 정리는 기존 Hotfix에 이미 포함돼 있던 검증/안전성 변경이다. 관계없는 신규 기능은 없다.

보고서는 로컬 작성한 검증 요약·실행 계획만 포함한다. 비공개 seal/surface, 운영 카탈로그 원문, RLS 검사 원문, 백업과 개인정보 행은 포함하지 않는다. SQL 13개는 원래 개발 경로와 바이트 단위 동일한 검토 후보이며 운영 메타데이터 원본이 아니다. 테스트의 회원/이메일/JWT 응답은 가짜이고 실제 JWT 리터럴은 소스에 없다.

.gitignore는 환경파일·키·백업·운영 검사 디렉터리·Python 캐시를 제외한다. .gitattributes는 SQL 원문 바이트를 유지한다. 생성된 .next, node_modules junction, 로그, 독립 PG 서버와 npm 설치 폴더는 커밋 대상이 아니다. 변경 파일의 명시적 목록은 FILES.md를 따르며 파일명을 인수로 지정해 선택적으로 스테이징한다.

## 로컬 검사

전체 ESLint, TypeScript, Hotfix 회귀, Preview 빌드/서버/키/콜백/설정 불일치 회귀, flag OFF/ON 외부 차단 빌드, 실제 Next 시작 거부, PostgreSQL 17.6 REST/GraphQL 보안 검사, CI YAML·최소 권한 검사, 비밀정보/운영 산출물 검사, git diff --check를 실행한다. 원격 CI·Vercel Preview·실제 GitHub OAuth는 미실행이다. 자세한 로그 결과는 VALIDATION.md의 후속 기록을 따른다.

## 다음 승인 전에 필요한 최소 확인

1. Vercel Settings → Environments → Production → Branch Tracking=main. Preview에는 hotfix/privacy-p0가 해당하는지, push 자동 배포와 승격 조건을 확인한다.
2. Environment Variables → Preview → hotfix/privacy-p0 범위에 독립 Supabase URL/공개키/ref와 정확한 Preview OAuth origin, privacy flag=false를 준비한다. Production 공유 범위와 integration 주입도 확인한다. 키는 채팅/로그로 전달하지 않는다.
3. Settings → Deployment Protection에서 Preview에 적용되는 보호를 확인한다. Build Command는 npm run build, Node 24, system env 노출 설정을 확인한다.
4. 독립 Supabase Auth와 테스트 GitHub OAuth App을 준비한다. 가짜 A/B/관리자만 사용하고 운영 OAuth 자격증명을 재사용하지 않는다. PREVIEW_AUTH.md의 정확한 callback 종류를 따른다.

독립 프로젝트가 확인되지 않으면 Preview 실행은 BLOCKED다. 로컬 커밋 자체는 원격 실행을 승인하지 않는다. Push가 자동 Preview를 만들 수 있으므로 사용자 승인 및 위 설정 확인 전 Push를 보류한다.

## 승인 후 순서

로컬 SHA 검토 → 별도 Push/Preview 승인 → hotfix/privacy-p0만 push → GitHub CI SHA 확인 → Vercel Preview 환경 검사와 보호 확인 → 동일 SHA Preview 확인 → 가짜 계정 OAuth/가입/Editor/권한 거부 검증. 운영 main 병합·Production 배포·운영 SQL 적용은 각각 별도 단계다. 현재 운영 Critical 3 / High 5는 SQL 적용 전까지 남는다.

## 최종 실행 결과

전체 Hotfix 회귀 59/59, PostgreSQL 17.6 REST/GraphQL 332/332, 실제 Next 시작 거부 3/3 성공. TypeScript, flag OFF/ON 외부 차단 빌드, CI YAML/Preview 회귀, 비밀정보 검사, diff 검사 통과. ESLint 오류 0/기존 img 권고 12. 원격 CI/실제 Vercel/OAuth는 미실행이다. 별도 Preview 회귀 단계는 전체 59개에 포함된 9개이며 중복 합산하지 않는다.
검토한 명시적 변경 파일은 106개다. GitHub 원격 main=d95bc68은 읽기 전용 조회로 확인했다. Vercel 실제 Production/Preview 설정·격리 프로젝트·공개키의 실제 소속·보호 설정은 미확인이다. 코드 준비와 실제 Push/Preview 실행 승인을 구분한다.

최종 스테이징에서 SQL의 CRLF를 공백으로 오인하는 문제도 확인했다. .gitattributes에 cr-at-eol과 기존 blank-at-eol/blank-at-eof/space-before-tab 검사를 함께 명시했다. 실제 줄 끝 공백은 13개 SQL 모두 0줄이며 SQL 바이트/해시 변경 없이 staged diff --check가 통과했다.
