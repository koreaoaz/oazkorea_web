# 독립 Preview / Auth 준비

## 확인한 사실과 미확인 사항

로컬 브랜치는 hotfix/privacy-p0이며 main이 아니다. 사용자가 제공한 Vercel 연결 저장소는 koreaoaz/oazkorea_web, Production Branch는 main이다. 현재 인증된 Vercel/GitHub CLI·커넥터 또는 로컬 .vercel 연결 정보가 없어 원격 설정을 독립 조회하지 못했다. 실제 Preview/Production 승격/환경변수/배포 보호/Redirect allowlist는 **미확인**이다.

Supabase/Docker 실행 파일과 사용 가능한 WSL도 없어 실제 로컬 Auth 서비스는 구성하지 않았다. 공식 클라이언트와 모의 Auth transport 테스트를 실제 서비스 테스트로 간주하지 않는다. 기존 PostgreSQL 17.6/PostgREST/pg_graphql 격리 환경은 재사용해 검증했다.

## 사용자에게 필요한 최소 Dashboard 작업

1. Vercel 프로젝트 Settings → Environments → Production → Branch Tracking에서 main을 확인(이전 UI는 Settings → Git). hotfix/privacy-p0를 Production으로 지정하거나 Promote 하지 않는다. push가 자동 Preview 배포를 일으킬 수 있으므로 push 승인 전에 아래 설정을 완료한다.
2. Settings → Environment Variables에서 **Preview + hotfix/privacy-p0 범위**에 독립 Supabase URL/공개키를 지정한다. 기존 Production 값을 복사하지 않는다. 실제 키는 채팅/로그/소스/명령 인수로 전달하지 않는다.
3. 설정할 변수:
   - NEXT_PUBLIC_SUPABASE_URL: 독립 프로젝트 HTTPS URL.
   - NEXT_PUBLIC_SUPABASE_KEY: 해당 프로젝트 publishable 또는 legacy anon key. service_role/secret 금지.
   - OAZ_PREVIEW_ISOLATED_REF: 독립 프로젝트 ref(Main ref 금지). 이것만으로 데이터가 가짜임을 입증하지 않으므로 프로젝트 내용도 확인한다.
   - NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN: 정확한 Preview branch origin, 마지막 slash 없음. VERCEL_BRANCH_URL 또는 VERCEL_URL과 일치해야 한다.
   - NEXT_PUBLIC_OAZ_PRIVACY_V2: 처음 false, 독립 DB에 검증된 SQL·권한을 준비한 후 true로 새 빌드.
4. Deployment Protection을 켜 승인된 검증자만 접근하도록 한다. Git branch 자동 Preview 여부와 Production 승격 권한도 확인한다. Build Command는 package.json의 npm run build를 사용해 사전 검사가 생략되지 않도록 한다. System Environment Variables 제공도 확인한다.
5. 독립 Supabase Dashboard → Authentication → Sign In / Providers → GitHub에 **테스트 OAuth App**의 정보만 로컬 Dashboard에서 설정한다. GitHub OAuth App의 Authorization callback은 독립 Supabase의 /auth/v1/callback이다. 운영 제공자 설정은 변경하지 않는다.
6. 독립 Supabase Authentication → URL Configuration에서 Site URL과 다음 정확한 URL 두 개를 허용한다: Preview origin + /login_callback, Preview origin + /oauth_callback. 넓은 wildcard/임의 returnTo 금지. Production의 테스트 origin은 비운다.

## 코드와 검증 계약

scripts/check-preview-env.mjs는 build 이전에 실행한다. Preview ref·URL·공개키 종류·JWT ref(legacy key인 경우)·branch·exact origin을 검사하며 값 대신 고정 오류 코드만 출력한다. Main target이나 알 수 없는 설정은 PREVIEW_STOP이다. 새 opaque publishable key는 값만으로 프로젝트를 증명할 수 없어 Dashboard 대조가 필수다. 로컬 환경 검사 PASS가 원격 DB 분리나 OAuth 성공을 의미하지 않는다.

현재 createClient 기본 flowType=implicit, persistSession=true, detectSessionInUrl=true를 유지한다. SDK가 URL 세션 처리를 맡고 앱은 getUser()로 확인한 UUID를 사용한다. 오류 callback은 인증/가입을 진행하지 않는다. PKCE는 활성화하지 않았으므로 code exchange endpoint를 추가하지 않았다. 향후 PKCE 전환은 별도 배포로 검증한다.

## 승인 후 수행할 정확한 순서

- 검토된 변경 파일만 로컬 커밋하고 SQL 바이트 해시·검사 결과를 기록한다. 미검토 파일을 일괄 스테이징하지 않는다.
- 사용자가 Hotfix push 및 Preview 공개를 명시적으로 승인한 뒤 hotfix/privacy-p0만 push한다. main merge 또는 Production deploy 금지 상태를 유지한다.
- GitHub CI의 실제 SHA와 Preview SHA가 동일한지 확인. CI는 읽기 권한·가짜 env·네트워크 차단 테스트/빌드이며, 운영 secret을 사용하지 않는다.
- Preview 환경 검사가 통과하고 Dashboard에서 독립 DB가 확인된 뒤에만 가짜 A/B 계정으로 테스트한다.
- A 승인/가입 성공, B 미승인 가입 거부, A가 B UUID/이메일 접근 불가, 기존 테스트 관리자 콘텐츠 편집, 공개 후원 id/name, capability 없는 후원/승인 쓰기 거부를 확인한다.
- 로그인 성공·취소·거부 callback, 이메일 미확인, 세션 만료·로그아웃 후 Editor 차단, 새 탭/재진입을 확인한다. 별도 테스트 관리자만 사용하며 운영 계정은 만들지 않는다.
- OFF/보호 DB/ON 전환을 Preview에서 검증하고 결과를 기록한 뒤 Production 적용 승인을 별도로 받는다.

## 공식 근거

- Supabase GitHub OAuth: https://supabase.com/docs/guides/auth/social-sign-in/auth-github
- Supabase OAuth SDK: https://supabase.com/docs/reference/javascript/auth-signinwithoauth
- Supabase PKCE: https://supabase.com/docs/guides/auth/sessions/pkce-flow
- Vercel 환경변수 범위: https://vercel.com/docs/environment-variables
- Vercel Preview 환경: https://vercel.com/docs/deployments/environments
- Vercel 배포 보호: https://vercel.com/docs/deployment-protection

공식 설명은 준비 절차의 근거이며 현재 계정 설정을 확인했다는 의미가 아니다.

## 이번 보강: 빌드와 서버 런타임

- 검사 로직은 src/lib/privacy/preview-environment.mjs 한 곳에서 공유한다. 빌드 전 CLI는 Next와 같은 dotenv 로딩을 사용한다. next.config.ts도 검사하므로 next build 직접 실행도 보호한다.
- next.config.ts는 배포 종류·브랜치·호스트·독립 ref의 공개 메타데이터만 빌드에 고정한다. 별도 비밀값이나 높은 권한 키를 추가하지 않는다. NEXT_PUBLIC_OAZ_DEPLOYMENT_* 등 내부 파생 변수는 Dashboard에 수동으로 설정하지 않는다.
- src/instrumentation.ts는 Node 서버 인스턴스 시작 때 빌드된 설정과 실제 runtime 설정을 모두 검사한다. 잘못된 설정은 고정 PREVIEW_STOP:SERVER_CONFIGURATION만 기록한 뒤 종료 코드 1로 프로세스를 끝낸다.
- 실제 Next 검사에서 instrumentation 예외만 던지면 Ready 표시 후 프로세스가 남는 상황을 발견했으므로, 명시적 프로세스 종료를 사용한다. Supabase 클라이언트 생성 직전에도 브라우저/서버 검사로 다시 거부한다.
- 빌드 시점이 development/production인 앱을 Preview로 그대로 승격하거나, 빌드 후 runtime의 URL/키/ref/콜백/브랜치가 바뀌면 실행을 거부한다. Preview는 올바른 환경변수로 다시 빌드해야 한다.
- npm run test:preview는 가짜 값으로 검사하는 회귀 테스트다. 실제 설정 확인 명령은 npm run check:preview이다. NOT_A_PREVIEW_BUILD를 실제 Preview PASS로 해석하지 않는다.
- npm run test:runtime는 이미 생성된 offline build를 이용한 로컬 시작 거부 검사다. 외부 통신은 child process의 preload guard로 차단하며 실제 DB/회원 데이터를 사용하지 않는다.

## 환경변수 우선순위와 남은 원격 확인

Vercel에서는 hotfix/privacy-p0 전용 Preview 변수가 일반 Preview의 동명 값보다 우선한다. Production 값이 Preview에도 범위 지정돼 있거나 Supabase integration이 공유 값을 주입하는지 확인해야 한다. 브랜치별 덮어쓰기를 설정했다는 사실만으로 전체 비밀값 분리가 증명되지는 않는다.
Next 로컬 로딩 순서는 이미 설정된 process.env, .env.production.local, .env.local, .env.production, .env 순서다(테스트 환경 제외 규칙은 Next 기본 동작을 따른다). 원격에서 전달된 값이 .env보다 우선할 수 있다. 저장소에는 .env를 커밋하지 않는다.

원격에서 확인할 항목은 Production branch, Preview branch tracking/자동 배포, 브랜치 전용 URL·키·ref 존재와 대상 일치, Production 공유 범위/Supabase integration, Deployment Protection, exact callback, Production 승격 권한이다. 현재는 모두 직접 확인하지 못했다. 로컬 보호가 있어도 독립 테스트 프로젝트의 존재와 가짜 데이터 여부는 Dashboard 증거가 필요하다.

OAuth 시작 경로: / 페이지 Navigation의 GitHub 로그인 버튼 또는 /signin의 가입 버튼. 로그인 복귀는 Preview origin/login_callback, 가입 복귀는 Preview origin/oauth_callback, 성공 후 메인 /로 이동/안내한다. 로그아웃은 Navigation 버튼의 SDK signOut 호출이며 별도 /logout 라우트는 없다. GitHub OAuth App의 콜백은 독립 Supabase origin/auth/v1/callback으로 앱의 두 콜백과 구별한다.

테스트 Supabase에는 개인정보가 없는 테스트 스키마/가짜 데이터가 준비돼 있어야 한다. 운영 백업을 Preview에 복원하지 않는다. tests/fixtures의 가짜 auth 스키마는 로컬 PostgreSQL 전용이며 Hosted Supabase Auth에 그대로 적용하지 않는다. 실제 가짜 테스트 계정은 독립 Auth 환경에서만 준비한다.
Node 버전은 package.json engines=24.x와 CI Node 24를 맞췄다. 원격 Build Command/Node override가 이를 덮어쓰지 않는지 확인한다. Node production 실행에서 배포 종류가 식별되지 않거나 Vercel Production이 main 이외 브랜치를 가리켜도 중단한다. Vercel system env를 숨긴 상태를 정상 Preview로 가정하지 않는다.

Preview는 이 앱에서 사용하지 않는 service_role/secret/JWT secret 및 raw Postgres 연결·비밀번호 변수도 존재하면 거부한다(UNNEEDED_SERVER_CREDENTIAL). integration이 자동 주입하는 Production 비밀변수를 Preview에 공유하지 않도록 범위를 확인한다. 추가 Supabase URL/anon-key 별칭과 public Storage URL도 다른 프로젝트를 가리키면 거부한다. 자의적인 변수 이름의 모든 비밀값을 완벽히 식별할 수 있는 것은 아니므로 Dashboard 전체 Preview 변수 범위 검토는 여전히 필요하다.
