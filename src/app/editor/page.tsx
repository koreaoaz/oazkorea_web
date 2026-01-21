"use client"

import { useState } from "react"
import { BoardTabs } from "./components/BoardTabs"
import { PostList } from "./components/PostList"
import { EditorLayout } from "./EditorLayout"
import { BoardType } from "./constants"
import { useBoardPosts } from "./hooks/useBoardPosts"

import { NoticeForm } from "./boards/notice/NoticeForm"
import { ProjectForm } from "./boards/project/ProjectForm"
import { StudyForm } from "./boards/study/StudyForm"
import { TimetableForm } from "./boards/timetable/TimetableForm"
import { HonorForm } from "./boards/honor/HonorForm"
import { ScheduleForm } from "./boards/schedule/ScheduleForm"
import { EventForm } from "./boards/event/EventForm"

export default function EditorPage() {
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