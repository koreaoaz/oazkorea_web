export const BOARDS=[
 {slug:'notices',table:'editor_0_noti',name:'공지',title:'text',body:'description',description:'공개 공지 게시물을 작성하고 관리합니다.'},
 {slug:'promotions',table:'editor_0_noti',name:'홍보',title:'text',body:'description',description:'홍보 게시판과 자동 생성 초안의 검토·승인을 관리합니다.'},
 {slug:'studies',table:'editor_2_studies',name:'스터디',title:'study_name',body:'outline',description:'스터디 소개·학기와 이미지를 관리합니다.'},
 {slug:'projects',table:'editor_1_projects',name:'프로젝트',title:'project_name',body:'description',description:'프로젝트 기록과 대표 이미지를 관리합니다.'},
 {slug:'timetable',table:'editor_3_study_timetable',name:'시간표',title:'study_name',body:'leader',description:'학회실 사용 요일과 시간을 관리합니다.'},
 {slug:'schedules',table:'editor_4_schedules',name:'일정',title:'description',body:'start_date',description:'중요한 날짜와 기간을 관리합니다.'},
 {slug:'events',table:'editor_6_events',name:'행사·학회 소식',title:'title',body:'description',description:'News와 세미나·전시·해커톤을 원래 ID로 편집합니다. 기존 행사 편집 권한이 적용됩니다.'},
] as const
export const CATEGORY_LABELS={unclassified:'미분류',bugfix:'오류 수정',improvement:'기능 개선',content:'콘텐츠 업데이트',other:'기타'} as const
export type ChangeCategory=keyof typeof CATEGORY_LABELS
export const boardFor=(slug:string)=>BOARDS.find(b=>b.slug===slug)
export const tableLabel=(table:string)=>(table==='promotion_drafts'?'홍보 초안':table==='editor_0_noti'?'공지·홍보':BOARDS.find(b=>b.table===table)?.name)??(table==='editor_5_donators'?'명예의 전당':'관리 항목')
export const actionLabel=(action:string)=>({'promotion.approve':'홍보 초안 승인','promotion.batch.approve':'홍보 일괄 승인','promotion.permissions.update':'홍보 권한 변경','content.create':'신규 작성','content.update':'수정','content.pin':'상단 고정','content.unpin':'상단 고정 해제','content.delete':'삭제','order.save':'순서 저장','honor.create':'원본 추가','honor.save':'표시 이름 수정','honor.approve':'공개 승인','honor.revoke':'공개 회수','honor.order':'공개 순서 저장','accounts.upsert':'계정 정보·권한 변경','accounts.prepare':'계정 생성 준비','accounts.complete':'계정 생성 완료','admin.bootstrap':'최고관리자 초기 등록'} as Record<string,string>)[action]??'관리 작업'
