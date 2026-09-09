"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { BoardTabs } from "./components/BoardTabs"
import { PostList } from "./components/PostList"
import { EditorLayout } from "./EditorLayout"
import { BoardType } from "./constants"
import { useBoardPosts } from "./hooks/useBoardPosts"
import { supabase } from "@/lib/supabaseClient"

import { NoticeForm } from "./boards/0_notice/NoticeForm"
import { ProjectForm } from "./boards/1_project/ProjectForm"
import { StudyForm } from "./boards/2_study/StudyForm"
import { TimetableForm } from "./boards/3_timetable/TimetableForm"
import { HonorForm } from "./boards/4_honor/HonorForm"
import { ScheduleForm } from "./boards/5_schedule/ScheduleForm"
import { EventForm } from "./boards/6_event/EventForm"
import { Registered_mem_Form } from "./boards/8_registered_member/Registered_mem"
import { Allowed_user } from "./boards/7_allowed_user/Allowed_user"

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
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        denyAccess("로그인이 필요한 접근입니다.", "/signin")
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

    void verifyAccess()

    return () => {
      cancelled = true
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
      <BoardTabs board={board} onChange={setBoard} />
      
      <section className="bg-white rounded-lg shadow-md p-6 mb-8">
        {board === "공지" && <NoticeForm />}
        {board === "프로젝트" && <ProjectForm onSuccess={(newPost) => {postsState.setPosts((prev) => [newPost, ...prev])}}/>}
        {board === "스터디" && <StudyForm />}
        {board === "학회실 사용 시간표" && <TimetableForm />}
        {board === "명예의 전당" && <HonorForm />}
        {board === "일정" && <ScheduleForm />}
        {board === "행사" && <EventForm />}
        {board === "등록회원" && <Registered_mem_Form />}
        {board === "승인email" && <Allowed_user onSuccess={(newRow) => {postsState.setPosts((prev) => [newRow, ...prev])}}/>}
      </section>
      
      <PostList
        board={board}
        posts={postsState.posts}
        setPosts={postsState.setPosts}
        reload={postsState.reload}
        loading={postsState.loading}
      />
      
    </EditorLayout>
  )
}
