/** 이전 네 페이지의 비식별 초안을 보존한다. 공개 메뉴와 옛 URL 처리는 별도로 관리한다. */
export const ALUMNI_LEGACY_PAGES=[
 {slug:'welcome',tab:'Welcome Message',title:'Alumni 환영 인사',intro:'하나와영에서 이어진 배움과 인연이 졸업 이후에도 새로운 대화로 이어지기를 바랍니다.',sections:[
  {title:'학회와 동문을 잇는 공간',body:'이 공간은 재학생과 졸업생이 학습 경험을 나누고 서로의 활동을 이해하기 위한 출발점입니다. 특정 대표자의 실제 인사말을 인용한 글이 아닌 초기 소개 초안입니다.'},
  {title:'함께 나눌 수 있는 경험',body:'처음 도전한 프로젝트의 시행착오, 공부 습관, 팀 협업에서 배운 점처럼 후배가 참고할 수 있는 경험을 모아 갈 수 있습니다. 참여자의 직장이나 경력을 확인 없이 소개하지 않습니다.'},
  {title:'기록을 보내기 전에',body:'공개할 글의 주제와 공개 범위를 먼저 정리하고, 작성자가 동의한 자료를 학회 운영진에게 전달해 주세요. 실제 인사말이 준비되면 이 초안을 교체할 수 있습니다.'},
 ]},
 {slug:'news',tab:'Alumni News',title:'동문 소식',intro:'확인된 소식을 모아 갈 수 있는 편집 초안입니다. 아래 주제 안내는 실제 동문 실적이나 소식이 아닙니다.',sections:[
  {title:'공유할 소식의 주제',body:'연구·개발 프로젝트의 과정, 공개한 창작물, 학습 자료와 커뮤니티 활동 등을 소개할 수 있습니다. 수상·취업·출판을 실제로 확인하기 전에는 개인별 성과 목록을 만들지 않습니다.'},
  {title:'소식 작성 틀',body:'제목 → 공유 배경 → 배운 점 → 확인 가능한 공개 자료 순서로 정리해 주세요. 이름·소속·일시·사진은 작성자가 공개에 동의한 항목만 추가합니다.'},
  {title:'현재 기록 상태',body:'현재 공개가 확인된 개인별 소식은 없습니다. 공개 범위와 내용을 확인한 자료부터 이 공간에 차근차근 모아 갈 예정입니다.'},
 ]},
 {slug:'events',tab:'Condolences',title:'경조사 안내',intro:'동문과 학회 구성원의 기쁨과 어려움을 함께 나누기 위한 안내 초안입니다. 실제 경조사 공지가 아닙니다.',sections:[
  {title:'알림을 등록할 때',body:'당사자가 공개를 원하는지와 알림 범위를 먼저 확인합니다. 축하나 위로를 전하는 데 필요한 최소한의 내용만 정리하며, 비공개 사정을 대신 추정해 쓰지 않습니다.'},
  {title:'공지에 담을 항목',body:'알림 제목, 공개 가능한 안내 문구, 게시·종료 기준을 정리할 수 있습니다. 연락처·장소·관계 등 개인 정보는 확인된 실제 자료와 공개 의사가 있을 때만 추가합니다.'},
  {title:'정정과 종료',body:'내용 수정이나 비공개 전환 요청을 처리할 운영 절차가 마련된 뒤 실제 공지를 연결할 예정입니다. 현재는 실제 당사자 이름이나 가상의 사건을 게시하지 않습니다.'},
 ]},
 {slug:'former-execs',tab:'Former Executives',title:'역대 회장단',intro:'학회를 이끌어 온 활동을 기록하기 위한 자료 구조 초안입니다. 확인되지 않은 명단을 임의로 채우지 않았습니다.',sections:[
  {title:'기록할 정보',body:'확인된 활동 기간, 담당 역할, 공개 동의가 있는 표시 이름, 주요 운영 기록을 함께 정리할 수 있습니다. 실제 이름이나 재임 연도는 근거 자료가 있을 때만 입력합니다.'},
  {title:'자료 정리 순서',body:'기존 회의록·인수인계 문서 등 확인 가능한 출처를 검토하고, 당사자의 표시 범위를 확인한 뒤 기간순으로 정리합니다. 직장·연락처는 이 명단의 기본 항목으로 두지 않습니다.'},
  {title:'현재 명단',body:'확인된 역대 회장단 명단은 아직 등록되지 않았습니다. 자료와 공개 범위를 확인한 뒤 기간별 활동 기록을 채워 가겠습니다.'},
 ]},
] as const

/** 공개가 확인된 실제 기록만 추가한다. 기존 네 초안은 위 배열에 보존한다. */
export type HomecomingRecord={year:number;title:string;date:string|null;venue:string|null;attendance:string|null;photos:{label:string;url:string}[];presentations:{label:string;url:string}[]}
export const HOMECOMING_RECORDS:HomecomingRecord[]=[]
export type ExecutiveTerm={generation:string|null;years:string;members:{role:'회장'|'부회장'|'운영진';displayName:string}[];sourceNote:string}
export const EXECUTIVE_TERMS:ExecutiveTerm[]=[]
export const ALUMNI_INTRO='하나와영 홈커밍 세미나는 졸업한 OB 선배님들과 재학생 학회원들이 한자리에 모여 학회 활동을 공유하고 서로 교류하는 행사입니다.'
/** 2026년 공식 안내와 기존 공개 공지 50번에 근거한다. 개최 결과를 뜻하지 않는다. */
export const HOMECOMING_2026 = {
 title:'2026 하나와영 홈커밍 세미나',date:'2026-09-11',time:'18:00',venue:'공학관 467호',
 audience:'하나와영 학회원 전원 및 졸업생',sourceNoticeId:50,
 program:['1부. 학회 및 스터디·세션 소개','2부. OB 선배님 진로 발표','3부. 퀴즈 및 기념품 배부'],
 after:'저녁식사 및 네트워킹',
} as const
export const ALUMNI_PAGES=[
 {slug:'homecoming',tab:'Homecoming',title:'홈커밍 세미나',intro:ALUMNI_INTRO,sections:[
  {title:'홈커밍 소개',body:'졸업생의 경험과 재학생의 배움을 연결하는 연례 세미나 안내 공간입니다. 아직 확인된 행사 일정이나 참석자 명단을 등록하지 않았습니다.'},
  {title:'올해 행사 안내',body:'일정 · 미등록\n장소 · 미등록\n참석 안내 · 미등록\n운영진이 확정한 공개 자료를 확인한 뒤 안내합니다.'},
  {title:'지난 홈커밍 기록',body:'등록된 행사 기록이 없습니다. 확인된 연도별 행사와 공개 가능한 사진·발표 자료를 추가할 수 있습니다.'},
 ]},
 ALUMNI_LEGACY_PAGES[3],
] as const
