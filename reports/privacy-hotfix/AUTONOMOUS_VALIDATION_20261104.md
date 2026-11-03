# 개인정보 Hotfix 후속 리뷰·로컬 커밋 검증 — 2026-11-04

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
