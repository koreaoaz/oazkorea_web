> 2026-11-03: 실제 CI 3 job과 격리 Supabase95 검증은 완료됐다. 최신 RC는 [PRODUCTION_RC.md](PRODUCTION_RC.md), 운영 순서는 [RUNBOOK.md](RUNBOOK.md), 독립 OAuth 실행은 [LOCAL_OAUTH_BROWSER.md](LOCAL_OAUTH_BROWSER.md)를 따른다. 브라우저 OAuth는 미검증이고 일반 Preview는 사용 금지다.

# GitHub CI 첫 실행 준비 결과

2026-11-03. 대상은 koreaoaz/oazkorea_web 저장소의 hotfix/privacy-p0 브랜치다.
작업 시작 HEAD는 9b1f9e1c53f706883be74421078c3b5a2bd40b36이며, 기존 미커밋 로컬 Supabase 변경을 보존하고 검토했다.
이 문서를 포함한 검증된 변경을 선택적으로 스테이징해 로컬 커밋한다. Push, PR, 배포, 운영 접속 및 SQL 적용은 하지 않는다.

## 배포 차단 근거와 한계

1. vercel.json의 git.deploymentEnabled는 hotfix/privacy-p0만 false다. 중복 true 규칙, ignoreCommand 덮어쓰기는 없다. main 기본 동작을 변경하지 않는다.
2. 사용자 Dashboard 확인: Vercel Production Branch=main, Ignored Build Step=Only build production.
3. 실제 Next 서버 시작 검사에서 Main Preview 대상, 높은 권한 키, 개발 빌드의 Preview 전용을 모두 거절했다.
4. CI에는 배포 작업, Vercel 토큰, repo/org secrets/vars 참조가 없다.

공식 동작: git.deploymentEnabled=false는 해당 브랜치의 Git 자동 배포를 방지한다. Only build production은 Production 이외 빌드를 건너뛰는 별도 장치다. Ignored Build Step만 사용하면 CANCELED 배포 기록이 남을 수 있으므로 브랜치 Git 차단을 주 장치로 유지한다.
- https://vercel.com/docs/project-configuration/git-configuration
- https://vercel.com/docs/project-configuration/project-settings

Codex가 Vercel API나 Dashboard의 현재 저장값을 직접 조회하거나 실제 차단 이벤트를 실행한 것은 아니다. 원격 저장값은 사용자 확인 근거이고, 원격 실동작은 미확인이다. 이 차이를 Push/배포 성공으로 바꾸어 표시하지 않는다.
사용자가 확인한 설정이 유지되고 이 vercel.json을 포함한 커밋을 게시한다는 조건에서 **CI 전용 Push 승인 대기**다. 설정이 다르거나 Git 차단이 적용되지 않는 근거가 있으면 Push를 보류한다.
일반 Preview의 Main 연결은 여전히 사용 금지다. 수동 배포/재배포/Deploy Hook은 이 승인 범위에 포함하지 않는다.

## Workflow 검토

- push는 hotfix/privacy-p0, pull_request와 workflow_dispatch도 정의. 실제 최초 실행은 승인 후 push 이벤트로 진행한다. 기본 브랜치에 workflow가 없으면 수동 실행 UI를 전제로 삼지 않는다.
- contents:read만 지정. 사용자 확인 Actions 허용 설정 및 읽기 기본 권한과 호환된다. PR 생성·승인 권한을 사용하지 않는다.
- checkout persist-credentials=false. 로컬 Supabase job은 이벤트의 정확한 head SHA를 checkout하고 일회성 runner 안에서만 브랜치 이름을 붙인다.
- validate: Node24, lockfile 설치, 타입/전체 lint/회귀/Preview 가드/보안 검사/flag OFF·ON 외부 통신 차단 빌드.
- isolated-postgres: 공식 SHA 고정 PG17.6 클라이언트/서버, 가짜 데이터, default grant ON/OFF. 고정 loopback 연결, finally 종료.
- local-supabase: 공식 setup-cli, CLI2.54.11, Docker loopback bridge. Auth/가입/REST/GraphQL/Storage SDK 통합. local stop은 always 실행하고 해당 프로젝트의 실행 중 컨테이너가 없는지도 확인한다. Docker context가 원격이면 stop도 거절한다.
- 로컬 DB 볼륨은 개발 환경에서 자동 삭제하지 않는다. CI 잔여 볼륨·네트워크는 GitHub-hosted runner 폐기 시 정리된다.
- 비밀 환경변수, 운영 endpoint, 운영 백업, 회원 데이터, artifact 업로드를 사용하지 않는다. 서비스 키는 새 로컬 stack의 값을 메모리에서만 사용한다.
- 오류를 무시하는 단계가 없다. 통합 실패 시 고정 phase만 출력하며 SQL/키/정책 원문은 출력하지 않는다.
- Forwarding_push.oaz는 기존 비활성 파일이다. GitHub가 실행하는 .yml/.yaml이 아니며 이번에 변경하거나 활성화하지 않았다.

## 이번에 보강한 오류 검출

GraphQL의 잘못된 필드/중단된 endpoint가 개인정보 차단으로 오인되지 않도록 동일 필드의 보호 전 가짜 데이터 정상 조회와 보호 후 공개 후원자 조회를 먼저 검증한다. 보호 후 개인정보 응답은 HTTP200의 GraphQL errors 및 data 부재를 확인한다.
REST 차단은 임의 오류 대신 PostgreSQL 권한 오류 42501을 요구한다. 인증 오류나 컬럼 오타, RPC 캐시 누락은 차단 성공으로 계산하지 않는다.
확장자 없는 설정과 .oaz도 포함해 모든 텍스트 파일을 민감정보 검사한다. 이전 Hotfix 커밋 2개의 변경 blob 121개도 검사해 발견 0이었다.

## 이번 실행의 검증 결과

| 검사 | 결과 |
| --- | --- |
| Hotfix 전체 회귀·SDK 모의·안전장치 | 73 성공 / 0 실패 / 0 건너뜀 |
| PG17.6 + 실제 PostgREST + 실제 pg_graphql | 334 성공 / 0 실패 |
| CI와 같은 SQL-only PG17.6, 자동 권한 ON / OFF | 각각 144 성공 / 0 실패 |
| 실제 Next 서버 시작 차단 | 3 성공 / 0 실패 |
| TypeScript | 오류 0 |
| 전체 ESLint | 오류 0 / 기존 no-img-element 경고 12 |
| 외부 통신 차단 flag OFF / ON 빌드 | 둘 다 통과 |
| Workflow YAML 구조·권한·이벤트·cleanup 및 Vercel 브랜치 규칙 | 회귀 테스트 통과 |
| SQL 후보 SHA-256 | 기존 bea86d888eea295c5ef092b2fa0f39955d494cf4b81a304615cf3079be57ed98 유지 |
| 민감정보 검사 / git diff --check | 통과 |

실제 전체 Supabase Auth/Storage Docker 통합 및 GitHub Actions는 아직 실행하지 않았다. PC Docker/CLI 미설치로 로컬 전체 stack은 미실행이며, 준비한 GitHub job의 첫 실행으로 검증한다. 위 성공 수치에 이 미실행 검사를 섞지 않는다.
실제 GitHub OAuth 왕복은 별도 Test App 작업이 남는다. CI의 가짜 provider metadata 테스트는 OAuth 성공 증거가 아니다. 이 제한은 CI 첫 실행을 막는 추가 클라우드 설정 요구가 아니다.

## 원격 대상 확인 및 다음 실행

읽기 전용 git ls-remote 결과: origin/main=d95bc684a45879255b61396fdaef46218be115ce, hotfix/privacy-p0 원격 브랜치 없음. Hotfix는 이 main의 후손이며 이 작업 전 로컬 Hotfix 커밋은 2개다. fetch는 하지 않았다.
Push URL은 github.com/koreaoaz/oazkorea_web 단일 대상이고 mirror 설정이 아니며 활성 Git hook도 없었다. 원격 main에 병합하지 않는다.

다음 작업에서 사용자에게 필요한 승인은 **이 검증된 Hotfix 커밋의 해당 브랜치 최초 Push와 CI 결과 조회**다. 배포, PR, 운영 SQL 승인은 포함하지 않는다.
승인 후 브랜치·HEAD가 최종 보고의 커밋과 같은지 다시 확인하고, 원격 브랜치가 그 사이 생겼다면 덮어쓰지 말고 관계부터 확인한다.

```powershell
Set-Location 'C:\Users\yjcha\OAZ-Workspace\oazkorea_web-privacy-hotfix'
```
```powershell
git status --short
```
```powershell
git branch --show-current
```
```powershell
git rev-parse HEAD
```
```powershell
git ls-remote --heads origin main hotfix/privacy-p0
```

위 조건이 일치하고 별도 승인을 받은 뒤에만 다음 한 브랜치 명령을 실행한다. 이번에는 실행하지 않는다.

```powershell
git push --set-upstream origin hotfix/privacy-p0:refs/heads/hotfix/privacy-p0
```

GitHub Actions의 Privacy hotfix에서 이벤트=push, 브랜치=hotfix/privacy-p0, head SHA 일치를 확인한다. validate / isolated-postgres / local-supabase 모두 success여야 CI 실환경 검증 통과다. skipped/cancelled는 성공으로 보지 않는다.
Vercel의 해당 SHA에 실행 가능한 Preview/Production이 만들어지지 않았는지도 확인한다. 예상치 못한 배포가 있으면 진행을 중단하고 Main 연결 Preview를 열어 기능을 시험하지 않는다.
실패 시 개인정보 보호 조건을 완화하지 않고 고정 STOP phase와 실패 job을 근거로 Hotfix에서 수정·재검증한다.

운영 SQL 및 Production 적용은 별도 NO-GO 상태다. 운영 정책 미적용으로 Critical3/High5 위험은 계속 남아 있다.
