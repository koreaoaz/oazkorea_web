

export type BoardType = "공지" | "프로젝트" | "스터디" | "학회실 사용 시간표" | "명예의 전당" | "일정" | "행사" | "등록회원" | "승인email" | "관리자id"

export const BOARD_TABLE_MAP: Record<BoardType, string> = {
  "공지": "editor_0_noti",
  "프로젝트": "editor_1_projects",
  "스터디": "editor_2_studies",
  "학회실 사용 시간표": "editor_3_study_timetable",
  "명예의 전당": "editor_5_donators",
  "일정": "editor_4_schedules",
  "행사": "editor_6_events",
  "등록회원": "registered_member",
  "승인email" : "allowed_user",
  "관리자id" : "supervisor_id"
}

export const BOARD_LIST: BoardType[] = [
  "공지",
  "프로젝트",
  "스터디",
  "학회실 사용 시간표",
  "명예의 전당",
  "일정",
  "행사",
  "등록회원",
  "승인email",
  "관리자id"
]

export const CATEGORY_OPTIONS = [
  "AI/ML",
  "해커톤",
  "HW",
  "Web/App",
  "BigData",
] as const

export type CategoryKey = (typeof CATEGORY_OPTIONS)[number]