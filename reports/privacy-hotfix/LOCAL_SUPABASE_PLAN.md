# 클라우드 추가 생성 없는 개인정보 Hotfix 검증

## 결정과 현재 한계

Main과 Demo를 보존한다. 세 번째 클라우드 Supabase를 만들거나 기존 프로젝트를 테스트용으로 바꾸지 않는다.
로컬 Supabase + GitHub Actions의 일회성 Docker 환경으로 전환한다. Vercel Preview에서는 이 로컬 DB에 접근할 수 없으므로 Preview 실행은 보류한다.

2026-11-03 PC 조사: Windows 11 Pro, RAM 약 8GB. Docker Desktop(시스템/사용자 설치 경로), Docker CLI/서비스, Supabase CLI를 찾지 못했다. WSL 실행 결과도 설치가 필요하다고 표시했다.
CIM 가상화 속성은 false로 보고되었다. 이것만으로 물리 CPU 미지원이라고 단정하지 않는다. 작업 관리자 성능/CPU의 가상화 상태와 BIOS 또는 상위 VM의 중첩 가상화를 사용자가 확인해야 한다.
시스템 설치, WSL 활성화, BIOS 변경은 수행하지 않았다. 따라서 **실제 로컬 Auth/Storage 통합 테스트는 미실행**이다.

공식 근거:
- https://supabase.com/docs/guides/local-development : Docker 호환 런타임, loopback 전용 네트워크, 로컬 실행은 프로젝트 쿼터 미사용.
- https://supabase.com/docs/guides/local-development/cli/getting-started : CLI 설치, Windows Docker 필요, 최초 이미지 다운로드.
- https://docs.docker.com/desktop/setup/install/windows-install/ : Windows/WSL2/가상화/8GB 요구 조건.
- https://vercel.com/docs/project-configuration/git-configuration : git.deploymentEnabled 브랜치별 차단.

## 준비한 로컬 실행 경계

- supabase/config.toml: 프로젝트 이름 oaz-privacy-local, API 127.0.0.1:56321, DB 포트 56322, PostgreSQL major 17. Auth/REST/GraphQL/Storage 활성화.
- CLI는 공식 릴리스 v2.54.11로 고정했다. 최신 CLI와 동일하다는 뜻이 아니다. 공식 릴리스 존재를 확인했다. 버전 변경은 별도 호환성 검증이 필요하다.
- scripts/local-supabase.mjs: 로컬 Docker Unix/npipe context만 허용. 원격 TCP/SSH context, 연결된 hosted project, 다른 브랜치를 거절한다. Main/Demo 자격증명은 하위 프로세스에 전달하지 않는다.
- com.docker.network.bridge.host_binding_ipv4=127.0.0.1 전용 bridge를 생성/검증한다. 시작 후 모든 공개 포트와 네트워크를 확인하고 불일치하면 해당 로컬 프로젝트를 중단한다.
- CLI status에 포함된 로컬 키는 메모리로만 처리하며 출력·파일 저장하지 않는다. 로그에는 고정 오류 코드만 남긴다.
- start/stop/check만 제공한다. login/link/push/reset은 제공하지 않는다. stop은 로컬 데이터를 삭제하는 명령이 아니다.
- 기본 테스트에는 Docker나 다운로드가 필요 없다. 실제 서비스 테스트는 test:local-supabase로 명시적으로 분리했다.

## 실제 SDK 통합 테스트의 범위

scripts/test-local-supabase.mjs는 검증된 로컬 컨테이너에서만 가짜 계정을 만든다. 비어 있지 않은 public 테이블이 있으면 중단한다. 재실행 시 자동 초기화하지 않는다.
가짜 A/B/관리자/승인 이메일, 실제 SDK 이메일 가입·로그인·로그아웃, public fixture, 고정 해시의 010 SQL, 사전/사후 검사, 본인 UUID/타인 거절, 승인/미승인 가입, 관리자 최소 RPC, 후원자 공개 컬럼, REST/GraphQL 개인정보 거절을 검사한다.
private Storage의 가짜 파일 업로드/다운로드와 타인·익명 차단도 검사한다. 이 쓰기 작업은 전용 로컬 환경에만 허용한다. 운영 백업은 읽지 않는다.
실제 GitHub OAuth 왕복 대신 로컬 Auth 가짜 계정의 provider metadata를 설정한다. **실제 OAuth 성공을 증명하지 않는다.**
기존 PG17.6/PostgREST/pg_graphql 격리 테스트는 별도로 유지하며, 기존 검증 SQL의 보호 조건을 완화하지 않는다. 로컬 managed Auth/Storage 및 기본 확장과 010 사전 조건이 충돌하면 통합 테스트는 실패한다. 이 조합은 Docker 준비 후 실제 실행으로 확인해야 한다.

실제 CI에서 고정 CLI의 기본 pg_graphql이 1.5.11인 것이 확인됐다. scripts/prepare-local-graphql.mjs는 테스트 시작 전에 빈 로컬 DB만 확인하고 공식 pg_graphql 1.6.3 pg17 amd64 배포 파일을 SHA-256 e827939c60bd1e0b861bf30206d04a274e354b1f8942d36fe4b7cd8889f4dc84로 검증한다. 아카이브의 정해진 일반 파일 3개만 사용하고, 일회성 DB 컨테이너의 확장을 준비한 뒤 재시작한다. PC에 PostgreSQL 패키지를 설치하지 않는다. 원격·다른 버전·다른 아키텍처·기존 가짜 계정/앱 데이터가 있는 DB는 거절한다. 운영 SQL 후보나 preflight의 버전 조건을 낮추지 않는다.

## 최소 사용자 작업과 실행 순서

1. 공식 Docker Desktop 설치 및 WSL2/Linux containers 준비. 필요 시 가상화 활성화 후 재부팅. RAM이 최소 수준이므로 다른 큰 작업을 종료하고 리소스를 확인한다.
2. 공식 Supabase CLI v2.54.11 Windows 바이너리를 공식 릴리스에서 받고 공개 체크섬을 확인한 뒤 사용자 PATH에 둔다. 프로젝트 node_modules는 원본 Main과 공유되므로 이 경로에서 npm install/ci를 실행하지 않는다.
3. 새 PowerShell에서 아래 명령을 하나씩 실행한다. DB 비밀번호, 운영 키, project ref는 입력하지 않는다.

```powershell
Set-Location 'C:\Users\yjcha\OAZ-Workspace\oazkorea_web-privacy-hotfix'
```
```powershell
supabase --version
```
```powershell
npm.cmd run local:start
```
```powershell
npm.cmd run local:check
```
```powershell
npm.cmd run test:local-supabase
```
```powershell
npm.cmd run local:stop
```

local:start가 LOCAL_STACK_PASS이고 통합 테스트가 LOCAL_SUPABASE_INTEGRATION_PASS여야 성공이다. STOP이면 테스트 성공으로 계산하지 않는다. CLI status 원문/키를 대화에 붙이지 않는다.
실패 후 가짜 데이터가 남을 수 있다. 자동 reset하지 않는다. 해당 로컬 프로젝트만 폐기할지 별도로 확인한 후 재시도한다.

## OAuth 실제 왕복

사용자가 별도 GitHub OAuth Test App을 만들어야 한다. callback은 http://127.0.0.1:56321/auth/v1/callback, 앱 origin은 http://127.0.0.1:3000이다.
그 후 로컬 Auth GitHub provider 설정에 테스트 App만 연결하고, 앱의 허용된 로컬 callback 설정과 로그인/가입 페이지 양쪽 왕복을 확인한다. client secret은 로컬 비공개 환경에서만 입력한다.
현재 provider는 설정하지 않았고 외부 OAuth도 실행하지 않았다. Main/Demo App, Site URL, allowlist 변경은 필요하지 않다.

UI 검증에는 별도 터미널에서 npm.cmd run local:dev를 사용한다. 로컬 stack 검증 후 anon 키만 메모리로 Next에 전달하며 서버는 127.0.0.1:3000으로 제한한다. 기존 클라우드 환경변수/높은 권한 키/VERCEL 문맥/NODE_OPTIONS를 상속하지 않는다. Next가 .env 파일에서 다시 운영 설정을 읽지 못하도록 해당 파일이 있으면 중단한다. 파일을 자동 삭제하거나 덮어쓰지 않는다. 이 UI 실행도 Docker 부재로 아직 검증하지 않았다.

## CI만 실행하고 Vercel은 차단

vercel.json은 hotfix/privacy-p0만 git.deploymentEnabled=false로 지정한다. main과 다른 브랜치 기본값은 건드리지 않는다. 겹치는 true 규칙은 넣지 않는다.
이 설정은 Git 자동 배포 경로의 차단이며, 수동 CLI 배포나 Deploy Hook을 전역 차단하는 수단은 아니다. 기존 Preview 환경변수의 Main 연결은 그대로 위험하다. 브라우저가 127.0.0.1에 접근한다고 Vercel 서버도 같은 DB를 사용할 수 있는 것은 아니다.

Push 전: 검증된 변경을 사용자 승인으로 커밋하고, 해당 커밋에 vercel.json이 포함됐으며 false 규칙이 유지되는지 확인한다. Vercel 대시보드의 프로젝트 Git 연결/상충 규칙과 수동 배포 자동화를 확인한다. 실제 원격 차단은 아직 검증되지 않았다.
사용자 Push 승인 후: 이 Hotfix 브랜치만 게시하고 GitHub Actions의 validate / isolated-postgres / local-supabase 세 job을 확인한다. Vercel 새 배포가 생성되지 않았는지도 확인한다. 예상치 못한 배포가 보이면 진행을 멈춘다. 기존 환경 가드도 Main Preview 대상 빌드/실행을 거절한다.
이전 로컬 환경 전환 단계에서는 커밋·push·배포를 실행하지 않았다. 이후 CI 준비 단계의 로컬 커밋 및 사용자 확인 설정은 CI_RELEASE_READINESS.md를 따른다. GitHub workflow_dispatch도 추가했으나 최초 원격 실행은 미검증이다. 수동 실행 UI는 기본 브랜치의 workflow 등록 조건에 따라 나타나지 않을 수 있다. 최초 검증은 승인된 Hotfix 브랜치 push 이벤트를 사용한다.

CI의 Ubuntu 로컬 Supabase job은 공식 setup-cli, 고정 CLI 버전, loopback 네트워크, 가짜 데이터만 사용한다. secret 참조·외부 DB 연결·배포 단계·민감한 artifact 업로드가 없다. 실패를 무시하지 않는다. 항상 로컬 stop을 시도한다.

## 운영 SQL 적용까지 남은 조건

Docker/CI에서 실제 Auth·Storage 통합 통과 → 별도 Test App OAuth 왕복 → 서비스 업무 권한 및 전환 상태 확인 → 최신 백업/복구 준비 → 최신 운영 preflight 일치와 사용자 적용 승인 → 호환 코드 배포 → SQL 적용 → REST/GraphQL 차단 및 가입/Editor 확인.
현재는 운영 SQL 적용 NO-GO다. 로컬/CI 준비 상태와 운영 보안 해결을 구분한다. 운영 SQL 미적용이므로 Critical 3 / High 5 위험은 계속 남는다.
