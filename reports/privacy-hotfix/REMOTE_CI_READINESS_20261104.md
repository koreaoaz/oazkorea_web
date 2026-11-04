# 원격 CI 사전 준비·종료 확인·디스크 조사 — 2026-11-04

**구성 준비: PREPARED_FOR_REMOTE_CI / Push 안전성: NEEDS_VERCEL_CONFIRMATION / 운영: NO-GO.** 디스크 자동 정리는 정책 차단으로 부분완료다. Push·PR·배포·운영/Demo 접속·SQL은 실행하지 않았다. 이 문서는 이전 CI 준비 문서보다 최신 상태를 나타낸다.

## 1. 기준과 실제 종료 확인

- 시작 브랜치 `hotfix/privacy-p0`, HEAD `0a32ad71e6b32317c1e745495b83d00c5383bf1b`. 추적 변경 없음, 사용자 미추적 `AGENTS.md` 보존. 이번 변경은 문서뿐이며 선택적으로 로컬 커밋한다. 최종 커밋은 Git 이력과 `build/privacy-review/REMOTE_CI_FINAL_STATE.md`에 기록한다.
- 보호 대상 Main/Demo의 HEAD·작업 트리·미커밋 파일 지문, 기존 백업 파일 목록·크기·수정 시각, Docker/WSL/Git 설정 해시와 사용자 `AGENTS.md` 해시가 작업 전후 동일함을 확인했다. 백업 원문은 출력하지 않았다. Production/Demo 서비스에는 접속하지 않았다.
- 사용자가 정상 종료 표시를 확인한 뒤 실제 프로세스·포트·Docker를 읽기 전용으로 확인했다. 해당 OAuth Node/Hotfix Next 프로세스 없음, 포트 3000/56320/56321/56322 리스너 없음, 실행/중지 상태를 포함한 Docker 컨테이너 0개다. 다른 Node 프로세스는 보존했다. 서버 재시작·복구기 실행·추가 종료를 하지 않았다.
- `supabase/config.toml`은 HEAD와 바이트가 같고 고정 기본 해시도 일치한다. `.oauth-local`과 `.temp/project-ref`는 없다. 루트와 supabase의 dotenv 파일은 0개다. 임시 GitHub provider 블록이 복구됐으며 자격증명을 담던 Auth 컨테이너도 남아 있지 않다.
- PowerShell finally의 환경변수/BSTR/SecureString 정리와 Node lifecycle을 검토했다. 작업 초기 텍스트 220개와 문서 추가 후 221개, 소유 로그·증거 파일 27개, 시작 시 원격 Hotfix 기준 이후 로컬 커밋 3개의 변경 텍스트 blob 36개에서 검사한 비밀정보 서명은 발견되지 않았다. 임의 메모리·브라우저 저장소의 완전 소거를 증명한 것은 아니다. 토큰·Secret·개인 이메일은 수집하거나 출력하지 않았다.
- 로컬 DB/config/storage 볼륨 3개와 이미지 5개는 보존했다. `oaz-privacy-loopback` 네트워크는 연결 컨테이너 0개이며 기본 바인딩은 127.0.0.1이다. Docker Desktop/Engine와 docker-desktop WSL2는 계속 실행 중이다.
- 회원/identity/세션/감사 기록과 공지 id=34 삭제 결과는 직전 실제 DB 검증 근거를 재사용한다. 종료된 DB를 새로 시작하거나 계정/세션을 삭제하지 않았다. 볼륨 보존과 현재 실행 중인 로그인 세션의 검증은 구분한다.

## 2. C드라이브와 정리 결과

단위 GiB는 1,073,741,824바이트다. 14:39:59 KST 측정까지의 비교이며 문서·커밋 후 최종 측정은 위 로컬 상태 기록에 별도 남긴다.

| 항목 | 작업 시작 | 조사/정리 시도 후 |
|---|---:|---:|
| 전체 | 255,008,014,336 B | 동일 |
| 사용 | 236,144,250,880 B | 236,163,751,936 B |
| 여유 | 18,863,763,456 B (17.568 GiB) | 18,844,262,400 B (17.550 GiB) |

**실제 삭제 0개/0바이트, 직접 확보 0바이트.** 관측 여유 공간은 19,501,056바이트 감소했다. 백그라운드 사용량 변동을 정리 성과로 계산하지 않는다. 이전 12.06GiB 기록과 이번 시작 측정의 차이도 이번 작업의 확보량이 아니다.

| 조사 대상 | 관측 사용량 | 조치 |
|---|---:|---|
| Docker 이미지 5개 | 엔진 표시 합계 약 5.415GB | 기존 이미지 모두 보존 |
| Docker 컨테이너 / 빌드 캐시 | 0개 / 0B | 정리할 대상 없음 |
| DB/config/storage 볼륨 | 각각 약 68.81MB / 16.6kB / 17B | 회원·로그인 자료 포함, 모두 보존 |
| Docker WSL disk/docker_data.vhdx | 8,098,152,448 B | 파일 길이/할당량 동일, 보존 |
| Docker WSL main/ext4.vhdx | 100,663,296 B | 파일 길이/할당량 동일, 보존 |
| Hotfix `.next` | 635파일 / 445,479,203 B (약 425MiB) | 삭제 시도 자동 승인 검토가 `blocked by policy`로 거절, 전부 보존 |
| 공유 npm-cache | 4,887파일 / 730,146,067 B | 공유 캐시이므로 보존 |
| SQL 임시 폴더 | 8,940파일 / 721,966,719 B (약 0.672GiB) | 기존 정책 차단을 존중, 삭제 재시도 안 함 |
| `build/rc` 로그/증거 | 22파일 / 123,645 B | 재검증 근거로 보존 |
| `build/privacy-review` 증거 | 조사 당시 3파일 / 14,427 B | 보존, 이번 최종 기록 1개 추가 예정 |
| `build/oauth` fixture 출처 기록 | 1파일 / 149 B | 기존 볼륨 재사용 안전장치이므로 보존 |
| `build/review-tmp` | 2,320파일 / 12,031,435 B | 기존 검증 복사본/캐시, 추가 삭제 안 함 |
| `build/tools` | 2파일 / 60,176,728 B | Supabase CLI와 다운로드 압축본, 도구 재사용을 위해 보존 |

SQL 임시 폴더는 `C:/Users/yjcha/AppData/Local/Temp/oaz-privacy-autonomous-20261104`다. 공식 PostgreSQL17.6 바이너리와 synthetic DB 디렉터리 4개이며 링크는 없고 해당 postgres 프로세스도 없다. `.next`도 Hotfix 내부의 무링크·Git 미추적/ignored·비활성 Next 산출물임을 확인하고 정확한 경로만 삭제하도록 준비했으나, 명령 실행 전에 거절됐다. 다른 도구로 우회하지 않았다. 필요하면 사용자가 두 경로를 직접 재확인하여 수동 정리할 수 있다. 두 폴더의 합계 논리 용량 약 1.087GiB는 **미확보 추정치**이며 파일시스템 회수량 보장은 아니다. 공유 캐시·이미지·볼륨·VHDX 정리는 권장 실행 대상으로 넘기지 않는다.

## 3. 코드/SQL 및 이번 경량 검증

- 기능 코드는 `abd5e20`, 문서 기준은 `0a32ad7` 그대로다. canonical GitHub identity 상세 조회, IPv4/IPv6 정확한 localhost 검사, 실행 중 PostgreSQL의 GraphQL 라이브러리 경로/매핑 검증, OAuth 원본 설정 복구, 실제 Storage SDK 오류 판별이 포함돼 있다.
- 개인정보 보호 SQL 13개는 `RC_SQL_HASHES.json`과 전체 목록/바이트 해시가 일치한다. 콘텐츠 추가 SQL 2개도 별도 `content-write/HASHES.json`과 일치한다. 보호 SQL/해시/검사기를 변경하지 않았다.
- 이번 실행: `node --require ./scripts/offline-network.cjs --test --test-concurrency=1 tests/content-security.test.mjs tests/local-oauth.test.mjs tests/local-supabase.test.mjs` → **62 성공, 실패/건너뜀 0**. 로컬 안전장치·OAuth 정리/계정 선택·SQL/CI 순서·REST/GraphQL 오류 판별·Storage·바이너리 경로를 검증했다. 실제 Docker 통합 실행이라는 뜻은 아니다.
- 이전 동일 기능 코드의 실제 보안 통합 **457 assertion**, 전체 회귀 **168개**, 타입 오류 0, ESLint 오류 0/기존 경고 12를 재사용한다. 이번에 반복 실행하거나 새 결과와 합산하지 않았다. 대규모 빌드·이미지 다운로드·DB 재시작은 하지 않았다.
- 문서 최종 수정 후 assets/비밀정보 검사와 `git diff --check`를 재검사한다. 실제 OAuth 브라우저 검증은 기존 **OAUTH_BROWSER_VERIFIED_USER_ATTESTED** 완료를 유지한다.

## 4. GitHub Actions 준비 및 실패 진단

읽기 전용 `git ls-remote` 결과 원격 Hotfix는 `c7f6151ac87b26966f9748d368a4a8bea1e219b5`, main은 `d95bc684a45879255b61396fdaef46218be115ce`다. 원격 Hotfix는 로컬 HEAD의 조상이다. 원격 읽기/쓰기 URL은 지정 GitHub 저장소 단일 대상이다. fetch/Push는 하지 않았다. 과거 CI 성공을 최신 로컬 SHA 성공으로 사용하지 않는다.

| 이벤트/job | 현재 정의와 조건 |
|---|---|
| push | `hotfix/privacy-p0`에만 실행 |
| pull_request | 대상 브랜치 필터 없음. local-supabase는 head가 Hotfix일 때만 실행 |
| workflow_dispatch | 정의 있음. local-supabase는 선택 ref가 Hotfix여야 실행 |
| validate / Ubuntu / 20분 | Node24, lock 설치(ignore-scripts), 보안/타입/lint/Preview/전체 회귀, 외부 통신 차단 OFF/ON 빌드·runtime |
| isolated-postgres / Windows / 25분 | Python3.11, SHA 고정 공식 PG17.6 다운로드, 가짜 SQL 검사 자동 GRANT ON/OFF. Auth HTTP/GraphQL 통합을 대신하지 않음 |
| local-supabase / Ubuntu / 25분 | 정확한 이벤트 head SHA를 detached checkout 후 일회성 브랜치 생성. CLI2.54.11·Docker loopback fixture → 실제 Auth/REST/GraphQL/Storage 95 → 성공 출처 기록 → 추가 콘텐츠 SQL 적용/postcheck → 457 보안 검사. finally 성격의 `always()` stop |

현재 Hotfix Push 이벤트는 세 job 모두 실행하도록 구성되어 있다. 필수 통합/출처 기록/콘텐츠 검사 단계에 오류 무시·조건부 건너뜀이 없음을 경량 테스트로 확인했다. workflow 권한은 `contents: read`, checkout 자격증명 저장은 꺼져 있다. secrets/vars 참조·운영 접속·artifact 업로드·배포 단계가 없다. `.oaz` 확장자 기존 파일은 실행 workflow가 아니다. CI가 가짜 자격증명을 생성해 메모리에서 사용하는 것과 GitHub/운영 Secret을 사용하는 것은 다르다.

원격 runner의 실제 Docker 상태·포트 동작·외부 배포처 다운로드·npm 설치·시간 제한은 미실행이다. 실제 3 job의 **동일 최종 SHA success**가 필요하며 skip/cancel/timeout은 통과가 아니다. 실패하면 해당 job/step/고정 진단 phase를 기록하고 바인딩·용량·버전/해시·서비스 readiness·SQL postcheck를 분리해 조사한다. 키가 들어갈 수 있는 docker inspect 전체 Env, 로컬 status 전체, 무가공 Auth 로그를 출력/업로드하지 않는다. 재시도 전에 원인을 수정하며 권한·보안 가드를 완화하지 않는다.

## 5. Vercel — Push 보류

현재 파일과 이미 원격에 있는 c7f6151의 `vercel.json` 모두 `git.deploymentEnabled: { "hotfix/privacy-p0": false }`만 갖는다. 중복 true 규칙/ignoreCommand는 없다. 공식 문서는 이 설정을 해당 브랜치 커밋의 Git 자동 배포 차단으로 설명한다. 미지정 브랜치는 기본 true이고 겹치는 true 규칙이 있으면 배포될 수 있다. [Vercel Git 설정](https://vercel.com/docs/project-configuration/git-configuration).

`Ignored Build Step=Only build production`은 보조적인 빌드 제어다. 명령은 BUILDING에서 실행되며 exit0은 CANCELED 배포가 되므로, 배포 생성 자체가 없다는 증거가 아니다. [Vercel 프로젝트 설정](https://vercel.com/docs/project-configuration/project-settings).

GitHub Actions와 Vercel Git integration은 같은 Push에 독립적으로 반응할 수 있다. CI에 deploy 단계가 없다는 사실만으로 Vercel Preview가 차단되지는 않는다. [Vercel Git 배포](https://vercel.com/docs/git). 현재 Dashboard/API 연결로 실제 설정을 조회하지 않았고 로컬 `.vercel` 연결 기록도 없다. 과거 사용자의 Production Branch=main/Only build production 확인은 현재 확인으로 대체하지 않는다. Preview가 Production Supabase를 참조할 위험도 현재 해소됐다고 판단하지 않는다.

사용자가 **설정값을 변경하지 말고 먼저 확인할 항목**:

1. Vercel `koreaoaz_main`의 Settings → Git에서 저장소가 `koreaoaz/oazkorea_web`인지, Build and Deployment의 Root Directory/설정 파일 위치가 위 `vercel.json`을 반영하는지 확인한다. 동일 저장소에 연결된 다른 프로젝트·사용자 지정 환경도 Hotfix를 자동 배포하는지 확인한다.
2. Settings → Environments → Production의 Branch Tracking(구 UI는 Git)이 **main**인지, Preview/custom branch tracking이 Hotfix를 자동 배포하도록 별도 지정돼 있지 않은지 확인한다. 위 브랜치 Git 차단이 실제 프로젝트에서 적용된다는 근거가 없으면 Push 보류다.
3. Build and Deployment → Ignored Build Step의 현재 값을 확인한다. 과거 Only build production 기록만 믿거나 이 설정 하나로 배포 생성 차단을 확정하지 않는다.
4. Environment Variables/공유 변수/Supabase integration의 Preview 범위가 Production을 참조하는지 값 공개 없이 확인한다. 운영 키·Secret을 채팅/보고서에 복사하지 않는다. Main 연결 Preview는 열어 시험하지 않는다.
5. GitHub Settings → Actions의 workflow 허용/읽기 권한을 확인한다. Vercel 위험 해소와 **별도 Hotfix Push 승인** 후에만 한 브랜치 게시/동일 SHA 3 job 확인을 진행한다. 배포·PR·main 병합 승인은 별개다.

배포 없이 CI만 실행하는 방법은 Vercel Git 배포 차단을 먼저 확인한 뒤 승인된 Hotfix Push로 세 job을 실행하는 것이다. 이미 게시된 동일 SHA라면 수동 dispatch를 검토할 수 있지만, workflow는 default branch에 존재해야 하고 선택한 ref의 코드를 실행한다. 이번에 관측한 원격 main과 동일한 로컬 Git 객체에는 이 workflow가 없다. 미게시 로컬 HEAD를 dispatch로 실행할 수 없으며 버튼을 만들기 위해 main을 변경하지 않는다. [GitHub 수동 실행 조건](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow). Vercel 차단을 입증할 수 없으면 현재 저장소 Push는 안전하지 않다고 판단하고 중단한다. 이번에는 원격 workflow도 실행하지 않았다.

## 6. 운영 SQL 검토와 남은 승인

운영 스키마가 로컬과 같다는 근거는 없다. 기존 13개 원문은 보존하며 010-body/api-guard는 단독 실행하지 않는다. 정확한 순서는 **최신 운영 조사/백업·격리 복원/대상 seal·운영 전용 콘텐츠 변경안 승인 → flag OFF 호환 배포 → 전체 010-privacy-minimal.sql 자체 트랜잭션 → 010-postcheck → 별도 승인된 운영용 콘텐츠 보호 트랜잭션 → 두 postcheck/정상 관리자·일반/회수 JWT REST·GraphQL 검사 → flag ON 새 빌드 → 로그인/기능/보안 확인**이다. 선택 donor011/approval012는 이름이 겹치는 콘텐츠 파일과 별개이며 자동 활성화하지 않는다.

로컬 `content-write/011-content-write-guard.sql`은 로컬 fixture 선언을 요구하는 후보이므로 그대로 운영에 적용할 수 없다. 운영의 정책/ACL/열별 GRANT/상속·소유권/BYPASSRLS/뷰/RPC·SECURITY DEFINER/트리거/관리자 조건과 7개 콘텐츠 업무를 조사하고, 운영 전용 대상 검증·해시·변경 승인안을 준비해야 한다. permissive OR와 restrictive AND의 조합 때문에 기존 합법 관리자도 차단될 수 있어 격리 호환 검증이 필요하다. Storage bucket 공개 여부·객체 정책·실제 bytes 백업/복원 범위는 로컬 통합만으로 증명되지 않는다.

두 자체 BEGIN/COMMIT을 외부 트랜잭션으로 중첩하지 않는다. 적용 사이에는 승인된 **서버 측 쓰기 동결/점검 창**이 필요하며 UI 숨김으로 대신하지 않는다. 잠금/timeout·drift·기능 차단·검사 실패 시 진행과 ON 빌드를 중단한다. 010 실패는 rollback 확인, commit 후 문제는 fail-closed 정책과 쓰기 동결을 유지하고 별도 복구 승인을 받는다. 010-recovery는 추가 콘텐츠 정책을 제거하지 않으며 일반 콘텐츠 REST 쓰기 전체 동결을 대신하지도 않는다. 구형 코드 재배포/GRANT 확대/제한 정책 삭제를 자동 복구로 사용하지 않는다. 운영 중단 가능성과 담당자·복구 시간을 사전 승인해야 한다.

| 구분 | 완료/남은 작업 |
|---|---|
| A 자동 완료 | 실제 종료 확인, 디스크 조사/정리 차단 기록, SQL 무결성/소스·CI 검토, 경량62 검사, 비밀정보 검사, 문서 갱신/선택 로컬 커밋 |
| B 사용자 화면 확인 | 현재 Vercel 연결/branch/Root Directory/빌드 중단/Preview 변수 범위 및 GitHub Actions 허용 |
| C 별도 승인 필요 | 위험 해소 후 GitHub Push/원격 CI, 최신 운영 읽기 전용 조사와 새 백업·격리 복원, 운영 전용 SQL안, 점검 창, 운영 코드/DB 변경 |
| D 운영 장애물 | 최신 SHA 원격 CI 미실행, 현재 운영 정책/환경·Storage 미확인, 최신 백업·복원 검증 없음, 운영 전용 콘텐츠 migration/seal·쓰기 동결·업무/복구 검증 및 배포 승인 없음 |

기존 OAuth/가입/권한 회수 브라우저 검증은 완료를 유지한다. 위 장애물이 해결되기 전 **Production NO-GO**이며 Push·PR·main 변경·Preview/Production 배포·운영 SQL은 이번 작업 범위 밖이다.
