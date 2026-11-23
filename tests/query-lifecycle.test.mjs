import { test } from 'node:test';
import { publicQueryCase, boardQueryCase, blogQueryCase } from './helpers/query-cases.mjs';

// STEP 129의 수동 Hook 슬롯/기존 결함 기대값을 STEP 131 승인 기준과 실제 React DOM으로 교체했다.
// 초기 로딩·성공·빈 목록·실패·Strict Mode·새 mount·검색·재조회 검증은 유지/강화한다.
for (const [kind, label] of [['project', '프로젝트'], ['timetable', '시간표']]) {
  for (const [outcome, name] of [['success', '성공'], ['empty', '빈 목록'], ['error', '실패']]) {
    test(`STEP 131 실제 React DOM: ${label} 초기 로딩·${name}·오래된 응답 무시`, () => publicQueryCase(kind, outcome));
  }
  test(`STEP 131 실제 React DOM: ${label} Strict Mode와 새 mount 로딩`, () => publicQueryCase(kind, 'success', true));
}
for (const [mode, label] of [['search', '입력·Enter 제출·페이지 이동·중복 요청 없음'], ['empty', '빈 결과'], ['error', '최신 실패 안내'], ['race', '오래된 실패 무시'], ['abort', '취소·Strict Mode·unmount']]) {
  test(`STEP 131 실제 React DOM: 블로그 ${label}`, () => blogQueryCase(mode));
}
for (const [mode, label] of [['race', '보드 전환과 A→B→A 및 오래된 응답 차단'], ['error', '재조회 실패의 로딩 해제'], ['reload', '재조회·목록 상태 갱신']]) {
  test(`STEP 131 실제 React DOM: Editor ${label}`, () => boardQueryCase(mode));
}
