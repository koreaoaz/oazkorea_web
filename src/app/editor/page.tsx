"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { BoardTabs } from "./components/BoardTabs"
import { EditorMutationContext } from "./components/common/EditorForm"
import { PostList } from "./components/PostList"
import { EditorLayout } from "./EditorLayout"
import { BoardType, BOARD_LIST, BOARD_TABLE_MAP } from "./constants"
import { CONTENT_TABLES } from "@/lib/admin/policy"
import { adminEditorEnabled } from "@/lib/admin/protocol"
import { useBoardPosts } from "./hooks/useBoardPosts"
import { supabase } from "@/lib/supabaseClient"

import { NoticeForm } from "./boards/0_notice/NoticeForm"
import { ProjectForm } from "./boards/1_project/ProjectForm"
import { StudyForm } from "./boards/2_study/StudyForm"
import { TimetableForm } from "./boards/3_timetable/TimetableForm"
import { HonorForm } from "./boards/4_honor/HonorForm"
import { ScheduleForm } from "./boards/5_schedule/ScheduleForm"
import { EventForm } from "./boards/6_event/EventForm"
import { privateReadOnly, privateEditorTable } from '@/lib/privacy/policy'
import { Allowed_user } from './boards/7_allowed_user/Allowed_user'

export default function EditorPage() {
  const router = useRouter()
  const [accessState, setAccessState] = useState<"checking" | "authorized">("checking")
  const redirectStarted = useRef(false)

  useEffect(() => {
    let cancelled = false

    const denyAccess = (message: string, destination: string) => {
      if (cancelled || redirectStarted.current) return

      redirectStarted.current = true
      window.alert(message)
      router.replace(destination)
    }

    const verifyAccess = async () => {
      if (cancelled) return
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        denyAccess("로그인이 필요한 접근입니다.", "/signin")
        return
      }
      if (adminEditorEnabled()) {
        try {
          const state=await (await import("@/lib/admin/client")).adminCommand({action:"session",version:0})
          if(!state||typeof state!=="object"||!("contentReady" in state)||state.contentReady!==true) {
            denyAccess("새 Editor 쓰기 전환이 아직 완료되지 않았습니다.","/admin")
            return
          }
          if (!cancelled) setAccessState("authorized")
        } catch { denyAccess("활성 관리자 권한을 확인하지 못했습니다.", "/admin/login") }
        return
      }

      const { data: supervisor, error: supervisorError } = await supabase
        .from("supervisor_id")
        .select("uuid")
        .eq("uuid", user.id)
        .maybeSingle()

      if (supervisorError || !supervisor) {
        denyAccess("권한이 없는 페이지입니다.", "/")
        return
      }

      if (!cancelled) {
        setAccessState("authorized")
      }
    }

    void verifyAccess().catch(() => denyAccess("접근 권한을 확인하지 못했습니다.", "/signin"))
    let authTimer: ReturnType<typeof setTimeout> | undefined
    const listener=adminEditorEnabled()?supabase.auth.onAuthStateChange(()=>{
      setAccessState("checking")
      if(authTimer!==undefined)clearTimeout(authTimer)
      authTimer=setTimeout(()=>void verifyAccess().catch(()=>denyAccess("접근 권한을 확인하지 못했습니다.","/admin/login")),0)
    }):null

    return () => {
      cancelled = true
      if(authTimer!==undefined)clearTimeout(authTimer)
      listener?.data.subscription.unsubscribe()
    }
  }, [router])

  if (accessState === "checking") {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">접근 권한을 확인 중입니다.</p>
      </main>
    )
  }

  return <AuthorizedEditor />
}

function AuthorizedEditor() {
  const [board, setBoard] = useState<BoardType>("공지")
  const postsState = useBoardPosts(board)

  return (
    <EditorLayout>
      <BoardTabs board={board} onChange={setBoard} allowed={adminEditorEnabled()
        ? BOARD_LIST.filter(b=>CONTENT_TABLES.some(t=>t===BOARD_TABLE_MAP[b]) || privateEditorTable(BOARD_TABLE_MAP[b])) : undefined} />

      <EditorMutationContext.Provider value={postsState.reload}>
      <section key={board} className="bg-white rounded-lg shadow-md p-6 mb-8">
        {board === "공지" && <NoticeForm />}
        {board === "프로젝트" && <ProjectForm onSuccess={(newPost) => {postsState.setPosts((prev) => [newPost, ...prev])}}/>}
        {board === "스터디" && <StudyForm />}
        {board === "학회실 사용 시간표" && <TimetableForm />}
        {board === "명예의 전당" && <HonorForm />}
        {board === "일정" && <ScheduleForm />}
        {board === "행사" && <EventForm />}
        {privateReadOnly(BOARD_TABLE_MAP[board]) && <p role="status" className="text-sm text-gray-600">
          개인정보 목록은 별도 업무 승인이 필요한 조회 전용 기능입니다. 회원·승인 이메일·관리자 정보 변경은 제한됩니다.
        </p>}
        {board === '승인email' && <Allowed_user />}
      </section>
      </EditorMutationContext.Provider>

      {board !== "공지" && (
        postsState.error ? <p role="alert" className="text-sm text-red-600">{postsState.error}</p> : <PostList
          key={board}
          board={board}
          posts={postsState.posts}
          setPosts={postsState.setPosts}
          reload={postsState.reload}
          loading={postsState.loading}
        />
      )}

    </EditorLayout>
  )
}
