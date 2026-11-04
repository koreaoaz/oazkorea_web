# 일반 콘텐츠 서버 쓰기 보호 추가안

2026-11-04 최종 확정: 사용자가 실제 브라우저의 권한 회수 후 기존 세션 거절·공개 조회 유지까지 확인했다. 지정 테스트 공지 id=34만 정리했고 회원/identity/로그인 기록은 보존했다. 기능 코드/SQL은 abd5e20 검증 그대로다. 현재 서버는 유지하며 사용자가 기존 CMD에서 Enter 정상 종료한다. 원격 CI와 운영 적용은 하지 않았다.

기존 보호 SQL 13개와 RC_SQL_HASHES.json은 변경하지 않는다. 이 폴더의 SQL은 별도 HASHES.json으로 검증하는 **로컬 검증 후보**다. 운영 NO-GO이며 Production/Demo에 적용하지 않았다.

## 원인과 수정

로컬 합성 fixture의 일반 콘텐츠 6개 테이블에는 synthetic_legacy_write가 authenticated의 모든 행에 USING(true)/WITH CHECK(true)를 부여했다. permissive 정책은 OR로 합쳐지므로 다른 허용 정책 추가나 UI의 supervisor 확인만으로 막을 수 없다. 실제 일반 Auth 회원의 JWT를 REST/GraphQL에 전달한 재현에서도 UPDATE가 허용됐다. service_role은 준비·정리에만 사용하고 권한 검사에는 사용하지 않는다.

011-content-write-guard.sql은 7개 관리 테이블에 INSERT/UPDATE/DELETE **restrictive 정책 21개**를 추가한다. 조건은 기존 oaz_privacy_v3.content_editor()이며 DB의 active_user와 supervisor/기존 관리자 상태를 재검사한다. 클라이언트 metadata나 요청에 포함된 관리자 UUID를 신뢰하지 않는다. JWT가 유효해도 DB 편집 권한이 회수되면 다음 요청에 반영된다. 읽기 정책과 읽기 ACL은 보존한다. 익명 쓰기·열 단위 쓰기 ACL과 RLS를 우회하는 TRUNCATE 등 권한은 회수한다. 민감정보 capability나 donor/approval 업무 스위치를 확대하지 않는다.

012-content-write-postcheck.sql은 정책의 명령·역할·restrictive 속성·조건식, RLS, 위험 ACL을 검사한다. 기존 010-postcheck도 함께 통과해야 한다. 이 파일은 기존 012-enable-approval-writes.sql과 별개이므로 경로를 혼동하지 않는다.

대상은 공지·프로젝트·스터디·시간표·일정·명예의 전당·행사다. 명예의 전당은 기존 donor_writes=false로 HTTP 쓰기가 계속 거절된다. 정상 CRUD는 별도 SQL 트랜잭션에서만 스위치를 켠 후 Auth 발급 claims와 authenticated 역할로 검증하고 전체 롤백한다. 실제 스위치는 변경하지 않는다.

근거: [PostgreSQL 17 RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), [CREATE POLICY](https://www.postgresql.org/docs/17/sql-createpolicy.html), [Supabase GraphQL 보안](https://supabase.com/docs/guides/graphql/security).

## 로컬 재검증

도구는 Hotfix 브랜치·고정 loopback API·Docker 프로젝트·fixture provenance·연결 표식 부재·기존 SQL 무결성을 검증한다. 운영 접속 문자열이나 Secret 인수를 받지 않는다.

```powershell
node scripts/local-content-guard.mjs apply
node scripts/local-content-guard.mjs check
node scripts/test-local-content-security.mjs verify
```

서버 재시작·데이터 초기화는 없다. OAuth 실행기의 새 시작/재개에도 보호 SQL을 적용한다. 현재 기존 콘솔의 이전 모듈은 재실행을 강요하지 않고 별도 CLI로 DB를 보호한다.

가짜 회원 2명에게 Auth가 발급한 실제 authenticated JWT를 사용한다. 서명·주체·만료·session_id와 getUser를 확인하고, 같은 토큰 문자열을 편집 권한 부여 전부터 회수 후까지 유지한다. 브라우저의 실제 GitHub JWT를 읽거나 복사하지 않는다. 기존 GitHub 회원·세션·공지는 별도로 보존 확인한다.

REST의 200/빈 배열, GraphQL의 affectedCount=0은 DB 불변과 함께 검증한다. 익명은 ACL로 Mutation 타입 자체가 사라질 수 있어 역할별 introspection 및 편집자에서 실제 동작하는 동일 mutation과 대조한다. 스키마 오타·잘못된 입력·500·통신 오류는 RLS 거절로 인정하지 않는다. GraphQL 입력은 camelCase와 응답의 자동 생성 ID를 사용한다.

검사 자료는 난수 표식으로 만든 행·회원만 정리한다. Auth 감사 로그의 가짜 검사 기록 및 시퀀스 번호 공백은 남을 수 있다. 토큰·Secret·이메일은 출력·저장하지 않는다. diagnose 모드는 보호 전 재현용이며, 재현을 위해 정책을 해제하지 않는다.

## 운영 적용 전 별도 작업

1. 운영의 스키마·공개 범위·GRANT·역할 상속·트리거·뷰·RPC/SECURITY DEFINER 의존성을 읽기 전용으로 조사한다. 로컬 정책을 운영 정책이라고 가정하지 않는다.
2. 기존 010 보호/새 백업/복구 담당자/preflight·postcheck와 별도로 콘텐츠 migration 계획·대상 seal·해시·업무 영향·잠금을 검토한다. 이 SQL의 local fixture 선언을 운영에서 흉내 내어 실행하지 않는다. 별도 운영 대상 검증과 승인을 갖춘 변경안이 필요하다.
3. 순서는 기존 010·postcheck → 별도로 승인된 콘텐츠 보호·postcheck → API 거절·정상 편집 검증이다. 기존 011 donor/012 approval 활성화는 별도 선택 업무 승인을 유지한다.
4. 같은 SHA의 원격 CI·격리 환경 통합과 브라우저의 기존 세션 회수 후 거절·공개 공지 보존을 확인한다. 로컬 통과는 운영 승인이 아니다.
5. 복구를 이유로 제한 정책을 삭제하지 않는다. 오류 시 쓰기 차단을 유지하며 원인을 수정한다. 운영 변경·배포에는 사용자 별도 승인이 필요하다.

### 기존 릴리스 순서에 넣는 정확한 위치

**최신 대상/백업/추가안 승인 → Flag OFF 호환 코드 → 기존 010 단일 트랜잭션·기존 postcheck → 운영 전용으로 승인된 콘텐츠 추가 트랜잭션·두 postcheck/API 검사 → Flag ON 새 빌드 → 최종 기능/보안 확인** 순서다. 기존 010과 이 후보는 각각 자체 BEGIN/COMMIT이 있으므로 중첩하거나 원문/해시를 수정하지 않는다. 두 DB 적용 사이에는 승인된 서버 측 콘텐츠 쓰기 동결을 유지한다. UI 숨김만으로 공백을 통제했다고 보지 않는다.

운영의 현재 permissive/restrictive 정책과 관리자 역할이 로컬과 다르면 정상 관리자의 CRUD도 차단될 수 있다. 운영 대상 조사와 격리 검증으로 호환성을 증명하기 전에는 배포를 시작하지 않는다. SQL 실패 시 ON 진행을 보류하고 쓰기 동결·제한 정책을 유지한다. 010-recovery는 추가 콘텐츠 정책을 삭제하지 않지만 일반 콘텐츠 REST 쓰기 전체 동결을 대신하지도 않는다. 최신 백업·격리 복원·Storage bytes/정책·운영 접근 통제·동일 최종 SHA 원격 CI가 미확인인 현재는 NO-GO다.
