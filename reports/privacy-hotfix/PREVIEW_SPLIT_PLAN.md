# Hotfix Preview 분리·실행 계획 — 과거 계획

> 2026-11-03 변경: 이 문서의 세 번째 Supabase 프로젝트 생성 및 Preview 연결 제안은 더 이상 실행하지 않는다. Main/Demo 보존과 Free 쿼터 제약에 따라 LOCAL_SUPABASE_PLAN.md로 대체했다. 아래 내용은 이전 검토 기록이다. 현재는 Hotfix Vercel Git 자동 배포를 차단하고 로컬 Supabase / GitHub CI만 준비한다.

## 새로 확인된 원격 상태 (사용자 Dashboard 근거)

Vercel koreaoaz_main / Production Branch=main / Preview=All unassigned git branches. 일반 Preview NEXT_PUBLIC_SUPABASE_URL이 운영 Main을 가리킨다. 이번 Codex가 원격 설정을 직접 조회한 사실은 아니다. 현재 hotfix/privacy-p0 Push는 자동 Preview를 만들 수 있으므로 금지 상태를 유지한다. 독립 ref/공개키/접근 보호/OAuth가 미확인인 상황에서 READY로 표시하지 않는다.

## 사용자가 할 최소 설정

1. 새 Hotfix 전용 Supabase 테스트 프로젝트를 확보한다. 이름 예시 oaz-privacy-hotfix-test는 제안일 뿐 생성하지 않았다. 기존 Main/Demo를 사용하지 않는다. 설정에 사용할 실제 ref/URL·공개키 소속·가짜 데이터 범위를 확인한다. 키는 채팅/로그/소스에 공유하지 않는다.
2. Vercel 해당 프로젝트 Settings → Environment Variables에서 Environment=Preview, Git Branch=hotfix/privacy-p0로 다음을 모두 준비한다. Production 값/다른 Preview는 자동 수정하지 않는다.

| 변수 | Hotfix 브랜치의 설정 |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | 새 전용 프로젝트 HTTPS origin |
| NEXT_PUBLIC_SUPABASE_KEY | 같은 프로젝트 anon/publishable, secret/service_role 금지 |
| OAZ_PREVIEW_ISOLATED_REF | 같은 새 프로젝트 ref, Main 및 기존 Demo ref 차단 |
| NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN | 실제 승인된 Preview origin, slash/path/wildcard 없음 |
| NEXT_PUBLIC_OAZ_PRIVACY_V2 | 처음 false, 별도 DB·권한 검증 뒤 true로 재빌드 |

3. 다음 관련 변수도 동일 브랜치에서 확인한다: SUPABASE_URL, SUPABASE_STORAGE_URL, NEXT_PUBLIC_SUPABASE_STORAGE_URL, NEXT_PUBLIC_PROJECT_STORAGE_URL, SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_PROJECT_REF와 public ref 별칭. 사용하지 않으면 해당 Preview에 전달하지 않고, 사용할 별칭은 모두 같은 target/key와 맞춘다. 일부 주 변수만 덮어쓰는 것으로 완료하지 않는다.
4. 서버 service_role/secret/JWT secret, raw DATABASE/POSTGRES/PG 연결 변수, Demo visitor server key를 Hotfix Preview에 전달하지 않는다. Team Settings → Environment Variables의 Shared 변수 링크와 프로젝트 Integrations/Supabase 연결의 자동 주입·환경 범위를 함께 확인한다. 공유 변수를 팀 전체에서 삭제하거나 Production 연결을 변경하지 않는다. 브랜치 범위에서 제외할 수 없는 공유 secret이 있으면 별도 Vercel 테스트 프로젝트 또는 연결 분리 승인이 필요하며 계속 BLOCKED다.
5. Settings → Environments → Production → Branch Tracking=main을 확인한다. Preview branch tracking은 Hotfix에 적용되는지 확인한다. Settings → Deployment Protection에서 Preview 접근 제한을 확인한다. Node 24, npm run build, Vercel system env 사용도 확인한다. 실제 origin을 확인할 수 없으면 임의 호스트를 계산해 허용하지 않는다.

프로젝트별 변수는 동명/동일 환경의 Shared 변수보다 우선하고, branch 전용 Preview 변수는 일반 Preview보다 우선한다. Shared 변수 자체는 branch 전용 설정을 지원하지 않는다. Integration 및 로컬/배포 시 실제 병합 결과는 별도 확인한다. 공식 근거: https://vercel.com/docs/environment-variables 및 https://vercel.com/docs/environment-variables/shared-environment-variables . 이 원칙을 실제 계정에 적용·확인했다는 뜻은 아니다.

## 도구와 성공/실패 조건

- npm run audit:preview: 현재 process/기존 local env를 메모리에서 읽고, Preview 문맥/모든 알려진 Supabase·DB 변수와 custom alias의 고권한 키를 검사한다. 이름·존재·대상 일치 boolean만 출력한다. 값을 파일로 저장하지 않고 DB에 연결하지 않는다.
- 환경이 Preview가 아니거나 변수/콜백/키/ref가 누락·충돌하면 BLOCKED/고정 PREVIEW_STOP으로 종료한다. 원격 변수의 scope/source를 수집한 도구가 아니므로 remote_sources_verified와 remote_data_isolation_verified는 항상 false다.
- opaque publishable key는 값만으로 소속을 확인할 수 없다. Dashboard 확인이 필수다. 서명 검증 없는 legacy JWT ref 디코딩도 인증 성공 증명이 아니다.
- 빌드 전 CLI/next.config, Node startup와 client 생성에 같은 guard가 적용된다. 모든 관련 server env는 실제 process.env에서 검사하고 browser에 필요한 public alias도 빌드 시 검사한다. 민감 fallback은 없다.

현재 일반 Preview의 운영 URL만 있는 상태를 그대로 테스트하면 실패하는 것이 정상이다. 실제 검증하려고 운영 주소에 요청하지 않는다. 로컬 가짜 값 테스트의 PASS도 실제 환경 준비 완료로 바꾸지 않는다.

## OAuth와 Push 이후 순서 (이번 미실행)

새 테스트 Supabase Authentication → Sign In/Providers → GitHub에 별도 테스트 OAuth App을 연결한다. GitHub OAuth App의 Authorization callback은 새 Supabase origin/auth/v1/callback이다. Supabase Authentication → URL Configuration에는 정확한 Preview origin/login_callback, Preview origin/oauth_callback을 허용한다. Site URL도 테스트 환경 범위에서만 설정하며 Main/Demo의 Provider/Site URL/allowlist는 보존한다.

웹 로그인 시작은 Navigation의 GitHub 버튼, 가입 시작은 /signin이다. 전자는 /login_callback, 후자는 /oauth_callback으로 돌아온다. 로그아웃은 Navigation SDK signOut 버튼이며 별도 /logout 라우트는 없다. A/B는 분리 브라우저 프로필로 테스트하고 한 세션의 localStorage를 공유하지 않는다.

1. 독립 프로젝트·스키마·가짜 데이터·키 소속·Preview 보호·정확한 callback 준비를 확인한다.
2. 커밋 SHA와 사용자 Push/Preview 승인을 별도로 확인한다. Production main은 변경하지 않는다.
3. 승인 후 Hotfix만 push하면 GitHub CI와 Preview가 각각 시작될 수 있다. CI 성공 전에 Preview가 먼저 시작될 가능성이 있으므로 환경 준비를 Push 전에 끝낸다.
4. CI frontend job과 isolated-postgres job 둘 다 success인지 확인한다. Preview가 해당 branch override/일반 Preview/Shared/Integration 병합 후 안전한 대상인지 guard 출력과 Dashboard로 함께 확인한다.
5. Preview SHA 일치·접근 보호·테스트 프로젝트 연결을 확인한 후 가짜 A/B OAuth 성공/취소/실패, 승인/미승인 가입, 세션 만료/로그아웃, 관리자 Editor를 확인한다.
6. A가 B 개인정보를 직접 API로 읽지 못하는지와 donor 최소 컬럼, 승인 없는 RPC 거부, 기존 콘텐츠 기능을 가짜 데이터만으로 확인한다.
7. 오류나 guard STOP이면 재시도 배포/운영 URL fallback/Production 승격하지 않는다. Preview를 제한한 상태로 실제 병합 변수와 callback·스키마·권한을 수정/재검증한다. 기존 Main/Demo 및 운영 SQL은 별도 승인 단계다.

현재 최종 실행 판정은 BLOCKED다. 코드·도구·모의/격리 검증 준비와 실제 원격 환경 분리 확인을 구분한다.
