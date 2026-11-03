# 개인정보 Hotfix 운영 실행 순서

2026-11-03 갱신. 상세 근거는 [PRODUCTION_RC.md](PRODUCTION_RC.md). **현재 운영 NO-GO이며 실행 승인이 아니다.** Preview/main/운영 SQL 변경을 이번에 수행하지 않았다. 기존 CI는 실제 3 job 통과, 실제 GitHub OAuth 왕복은 미검증이다.

## 단계별 성공과 중단 조건

| 순서 | 실행 주체와 작업 | 성공 조건 | 실패 시 조치 |
| --- | --- | --- | --- |
| 1 | Codex: Hotfix 로컬 검사와 해당 SHA CI | assets/보안/타입/lint/회귀/두 build, 3 job 성공 | SHA 변경·skip·실패 중단 |
| 2 | 사용자: 환경/두 callback/독립 OAuth | RC 환경 표 일치, 로컬 실제 GitHub 왕복 | Preview/운영 provider 변경으로 우회 금지 |
| 3 | 사용자: 최신 백업과 복구 담당자 | 새 run verify, 안전 사본, 제한 복구·완전 복구 미검증 한계 수용 | 백업 불일치/담당자 없으면 중단 |
| 4 | 사용자: 읽기 전용 preflight | SQL13 동일, Main PG17.6, seal drift 없음, PASS+ROLLBACK | P0_STOP 원인 검토. 지문 강제 교체 금지 |
| 5 | 사용자: 별도 운영 승인 | exact code SHA·SQL hash·시간·담당자·업무 제한·복구 범위 승인 | PASS를 변경 승인으로 취급하지 않음 |
| 6 | 승인 후 담당자: false 호환 코드 배포 | main 승인 SHA, 환경 precheck, Ready/domain/flag 확인 | SQL 보류, 코드 실패 해결. DB 위험 계속 남음 |
| 7 | 승인 후 DB 담당자: 010 적용 | 최신 preflight, 세션 선언, SQL 전체 단일 transaction 성공 | 오류/lock timeout은 rollback 확인. 분할/자동 재시도 금지 |
| 8 | DB 담당자: postcheck와 무행 API 검사 | 고정 PASS, 개인정보 권한 거절, 공개 donor 계약 유지 | 보호 유지, 필요시 승인된 010-recovery |
| 9 | 담당자: true 보호 코드 새 빌드 | protected 환경 precheck, exact SHA/flag 확인 | false 호환 Hotfix 유지 가능. DB 보호는 복구 취소 금지 |
| 10 | 사용자/담당자: 로그인·기존 Editor | 본인 로그인/일반 콘텐츠/공개 donor, 무권한 거절 | 실제 회원 bulk 조회/쓰기 시험 금지 |
| 11 | 별도 선택 업무 승인 | 후원 편집011, 승인 추가는 개별 capability+012 | 최초 설치와 자동 실행 금지 |

호환 코드 단계에서 민감 명단·후원 편집·승인 추가는 제한된다. 일반 콘텐츠 경로는 유지한다. 코드와 SQL 간격을 점검 창 안에서 최소화한다. 열려 있던 구형 탭은 SQL 후 일부 기능이 실패할 수 있어 새로고침을 안내한다. 구형 코드+보호 DB를 최종 상태로 사용하지 않는다.

## 지금 실행 가능한 오프라인 명령

PowerShell에서 하나씩 실행한다. 운영 접속/배포 없음.

```powershell
Set-Location 'C:/Users/yjcha/OAZ-Workspace/oazkorea_web-privacy-hotfix'
```

```powershell
node scripts/check-production-release.mjs assets
```

```powershell
& 'C:/Users/yjcha/AppData/Local/Programs/Python/Python311/python.exe' -B scripts/main-p0-preflight.py plan
```

## 사용자가 점검 창에 실행할 읽기 전용 검사

아래 check만 운영 접속한다. 로컬 숨김 입력이 필요하다. Codex는 이번에 실행하지 않았다. 정책 변경 없이 검사 후 ROLLBACK한다.

```powershell
& 'C:/Users/yjcha/AppData/Local/Programs/Python/Python311/python.exe' -B scripts/main-p0-preflight.py check
```

입력: Main ref, 다운로드한 CA 절대 경로, REVIEWED-API-SURFACE, RUN-READONLY-PREFLIGHT, 숨김 DB 비밀번호. Dashboard의 public+graphql_public / public+extensions / 자동 노출 ON을 직접 확인한다. SSL verify-full과 Session pooler 유지. PASS: read_only_preflight_and_rollback 및 Git 밖 새 p0-preflight-.../result.json이 성공 조건이다. 인증 오류는 재시도하지 않는다. 고정 기존 seal과 달라지면 별도 검토하며 새 지문을 임의 대입하지 않는다.

최신 백업은 기존 도구로 새 run에 저장한다. 이번에는 실행하지 않았다.

```powershell
& 'C:/Users/yjcha/OAZ-Workspace/OAZ-Main-Backup/Start-Main-Backup.cmd'
```

성공한 새 폴더 이름을 NEW_RUN_FOLDER 대신 넣어 오프라인 검사한다. 실제 데이터/SQL 원문은 출력하지 않는다. 기존 도구는 백업 폴더 ACL을 제한할 수 있으므로 이 명령도 사용자 실행 단계이며 이번에는 원본 보존을 위해 별도 읽기 전용 해시/디코딩 검사만 수행했다.

```powershell
& 'C:/Users/yjcha/AppData/Local/Programs/Python/Python311/python.exe' -B 'C:/Users/yjcha/OAZ-Workspace/OAZ-Main-Backup/backup.py' verify --path 'C:/Users/yjcha/OAZ-Workspace/OAZ-Main-Backup/NEW_RUN_FOLDER' --pg-bin 'C:/Users/yjcha/OAZ-Workspace/OAZ-Main-Backup/clients-edb-18.6-5/pgsql/bin'
```

## 향후 승인된 운영 명령과 조건

**아래는 이번에 실행하지 않는 담당자 절차다.** 실제 쓰기를 자동화하는 새 실행기는 만들지 않았다.

1. Vercel Production 변수를 RC 표와 확인한다. Build Command는 `node scripts/check-production-release.mjs environment compatibility && npm run build`, flag=false. main 업데이트는 자동 Production 배포를 유발할 수 있어 환경과 승인을 먼저 준비한다. Hotfix 자동 배포 차단 유지.
2. main 배포는 별도 새 release checkout에서만 한다. 기존 worktree를 checkout/reset하지 않는다. 아래 APPROVED_SHA는 승인된 실제 40자리 SHA로 대체한다. remote main이 d95bc68에서 달라졌으면 중단한다.

```powershell
git ls-remote origin refs/heads/main refs/heads/hotfix/privacy-p0
```

```powershell
git worktree add --detach 'C:/Users/yjcha/OAZ-Workspace/oaz-production-release' APPROVED_SHA
```

```powershell
git -C 'C:/Users/yjcha/OAZ-Workspace/oaz-production-release' merge-base --is-ancestor d95bc684a45879255b61396fdaef46218be115ce HEAD
```

```powershell
git -C 'C:/Users/yjcha/OAZ-Workspace/oaz-production-release' push origin HEAD:refs/heads/main
```

이 main push는 **향후 별도 운영 승인 전 금지**다. force 금지. 경로가 있으면 덮어쓰지 않는다. 원격 main이 바뀌면 재검토한다. 브랜치 보호가 거절하면 우회하지 않고 조직의 승인 절차를 따른다. 이번에는 PR도 생성하지 않았다. Vercel에서 source SHA·Production scope·precheck·Ready·도메인을 확인한다. 일반 Preview를 promote하지 않는다.

3. DB 담당자가 Supabase Dashboard → SQL Editor에서 Main ref를 확인한다. 아래 선언과 봉인된 010-privacy-minimal.sql **전체 원문을 같은 실행 배치**에 넣는다. PRIVATE_REVIEWED_CATALOG_SHA256은 비공개 seal의 검토된 64자리 값으로만 대체하고 Git/보고서에 복사하지 않는다. 선언은 실제 운영 승인을 대신하지 않는다.

```sql
SET oaz.approve_privacy_v3 = 'yes';
SET oaz.privacy_surface_review_approved = 'yes';
SET oaz.privacy_exposed_schemas = '["public","graphql_public"]';
SET oaz.privacy_extra_search_path = '["public","extensions"]';
SET oaz.privacy_auto_expose_new_tables = 'on';
SET oaz.privacy_expected_catalog_sha256 = 'PRIVATE_REVIEWED_CATALOG_SHA256';
-- Append the complete hash-verified 010-privacy-minimal.sql before executing.
```

010 파일 자체에 BEGIN/COMMIT·잠금 전후 사전 검사·사후 검사가 있다. 외부 BEGIN으로 중첩하지 않는다. body/api-guard fragment 단독 실행 또는 수작업 재조립 금지. Dashboard 연결 역할/권한이 preflight와 다르거나 timeout이면 중단한다. 실패 연결은 rollback 확인 후 닫는다.

4. 새 SQL Editor 실행에서 010-postcheck.sql 전체를 실행한다. P0_V3_POSTCHECK_PASS_METADATA_ONLY 필요. 회원 행을 출력하지 않는다. RPC schema cache 미발견은 권한 차단 성공이 아니다. 필요하면 담당자 별도 승인 후 cache reload만 수행한다.
5. 운영 익명 REST는 회원/승인 email·관리자 uuid·donor 비공개 컬럼을 **limit=0**으로 요청하여 권한 오류 확인. 본문/행은 기록하지 않는다. 공개 donor id/name limit=0의 정상 응답으로 서비스 상태를 교차 확인한다. GraphQL이 활성화됐다면 검증된 필드의 first=0 검사. inactive placeholder/잘못된 필드/401/5xx를 차단 성공으로 세지 않는다. 이 검사는 A/B 행 격리 자체의 증명이 아니므로 catalog와 격리 RLS 근거를 함께 사용한다.
6. SQL/postcheck 후 flag=true, Build Command stage=protected로 같은 승인 코드의 새 Production 빌드. public flag는 환경만 바꿔도 기존 번들에 반영되지 않는다. 로그인/일반 Editor/공개 후원을 확인하고 선택 업무는 별도 승인한다.

## 개인정보 보호를 유지하는 복구

- **010 적용 중 실패:** 전체 transaction rollback. 부분 적용을 수작업 계속하지 않는다. false 호환 코드 유지. 기존 DB 위험이 남았음을 알리고 실패 원인·새 preflight·승인 전 재실행 금지.
- **010 commit 후 UI 문제:** SQL을 되돌리지 않는다. 단계6에서 기록한 검증된 **Hotfix false Production 배포 ID**를 별도 승인 후 Vercel Deployments에서 rollback 대상으로 선택한다. 구형 d95bc68은 가입/후원 Editor와 충돌하므로 전면 rollback 대상이 아니다.
- **commit 후 권한/GraphQL 이상:** DB 담당자 별도 승인 후 `SET oaz.approve_privacy_v3_recovery='yes';`와 봉인된 010-recovery.sql 전체를 같은 배치로 실행, postcheck 확인. 선택 쓰기/민감 RPC/GraphQL 실행을 잠그므로 일부 기능은 의도적으로 중단. 공개 SELECT 권한 복구 금지.
- **복구 후 재개:** 원인/catalog 재검토 후 013 읽기/015 GraphQL/011 후원/012 승인 쓰기를 각각 승인한다. capability 자동 재부여 금지. 보호를 약화하는 자동 rollback 금지.
- **전체 데이터 복원:** 본 배포의 자동 rollback 수단이 아니다. 실제 복원·Storage bytes·관리 확장/역할 검증 미완료. 승인된 격리 복원 연습과 별도 재해복구 절차 필요.

공식 [Vercel rollback 동작](https://vercel.com/docs/deployments/promoting-a-deployment): 기존 배포 rollback은 도메인 재지정이며 새 환경변수 재빌드와 다르다. 기록한 false 호환 배포의 빌드 설정을 확인한 뒤 사용한다.
