# 기존 Demo 재사용 검토 — 2026-11-03

판정: **DO_NOT_REUSE (이번 Hotfix의 SQL/Auth/Editor 종단 테스트 대상)**. Main과 다른 프로젝트라는 사실은 확인되지만 기존 Demo 서비스·데이터가 보존 대상이다. 단순한 독립성으로 테스트 전용/무개인정보 환경임을 증명할 수 없다. 실제 DB/Storage/Auth에는 연결하지 않았다.

## 확인된 사실

- 사용자 Dashboard 확인: Main koreaoaz_main/oaz_web_main, Demo OaZ-web-demo/Oaz-web-demo-2026-1(ap-southeast-2)은 별개 프로젝트다.
- 로컬 Demo src/lib/demoConfig.ts:1-2, .env.example, DEMO_ENV_CHECKLIST.md에 Demo ref=ctbwaqtqubmjmltbxfzm. Main ref=maoefmwpdcnugyenyiea와 다르다. Demo client는 이 URL을 정확히 검사한다.
- Demo netlify.toml: build=npm run build, publish=.next, Node 22. .netlify/state.json에 기존 site link가 있고 생성 Netlify config에 Next plugin이 있다. 원본/생성 설정에 실제 공개키는 표시하지 않았다. 이 자료는 현재 원격 배포 SHA·설정·가동 상태를 입증하지 않는다.
- DEMO_FINAL_RELEASE_RUNBOOK.md는 기존 oneandzero-demo 사이트, 별도 private 저장소와 PR, Netlify Stopped builds 보존, Node 22 전용 릴리스 절차를 기록한다. 현재 원격 Stopped builds 상태는 재확인하지 않았다. 이 Hotfix의 Node 24 검증을 Demo 배포에 그대로 사용하지 않는다.
- DEMO_AUTH_SETUP.md는 사용자가 public 테이블 14/RLS 활성, public 정책 37, Storage 정책 7, 보안 함수 2, public bucket 3개를 확인했다고 기록한다. 수와 존재는 정책 정확성/현재 상태/개인정보 부재를 증명하지 않는다.
- 공개 이미지 bucket: project_img, study-images, card_news. 공지·프로젝트·스터디·시간표·일정·후원·행사와 registered_member/allowed_user/supervisor_id를 앱이 사용한다. 실제 행/이미지는 읽지 않았다.
- Demo GitHub OAuth App과 Demo Supabase Auth, 현재 origin 기반 /login_callback 및 /oauth_callback을 사용한다. 실제 Provider enable/secret/allowlist/사용자 수는 미확인이다.

## 재사용하면 생길 영향

새 OAuth 계정도 기존 Demo Auth 사용자 공간에 남는다. 승인 이메일·관리자·후원 테스트는 기존 업무 테이블을 변경한다. 010 보호 SQL은 테이블/컬럼 GRANT, 함수/RLS 계약을 바꾸므로 기존 Demo Editor/승인/보안 함수와 충돌할 수 있다. Demo reference 정책은 oaz_demo_private 기반이며 Hotfix v3 RPC와 동일하지 않다. Provider callback/Site URL을 다른 프로젝트로 바꾸면 기존 Netlify 로그인이 깨질 수 있다. 기존 공개 bucket 이미지나 파일을 테스트 정리 대상으로 취급하면 안 된다.

현재 Demo에 실제 개인정보가 있는지, 보존해야 할 가짜 데이터/계정이 무엇인지, 백업·복구가 가능한지 확인되지 않았다. 테이블 수를 근거로 빈 DB라고 추정하지 않았다. 기존 SQL/테스트 문서는 현재 원격 계약을 대신하지 못한다.

따라서 Demo의 초기화/정책 적용/계정 생성/Storage 변경은 보류한다. Hotfix checker에도 이 보존 대상 Demo ref를 차단했다. 향후 재사용은 소유자 승인·메타데이터·데이터 보존 범위·백업·기존 Netlify 회귀 계획을 별도로 확인한 후 다시 결정한다. 현재는 새 Hotfix 전용 테스트 Supabase를 제안하며 자동 생성하지 않는다.

Main/Demo 코드·docs·Netlify local link 및 운영 백업은 보존했다. 운영 백업·회원·이미지를 Demo나 새 테스트 프로젝트로 복원/복사하지 않는다.
