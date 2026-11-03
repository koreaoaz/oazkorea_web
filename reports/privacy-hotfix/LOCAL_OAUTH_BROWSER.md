# 독립 GitHub OAuth 브라우저 검증

## 2026-11-04 현재 PC 재검증

후속 코드 리뷰에서는 Windows의 실제 수신 주소도 실행기가 자동 확인하고, GraphQL은 살아 있는 PostgreSQL 백엔드의 /proc 매핑 경로·inode·공식 파일 해시를 비교한다. metadata 버전만으로 통과하지 않는다. host bind/다른 이미지·컨테이너·비로컬 Docker pipe도 거절한다. 전체 회귀157·분리된 새 프로젝트95·강화된 Storage38·가짜 provider19를 최종 재검증했다. 사용자의 Localhost only 설정은 유지한다.

## 실행 파일 하나로 진행하는 순서

1. Hotfix 폴더의 **Start-Local-OAuth-Test.cmd**를 더블클릭한다. 사전 검사 후 LOCAL-TEST-APP, 독립 테스트 앱의 Client ID, 새 Client Secret을 입력한다. Secret은 로컬 숨김 입력에만 넣는다.
2. LOCAL_OAUTH_READY가 표시되면 **http://127.0.0.1:3000**을 브라우저에서 연다. GitHub 승인 화면의 앱 이름이 **OAZ Privacy Local OAuth Test**인지 확인하고 직접 인증한다. GitHub callback은 **http://127.0.0.1:56321/auth/v1/callback**이다.
3. 같은 실행 콘솔에서 아래 메뉴 번호를 사용한다. 별도 PowerShell 명령은 필요하지 않다.

| 입력 | 실제 동작과 확인할 내용 |
|---|---|
| 1 | GitHub identity·서버 세션·승인·회원 존재 여부를 boolean으로 표시. 브라우저 callback 복귀는 사용자가 함께 확인 |
| 2 | 현재 로컬 테스트 계정만 가입 승인. LOCAL-TEST-ACCOUNT-ONLY 확인 후 브라우저에서 가입을 다시 시험 |
| 3 | 기존 회원 분기를 위한 가짜 회원 행 준비. 확인 문구 필요, 기존 행은 덮어쓰지 않음 |
| 4 | 기존 설계의 관리자 화면 시험을 위한 로컬 supervisor 행 준비. 확인 문구 필요. 민감 업무 capability는 자동 부여하지 않음 |
| Enter | Next 자식·이 프로젝트 컨테이너 종료, 기본 config와 환경 정리. fake volume은 재사용하도록 보존 |

첫 계정의 미승인 가입 거부는 정상이다. 가입 승인 후 일반 사용자에서 Editor 거절, 로그아웃·재로그인, 취소·실패 안내를 확인한다. 관리자 준비 메뉴는 일반 사용자 거절을 먼저 확인한 뒤 필요할 때만 사용한다. 모든 실제 브라우저 결과는 아직 **OAUTH_BROWSER_NOT_VERIFIED**다. 메뉴1의 서버 증거를 실제 callback 왕복 완료로 자동 해석하지 않는다.

창 강제 종료 뒤에는 원래 프로세스가 종료됐는지 확인하고 **Recover-Local-OAuth.cmd**를 실행한다. 실행 중 owner나 다른 사용자의 컨테이너·동시 config 수정은 덮어쓰지 않는다. 복구기가 성공하면 LOCAL_OAUTH_RECOVERY_COMPLETE를 표시한다. 아래 명령 예시는 메뉴와 같은 기능을 수동으로 실행할 때의 선택 사항이다.

복구 기록에는 Secret 대신 소유한 컨테이너 ID와 Next PID·시작 시각·명령 해시만 저장한다. PID 재사용·다른 컨테이너는 보존한다. 정리에 실패하면 기본 config를 복원하고 복구 기록은 남긴다. 정보가 없는 시작 중 강제 중단이나 알 수 없는3000 포트 점유는 수동 검토가 필요할 수 있다. 이미 정상 정리됐으면 LOCAL_OAUTH_RECOVERY_NOT_REQUIRED로 종료한다. 이번 강제 중단 검사에서는 Next도 함께 종료됐고 남은 컨테이너와 잠금 복구를 확인했다.

Docker Desktop/Engine Linux 및 CLI2.54.11은 정상 응답한다. 사용자가 Desktop의 Port binding behavior를 Localhost only로 적용했다. 실제 Docker/Windows listener가 127.0.0.1/::1임을 확인했다. IPv6 localhost 오탐을 수정했으며 0.0.0.0/:: 및 LAN 주소 거절은 유지한다. 아래 2026-11-03 미설치 기록은 과거 상태이며 재설치 지시가 아니다.

실행기에 서비스 없는 sleep probe와 12GiB 디스크 사전 검사를 추가했다. 이제 실제 DB/Auth 시작 전 및 **Secret 입력 전** 기본 publish의 루프백 격리를 검사한다. 실패하면 Secret을 입력하지 않는다. 해당 probe의 컨테이너만 제거하며 기존 자산은 지우지 않는다. 작은 공식 gotrue 고정 이미지를 최초에 준비할 수 있다.

앞선 단계의 결과는 실제 로컬 Supabase95, 추가 Storage38(실제 Signed URL 만료 포함), 가짜 provider 새 fixture20/재시작19, 전체 회귀147, 실제 Next webpack OFF/ON HTTP 각76이다. 후속 최종157/95/38/19 재검증과 미검증 범위는 [자율 통합 검증 기록](AUTONOMOUS_VALIDATION_20261104.md)을 따른다. 재개 시 검증된 fixture만 재준비하며 DB를 재seed하지 않는다. 실제 GitHub 계정 인증은 **NOT_VERIFIED**이며 실제 Secret을 요청·입력·저장하지 않았다.

기존 `Start-Local-OAuth-Test.cmd`에서 실제 브라우저 검증을 시작할 수 있다. 독립 Test App의 실제 Secret은 그 실행기의 숨김 입력에만 입력한다. Next 개발 실행기는 이 PC에서 검증된 --webpack을 사용한다. 종료는 실행 콘솔 Enter, 비정상 종료 복구는 `Recover-Local-OAuth.cmd`다. 자동 검사 도구는 실제 GitHub 로그인을 대신하지 않는다.

2026-11-03. 독립 App은 사용자가 생성한 **OAZ Privacy Local OAuth Test**만 사용한다. 실제 OAuth 왕복은 아직 미실행이다. 이번 PC 조사에서 WSL 미설치, Docker Desktop/Engine 미확인으로 실행을 중단했다. Secret은 입력받지 않았고 운영/Demo/Auth/Vercel 설정은 변경하지 않았다.

## 2026-11-03 과거 PC 조사와 설치 안내 (현재 재설치 지시 아님)

| 항목 | 확인 결과 |
| --- | --- |
| Windows | Windows 11 Pro 10.0.26300 x64 |
| Node | 24.18.0 |
| WSL | wsl.exe는 있지만 status 종료50/list 종료1, 설치 안내 반환. WSL/VirtualMachinePlatform 기능 비활성(InstallState2), WSL/Ubuntu Appx 없음. WSL2 실행 불가 |
| Docker | Program Files 및 사용자 기본 위치 실행 파일 없음, PATH 명령/실행 프로세스 없음. Engine/container 미실행 |
| Supabase CLI | 공식 v2.54.11 portable을 build/tools/supabase-2.54.11에 준비, --version=2.54.11 확인. 시스템 설치/PATH 변경 없음 |
| 포트 | 3000·56320·56321·56322·5432 listen 충돌 없음. 실행 도구도 시작 직전 재검사 |
| 자원 | HypervisorPresent=true, 사용 가능 물리 메모리 약8GB. BIOS/SLAT 세부 상태는 확정하지 않음 |

CLI 출처: [Supabase 공식 v2.54.11 release](https://github.com/supabase/cli/releases/tag/v2.54.11). Windows amd64 archive SHA-256 `0dc069ca49021261c5f0b0d566c189567e597640f2943f7be4fe82bdd96cb7c6`, 추출 exe SHA-256 `e0216601cb495fab7f583dd1dd53a4954c40d73726ffcb35f7b5429eda795bf6`. 실행 도구가 exe hash를 다시 검사한다. Linux CI는 기존 setup-cli 2.54.11을 유지한다.

사용자 설치 순서(이번에는 실행하지 않음):

1. 시작 메뉴 → PowerShell 검색 → **관리자 권한으로 실행**. 아래 Microsoft 공식 설치 명령을 실행하고 재부팅한다. WSL2 활성화/시스템 변경 승인이 필요한 사용자 작업이다.

```powershell
wsl --install
```

2. 재부팅 후 Ubuntu 초기 사용자 설정을 완료한다. `wsl --version`, `wsl --list --verbose`에서 버전/배포판 VERSION2를 확인한다. 버전이 부족하면 공식 안내에 따라 `wsl --update`. 자동으로 BIOS나 Windows 기능을 변경하지 않는다.
3. [공식 Docker Windows 설치 페이지](https://docs.docker.com/desktop/setup/install/windows-install/) → Windows x86_64 다운로드 → 설치 실행 → WSL2 backend 선택 → 필요시 재부팅. 이미 설치되었다면 재설치하지 않는다. 현재 공식 WSL backend 최소 요구는 WSL2.1.5 이상이며 Windows Insider build의 지원 여부는 설치기에서 확인한다.
4. 시작 메뉴 → Docker Desktop 실행 → 약관을 직접 확인 → Settings → General의 WSL2 backend 확인 → Apply/Restart가 필요하면 사용자 실행. Linux Engine이 Running이 된 후 아래 CMD를 실행한다. 별도 Docker 계정 로그인이나 Production Supabase 로그인은 필요하지 않다.

공식 [Microsoft WSL 설치](https://learn.microsoft.com/en-us/windows/wsl/install), [Docker 설치/요구사항](https://docs.docker.com/desktop/setup/install/windows-install/).

## 안전한 실행과 Secret 입력 시점

Hotfix 루트의 **Start-Local-OAuth-Test.cmd**를 더블클릭한다. 관리자 실행은 필요하지 않다.

1. 브랜치/Node24/SQL13/CLI2.54.11/로컬 Docker endpoint/Linux Engine/포트/기존 volume 충돌 검사.
2. 모든 검사 통과 후에만 LOCAL-TEST-APP 확인, Client ID, **숨김 Client Secret 입력**을 요청한다.
3. GitHub → 우측 프로필 → Settings → Developer settings → OAuth Apps → **OAZ Privacy Local OAuth Test**에서 Client ID를 로컬 콘솔에 입력한다. 새 Secret도 그 콘솔의 숨김 입력에만 입력한다. 이전 폐기 Secret·운영/Demo Secret 사용 금지. Secret은 채팅/명령 인수/.env/Git/로그에 넣지 않는다.
4. 임시 config는 공식 `env(GITHUB_TEST_CLIENT_ID)` / `env(GITHUB_TEST_CLIENT_SECRET)` 참조만 포함한다. Secret 값은 파일에 저장하지 않는다. CLI start에만 전달하고 시작 직후 원본 config를 복구한다. Auth 컨테이너는 실행 중 provider 설정이 필요하므로 해당 환경에 값이 존재한다. Docker inspect/로그를 원문으로 공유하지 않는다.
5. 새 로컬 stack이면 기존 가짜 Auth·SQL·REST·GraphQL·Storage95 검사를 실행한다. 이미 이 도구가 초기화한 volume은 Git 제외 provenance와 postcheck로 확인하여 재개하며 재seed하지 않는다. 출처가 다른 기존 volume/container는 보존하고 중단한다. 자동 reset/volume 삭제 없음.
6. LOCAL_OAUTH_READY가 나오면 브라우저에서 **http://127.0.0.1:3000**을 연다. Next 로그·callback query/fragment·JWT·사용자 정보는 도구가 출력하지 않는다. 임시 설정/Secret을 CI에 전달하지 않는다.

앱과 supabase 폴더의 기존 .env 파일은 읽거나 지우지 않고 실행을 중단한다. 테스트 계정용 가짜 스키마는 최소 계약이며 운영 전체 UI 데이터 복제본이 아니다. 일부 공개 섹션/컬럼의 동작은 이 OAuth 검증만으로 보증하지 않는다. localhost 등 다른 origin에서는 운영 콜백 fallback 대신 오류로 중단한다.

릴리스 assets 검사는 기본 config 해시도 확인한다. 임시 provider 설정이 남아 있으면 Push 준비 검사를 통과하지 못한다. 실제 Secret은 임시 설정에도 들어가지 않는다.

CMD는 별도 PowerShell 프로세스에서 RemoteSigned 정책으로 로컬 파일을 실행한다. 사용자/컴퓨터 정책을 저장하지 않고 Group Policy를 우회하지 않는다. 조직 정책이 실행을 차단하면 담당자 승인이 필요하며 도구는 시스템 정책을 바꾸지 않는다.

## 실제 브라우저 검증 순서

고정 주소: 앱127.0.0.1:3000, API127.0.0.1:56321, GitHub callback `http://127.0.0.1:56321/auth/v1/callback`. 기존 Production 기본 redirect는 그대로이며 로컬 앱 프로세스에만 정확한 test origin을 전달한다. 임시 설정은 provider와 두 app callback을 연결한다. [공식 로컬 provider 설정](https://supabase.com/docs/guides/local-development/managing-config), [GitHub OAuth 안내](https://supabase.com/docs/guides/auth/social-sign-in/auth-github).

아래는 **실행해야 할 체크리스트**이며 현재 PASS가 아니다. 실제 인증은 사용자가 직접 한다. 가급적 별도 브라우저 프로필과 테스트 GitHub 계정을 사용한다. OAuth 승인 화면 App 이름이 다르면 즉시 취소한다.

1. 홈페이지 → Sign Up → 가짜 이름/학과/학번/연락처/기수 입력 → GitHub 인증 버튼.
2. GitHub 주소/별도 Test App 이름 확인 → 사용자가 로그인·승인 → local Supabase callback → local `/oauth_callback` 복귀. 운영 도메인으로 이동하면 중단.
3. 첫 계정은 로컬 승인 명단에 없으므로 가입 실패가 정상이다. Auth 세션은 발급될 수 있지만 회원/Editor 권한은 생기지 않아야 한다. DevTools에서 토큰/응답 원문을 복사하지 않는다.
4. 같은 실행 콘솔에서 **메뉴1**을 선택한다. SDK/서버 측 GitHub identity·세션·회원/승인 존재 여부 **boolean만** 표시한다. 가짜 app_metadata만으로 GitHub 인증 성공으로 세지 않는다. 별도 PowerShell을 사용하는 경우에만 아래 명령으로 같은 검사를 실행한다.

```powershell
node scripts/local-oauth.mjs verify
```

이 서버 증거만으로 앱 callback 왕복 완료라고 자동 판정하지 않는다. 브라우저 복귀 화면을 사용자가 함께 확인한다. 실제 GitHub identity가 정확히1명이어야 하며 여러 명이면 추측하지 않고 중단한다.

5. 승인된 신규 가입을 시험하려면 **메뉴2**로 로컬 fixture에만 승인 이메일을 추가한다. 로컬 계정의 검증 이메일을 메모리에서 얻어 사용하며 입력/출력하지 않는다. LOCAL-TEST-ACCOUNT-ONLY 확인이 필요하다. 아래 명령은 선택 사항이다.

```powershell
node scripts/local-oauth.mjs approve
```

6. Sign Up을 다시 진행하여 GitHub 왕복 후 가입 성공 확인. 로그아웃 → 일반 GitHub 로그인 → `/login_callback` → 홈 복귀 확인. verify로 memberPresent=true와 provider/session을 확인한다.
7. 기존 회원 분기를 따로 시험하려면 **메뉴3**으로 같은 로컬 GitHub UUID에 가짜 회원 행만 준비한 후 로그인한다. Production 회원 데이터를 가져오지 않는다. 아래 명령은 선택 사항이다.

```powershell
node scripts/local-oauth.mjs existing
```

8. 일반 계정에서 `/editor` 접근 거절 확인. UI 상태/localStorage 수정만으로 권한이 생기면 실패. 실제 DB 권한 위조·타인 정보 차단은 CI의 가짜 A/B 및 RLS/GRANT 검증과 함께 판단한다.
9. **정상 관리자 사전조건**을 시험할 때만 **메뉴4**로 이 로컬 계정에 가짜 supervisor 행을 준비한다. 이는 격리 테스트 fixture 준비이며 운영에서는 실행할 수 없다. 로그인 재실행 후 Editor 접근과 일반 콘텐츠를 확인한다. 민감 명단/선택 쓰기는 capability 승인 전 계속 제한되는 것이 정상이다. 아래 명령은 선택 사항이다.

```powershell
node scripts/local-oauth.mjs administrator
```

10. 로그아웃 후 Editor 접근 차단, 재로그인, GitHub 취소/거절, 잘못된 callback 오류 표시를 확인한다. 취소 시 기존 세션으로 성공 처리되지 않아야 한다. 만료 JWT/refresh 무효화는 기존 실제 local Supabase95 검사에도 포함된다.
11. 값 대신 항목별 PASS/FAIL/미실행만 기록한다. 테스트 종료는 실행 콘솔에서 Enter. 앱 자식 프로세스와 검증된 이 프로젝트의 컨테이너만 종료·제거하여 provider Secret 컨테이너 설정을 정리한다. volume은 보존한다. PowerShell finally가 환경변수/BSTR/SecureString을 정리한다.

## 실패와 복구

- Secret 입력 전에 Docker/CLI/포트 검사가 실패하면 설정은 바뀌지 않는다. 현재 PC에서 이 중단을 확인했다.
- 정상/인증 실패/초기화 실패/앱 오류에서 원본 config 복구·Secret 환경 제거·소유 컨테이너 정리를 시도한다. 동시에 사용자가 config를 수정하면 덮어쓰지 않고 복구 자료를 보존한다.
- 콘솔 강제 종료·전원 종료 시 finally 실행을 보장할 수 없다. 원래 실행 프로세스가 종료된 뒤 **Recover-Local-OAuth.cmd**를 실행한다. PID가 살아 있으면 중단하며 다른 프로세스를 임의 종료하지 않는다. 동시 config 변경은 수동 검토가 필요하다. 원본 backup에는 Secret이 없다.
- 종료된 테스트 volume에는 로컬 Auth/테스트 계정 정보가 남는다. Git 제외 상태로 보존하며 자동 업로드/삭제하지 않는다. 이 도구의 provenance가 있으면 같은 fixture를 재개한다. 다른 기존 volume은 삭제하지 말고 충돌 원인을 확인한다.

## Production 검사기 변경

기존 Supabase 연동의 서버 전용 Secret/JWT secret/Postgres password가 존재한다는 이유만으로 실패하지 않는다. 정확한 allowlist만 서버 전용으로 분리했다. Main/Demo URL·ref·JWT claim·Postgres host/user 조합이 명시적으로 다르면 중단한다. legacy anon JWT와 별도 publishable key가 동시에 존재해도 문자열 동일성을 요구하지 않는다.

서버 opaque key·JWT signing secret·범위 없는 shared pooler host는 오프라인으로 소속을 증명할 수 없으므로 unboundServerVariables 수로만 알리고 Dashboard 대조를 남긴다. 앱은 이 서버 연결 변수로 DB에 접속하지 않는다. 공개 변수에 service_role/secret/password/DB URI가 있으면 거절한다. 오류는 고정 코드만 출력한다.

**2026-11-03 조사에서는 Production에 NEXT_PUBLIC_OAZ_PRIVACY_V2가 없었다.** 이번에는 운영 환경을 재조회하지 않았다. 검사기는 누락된 flag를 계속 거절한다. 향후 승인된 호환 배포에서 명시적 문자열 false, SQL 적용/검증 뒤 true를 각각 확인하고 새 빌드해야 한다. 이번에는 Vercel 변수를 바꾸지 않았다.

## 2026-11-03 과거 로컬 검증

전체 회귀143 성공/실패0/건너뜀0, 그중 로컬 OAuth17개와 Production 검사17개 통과. 실제 SDK의 로컬 authorize URL 생성은 검증했으나 GitHub 브라우저 인증은 미실행이다. TypeScript0 오류, ESLint0 오류/기존 이미지 경고12, 외부 통신 차단 OFF/ON 빌드와 런타임 시작 차단3개 통과. PowerShell 구문 검사0 오류, 비대화형 실행은 Secret 입력 전에 예상대로 종료1. SQL13/hash·민감정보·diff 검사 통과. 실제 격리 Auth/REST/GraphQL/Storage95의 이번 커밋 결과는 후속 GitHub CI에서 확인하고 최종 실행 보고에 기록한다.
