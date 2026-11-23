# OAZ Korea Web

학회 공식 홈페이지의 v2.31.4 웹 소스와 정리된 개발 도구입니다. Next.js, React, TypeScript를 사용합니다.

## 개발 환경

Node.js 24에서 다음 명령을 실행합니다.

~~~sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build:offline
~~~

개발 서버는 `npm run dev`로 시작합니다. 데이터 조회에는 개발용 Supabase 프로젝트의 공개 URL과 publishable 키를 `.env.local`에 지정합니다. 개발용 예시는 `.env.example`에 있습니다. 관리자 기능은 별도 인증 인프라와 전용 설정을 갖춘 환경에서 사용합니다.

## 소스와 테스트 범위

- `src/`와 `public/`은 웹 앱과 정적 에셋입니다. 공지, 기록 및 미디어의 운영 데이터와 서버 전용 번역 캐시는 운영 환경에서 공급합니다.
- `deploy/release-source/`에는 운영 조립본에서 확인한 Gateway와 PDF 서비스 소스가 있습니다. PDF 서비스의 Python 의존성은 pypdf 6.21.4입니다.
- `deploy/production/`에는 버전이 지정된 SQL 정의와 환경 검증기가 있습니다. 앱 설치 및 빌드는 SQL을 실행하지 않습니다.
- `tests/`는 공개 자료만으로 실행할 수 있는 관리자 세션, 방문 통계, 공지, 스터디 및 공개 화면 회귀 검사입니다. 전체 운영 인수 검사에는 학회의 격리 실험실과 접근 제한 자료가 필요합니다.
- 모집 화면의 선택적 장식 사진은 공개 소스에서 제외했습니다. 학회가 별도 제공하는 승인된 이미지는 `public/oaz_homecomming.jpg`에 둡니다.
- PDF 서비스를 별도 조립할 때는 PyPI의 `pypdf-6.21.4-py3-none-any.whl`을 해당 서비스의 `build/final-integration/tools/`에 배치합니다. 검증기에서 배포본 SHA-256을 검사합니다.
- 운영 배포는 승인된 별도 조립 절차를 사용합니다. 이 소스 브랜치를 학회 Vercel 프로젝트의 Production 브랜치에 병합하기 전에 배포 구성과 운영 영향을 확인하세요.
