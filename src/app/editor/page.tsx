"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { BoardTabs } from "./components/BoardTabs"
import { PostList } from "./components/PostList"
import { EditorLayout } from "./EditorLayout"
import { BoardType, BOARD_TABLE_MAP } from "./constants";
import { privateEditorTable } from '@/lib/privacy/policy';
import { PrivacyBoard } from './components/PrivacyBoard';
import { useBoardPosts } from "./hooks/useBoardPosts"
import { supabase } from "@/lib/supabaseClient"

import { NoticeForm } from "./boards/0_notice/NoticeForm"
import { ProjectForm } from "./boards/1_project/ProjectForm"
import { StudyForm } from "./boards/2_study/StudyForm"
import { TimetableForm } from "./boards/3_timetable/TimetableForm"
import { ScheduleForm } from "./boards/5_schedule/ScheduleForm"
import { EventForm } from "./boards/6_event/EventForm"

export default function EditorPage() {
  const router = useRouter()
  const [accessState, setAccessState] = useState<"checking" | "authorized">("checking")
  const redirectStarted = useRef(false)

  useEffect(() => {
    let cancelled = false
    let generation = 0

    const denyAccess = (message: string, destination: string) => {
      if (cancelled || redirectStarted.current) return

      redirectStarted.current = true
      window.alert(message)
      router.replace(destination)
    }

    const verifyAccess = async (request: number) => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (cancelled || request !== generation) return
      if (userError || !user) {
        denyAccess("로그인이 필요한 접근입니다.", "/signin")
        return
      }

      const { data: supervisor, error: supervisorError } = await supabase
        .from("supervisor_id")
        .select("uuid")
        .eq("uuid", user.id)
        .maybeSingle()

      if (cancelled || request !== generation) return
      if (supervisorError || !supervisor) {
        denyAccess("권한이 없는 페이지입니다.", "/")
        return
      }

      if (!cancelled) {
        setAccessState("authorized")
      }
    }

    const verify = () => {
      const request = ++generation
      void verifyAccess(request).catch(() => { if (request === generation) denyAccess('권한 확인에 실패했습니다.', '/signin') })
    }
    verify()
    let timer: ReturnType<typeof setTimeout> | undefined
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      generation++
      redirectStarted.current = false
      setAccessState('checking')
      if (timer) clearTimeout(timer)
      timer = setTimeout(verify, 0)
    })

    return () => {
      cancelled = true
      generation++
      if (timer) clearTimeout(timer)
      listener.subscription.unsubscribe()
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
  const privateBoard = privateEditorTable(BOARD_TABLE_MAP[board])

  return (
    <EditorLayout>
      <BoardTabs board={board} onChange={setBoard} />
      
      {privateBoard ? <PrivacyBoard key={board} table={BOARD_TABLE_MAP[board]} /> : <section className="bg-white rounded-lg shadow-md p-6 mb-8">
        {board === "공지" && <NoticeForm />}
        {board === "프로젝트" && <ProjectForm onSuccess={(newPost) => {postsState.setPosts((prev) => [newPost, ...prev])}}/>}
        {board === "스터디" && <StudyForm />}
        {board === "학회실 사용 시간표" && <TimetableForm />}
        {board === "일정" && <ScheduleForm />}
        {board === "행사" && <EventForm />}
      </section>}
      
      {!privateBoard && board !== "공지" && (
        <PostList
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
