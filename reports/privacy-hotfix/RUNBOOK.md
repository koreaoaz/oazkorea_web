# 향후 승인된 배포 순서 — 이번에는 실행하지 않음

| 단계 | 성공 조건 | 실패/중단 및 복구 |
| --- | --- | --- |
| 1. Hotfix 로컬 검증 | 변경 범위·SQL SHA·단위/DB/타입/build 검사 검토, 전체 lint 오류 0, 검증 로그 확인 | 변경 코드의 오류나 알려지지 않은 SQL 변경이면 중단 |
| 2. GitHub CI / Vercel Preview | 별도 push/배포 승인 후 clean npm ci, CI, Preview 통과. 격리 테스트 DB만 연결 | 현재는 미실행. Preview가 운영 DB를 가리키면 push/배포/로그인 중단 |
| 3. 실제 OAuth | 별도 가짜 계정으로 로그인·가입·등록 실패·로그아웃·Editor 권한 확인 | 독립 Supabase/provider 및 정확한 두 callback 허용 필요. 실제 운영 회원 사용 금지 |
| 4. 백업·복구·승인 | 기존 백업 무결성·제한적 복구 담당자·점검 창·SQL/코드 버전·운영 승인 확정 | 완전 복원/Storage 실제 파일 백업 미완료는 기록. 복구 준비 불충분이면 중단 |
| 5. Production 호환 코드 | 테스트 OAuth origin 비움. privacy flag=false로 Hotfix 배포, 가입/본인 로그인/공개 후원 정상 | 민감 목록/쓰기는 제한됨. 이 단계만으로 기존 DB 위험은 해소되지 않음 |
| 6. 개인정보 SQL | 현행 seal/설정·010-preflight 검사 후 010-privacy-minimal 단일 트랜잭션 통과 | 지문/버전/정책 충돌 또는 잠금 오류면 전체 rollback. 강제 통과/분할 실행 금지 |
| 7. 메타데이터 사후 검사 | 010-postcheck 통과. 테이블/컬럼/유효 권한·함수 계약 일치 | 010-recovery로 선택 기능을 잠그고 보호 유지. 공개 SELECT 복구 금지 |
| 8. API 접근 차단 | 승인된 0행 REST/GraphQL 검사, 격리 A/B 결과와 실제 함수/정책 계약 대조 | 타 회원 실데이터로 시험하지 않음. 0행 검사만으로 모든 RLS를 증명했다고 표시하지 않음 |
| 9. 로그인·Editor | flag=false에서 본인 로그인·승인된 가입·기존 콘텐츠 Editor·공개 후원 이름 확인. 민감 업무는 계속 제한 | flag=true만으로 개인정보 권한/후원 쓰기가 열리지 않음. 승인되지 않은 기능은 제한 |
| 10. feature flag 활성화 | 앞선 조건 통과 후 true로 새 빌드/배포. 최소 RPC 허용/거부 확인. 필요한 업무 capability와 011/012는 별도 승인 | flag만 켜서는 권한이 생기지 않음. RPC/권한 불일치 시 민감 기능 OFF, 공개 SELECT fallback 금지 |

코드를 먼저 배포하면 개인정보 업무 제한 기간이 생기지만 기존 콘텐츠는 유지하도록 구성했다.
SQL을 먼저 적용하면 구형 가입 화면의 공개 이메일 검사와 구형 후원 Editor의 wildcard SELECT/날짜 편집이 실패할 수 있다.
따라서 5 → 6 순서를 지키며, SQL을 적용한 뒤 구형 앱으로 전면 롤백하지 않는다.
기존 Editor 입장 자체는 본인 supervisor UUID 조회라 보호 SQL과 호환된다.
새 SQL은 기존 관리자의 콘텐츠 권한을 임의로 부여하지 않으며 기존 RLS와 활성 Auth 조건을 따른다.

실행 명령(현재 Hotfix 폴더, 운영 접속 없음):

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build:offline
npm.cmd run build:offline -- --privacy-v3
python -B scripts/test-isolated-db.py --archive ../OAZ-Main-Lab/downloads/postgresql-17.6-1-windows-x64-binaries.zip --work ../OAZ-Main-Lab --privacy-v3 --graphql --auto-grants on --postgrest ../OAZ-Main-Lab/downloads/postgrest-v16.5-windows-x86-64.zip
git diff --check
```

어떤 명령도 운영 SQL을 적용하거나 push/배포하지 않는다. 전체 lint 오류는 0건으로 해결했다. 실제 원격 CI 및 Preview/OAuth는 별도 승인 후 검증해야 한다.

## 보호를 유지하는 장애 복구

- Hotfix 코드가 먼저 배포되는 동안 개인정보 목록과 후원자/승인 이메일 편집은 의도적으로 중단한다. 일반 콘텐츠·본인 로그인/가입·공개 후원 이름을 유지하는 전환이다.
- SQL 적용 후 가입/Editor가 실패하면 전체 개인정보 SELECT 권한이나 과거 앱으로 되돌리지 않는다. flag OFF, 호환 Hotfix 유지, 고정 오류 코드 확인, 필요 시 검토된 010-recovery로 선택 기능을 잠근다.
- 010-recovery는 업무 capability·선택 쓰기와 GraphQL 실행도 제한할 수 있다. 복구 담당자가 영향 범위를 확인한 후 별도 승인으로만 실행한다.
- 정상 재개 시 SQL/카탈로그/preflight를 재검증하고, GraphQL은 015, 읽기는 013, 선택 쓰기는 011/012 계약을 따로 승인한다. 자동 롤백/자동 권한 재개는 없다.
- 기존 PASS 결과는 보존한다. 적용 당일 SQL 13개 원문·현재 seal·preflight 및 code SHA를 다시 묶어 검토한다. 과거 PASS를 새 변경 승인으로 사용하지 않는다.
- Preview 상세 설정과 사용자가 할 최소 Dashboard 작업은 PREVIEW_AUTH.md를 따른다. 현재는 운영 SQL/설정 변경, push, 배포를 수행하지 않았다.
