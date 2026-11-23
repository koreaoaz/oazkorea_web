import type { ProjectJson, RawProjectRow } from "./project"
import type { RawTimetableRow } from "./timetable"

// STEP 126에서 제공된 information_schema 컬럼 조회 결과에 따른 REST 응답 타입.
// bigint는 JSON 숫자의 기존 런타임 표현을 유지한다. 정밀도·PK·UNIQUE·RLS는 보장하지 않는다.
export type NoticeRow = {
  id: number
  text: string | null
  created_at: string
  description: string | null
  is_noti: boolean
}

export type EditorRows = {
  editor_0_noti: NoticeRow
  editor_1_projects: RawProjectRow
  editor_2_studies: {
    id: number
    study_name: string | null
    created_at: string
    leader: string | null
    outline: string | null
    filename: string | null
    year: number
    semester: number
  }
  editor_3_study_timetable: RawTimetableRow
  editor_4_schedules: {
    id: number
    description: string | null
    created_at: string
    start_date: string | null
    end_date: string | null
  }
  editor_5_donators: {
    id: number
    name: string | null
    uuid: string | null
    created_at: string
    date: string | null
  }
  editor_6_events: {
    id: number
    created_at: string
    title: string | null
    description: string | null
    filenames: ProjectJson
  }
  allowed_user: {
    id: number
    email: string
    name: string | null
  }
  registered_member: {
    id: number
    created_at: string
    name: string | null
    department: string | null
    student_id: string | null
    generation: string | null
    uuid: string
    email: string
    phone_number: string | null
    is_manager: boolean
  }
  supervisor_id: {
    id: number
    name: string
    email: string
    created_at: string
    uuid: string
  }
}

export type EditorTable = keyof EditorRows
export type EditorRow<T extends EditorTable = EditorTable> = EditorRows[T]

// 목록/Excel의 텍스트 열을 읽기 위한 화면 소비 계약. DB Row를 이 타입으로 대체하지 않는다.
export type EditorTextKey<R> = R extends R ? {
  [K in keyof R]-?: R[K] extends string | null ? K : never
}[keyof R] : never
export type EditorTextFields = {
  [K in EditorTextKey<EditorRow>]?: string | null
}

type RequiredInsertKey<T extends EditorTable> = T extends "registered_member"
  ? "email"
  : T extends "supervisor_id" ? "name" | "email" : never

// NULL 허용/기본값/identity 컬럼은 생략 가능하다. identity 생성 모드와 제약은 별도 확인 대상이다.
// 이 타입은 DB 저장 성공이나 관리자 권한을 보장하지 않는다.
export type EditorInsert<T extends EditorTable> = Partial<EditorRow<T>> &
  Pick<EditorRow<T>, Extract<RequiredInsertKey<T>, keyof EditorRow<T>>>
export type EditorUpdate<T extends EditorTable> = Partial<EditorRow<T>>

// 컬럼을 직접 조회할 때 사용하는 Supabase 관계 타입. FK 목록은 미확인이므로 비어 있다고 단정하지 않는다.
export type EditorRelation<T extends EditorTable> = {
  Row: EditorRow<T>
  Insert: EditorInsert<T>
  Update: EditorUpdate<T>
  Relationships: {
    foreignKeyName: string
    columns: string[]
    referencedRelation: string
    referencedColumns: string[]
    isOneToOne?: boolean
  }[]
}
