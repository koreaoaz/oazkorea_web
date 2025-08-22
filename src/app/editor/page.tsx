"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

type BoardType = "공지" | "프로젝트" | "스터디" | "학회실 사용 시간표"

export default function AdminBoardPage() {
  const [session, setSession] = useState<any>(null)
  const [board, setBoard] = useState<BoardType>("공지")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [image, setImage] = useState<File | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const [duration, setDuration] = useState("")
  const [category, setCategory] = useState("")
  const [semester, setSemester] = useState("")
  const [teamSize, setTeamSize] = useState<number | null>(null)
  const [members, setMembers] = useState("")
  const [techStack, setTechStack] = useState("")
  const [detailedDescription, setDetailedDescription] = useState("")

  const [studyName, setStudyName] = useState("")
  const [studyLeader, setStudyLeader] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [dayOfWeek, setDayOfWeek] = useState("")
  const [studyColor, setStudyColor] = useState("#00ff00")

  const proj_baseUrl = process.env.NEXT_PUBLIC_PROJECT_STORAGE_URL

  // 시간 옵션 생성 (9:00~22:00, 30분 단위)
  const generateTimeOptions = () => {
    const options = []
    for (let hour = 9; hour <= 22; hour++) {
      options.push(`${hour.toString().padStart(2, "0")}:00`)
      if (hour < 22) {
        options.push(`${hour.toString().padStart(2, "0")}:30`)
      }
    }
    return options
  }

  const timeOptions = generateTimeOptions()
  const dayOptions = ["Mon", "Tue", "Wed", "Thu", "Fri"]

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      fetchPosts(board)
    }

    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.unsubscribe()
  }, [board]) // Added board dependency to refetch when board changes

  const getTableName = (board: BoardType) => {
    if (board === "공지") return "editor_0_noti"
    if (board === "프로젝트") return "editor_1_projects"
    if (board === "스터디") return "editor_2_studies"
    if (board === "학회실 사용 시간표") return "editor_3_study_timetable"
    return ""
  }

  const fetchPosts = async (board: BoardType) => {
    const table = getTableName(board)
    if (!table) return

    console.log("[v0] Fetching posts from table:", table)

    let query
    if (table === "editor_3_study_timetable") {
      query = supabase.from(table).select("*")
    } else {
      query = supabase.from(table).select("*").order("created_at", { ascending: false })
    }

    const { data, error } = await query

    if (error) {
      console.log("[v0] Fetch error:", error)
      setMessage("데이터 불러오기 실패: " + error.message)
      return
    }

    if (data) {
      console.log("[v0] Fetched data:", data)
      // tech_stack 변환
      const parsedPosts = data.map((post) => ({
        ...post,
        tech_stack: post.tech_stack?.stack ?? [],
      }))
      setPosts(parsedPosts)
    }
  }

  // 새글 등록
  const handleCreatePost = async () => {
    const table = getTableName(board)
    if (!table) return

    setIsUploading(true)
    let imageUrl = null

    try {
      console.log("[v0] Testing Supabase connection...")
      const { data: testData, error: testError } = await supabase
        .from(table)
        .select("count", { count: "exact", head: true })

      if (testError) {
        console.log("[v0] Supabase connection failed:", testError)
        setMessage("데이터베이스 연결 실패: " + testError.message)
        setIsUploading(false)
        return
      }

      console.log("[v0] Supabase connection successful")

      // --- 프로젝트일 때만 이미지 업로드 ---
      if (board === "프로젝트" && image) {
        const fileName = `${Date.now()}_${image.name}`
        const { error: uploadError } = await supabase.storage
          .from("project_img")
          .upload(fileName, image, { contentType: image.type })

        if (uploadError) {
          console.log(uploadError)
          setMessage("이미지 업로드 실패")
          return
        }
        imageUrl = fileName
      }

      if (board === "학회실 사용 시간표") {
        if (!validateTimetableForm()) {
          setIsUploading(false)
          return
        }
      }

      let payload: any = {}
      if (board === "공지") {
        payload = { text: body }
      } else if (board === "프로젝트") {
        payload = {
          text: title,
          duration,
          category,
          semester,
          team_size: teamSize,
          members,
          description: body,
          detailed_description: detailedDescription,
          tech_stack: JSON.stringify({ stack: techStack.split(",").map((s) => s.trim()) }),
          image_url: imageUrl,
        }
      } else if (board === "스터디") {
        payload = { text: body }
      } else if (board === "학회실 사용 시간표") {
        payload = {
          study_name: studyName,
          leader: studyLeader,
          color: studyColor,
          start_time: `${dayOfWeek} ${startTime}`,
          end_time: `${dayOfWeek} ${endTime}`,
        }
      }

      console.log("[v0] Inserting payload:", payload)
      console.log("[v0] Target table:", table)

      const { data, error } = await supabase.from(table).insert([payload])

      if (error) {
        console.log("[v0] Database insert error:", error)
        console.log("[v0] Error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        })
        setMessage("게시글 등록 실패: " + error.message)
      } else {
        console.log("[v0] Insert successful:", data)
        setMessage("업로드 되었습니다!") // Changed success message to be simpler
        resetForm()
        fetchPosts(board)

        setTimeout(() => {
          setMessage(null)
        }, 3000)
      }
    } catch (error) {
      console.log("[v0] Unexpected error:", error)
      setMessage("예상치 못한 오류가 발생했습니다: " + (error as Error).message)
    } finally {
      setIsUploading(false)
    }
  }

  const resetForm = () => {
    setTitle("")
    setBody("")
    setDuration("")
    setCategory("")
    setSemester("")
    setTeamSize(null)
    setMembers("")
    setTechStack("")
    setDetailedDescription("")
    setImage(null)
    setStudyName("")
    setStudyLeader("")
    setStartTime("")
    setEndTime("")
    setDayOfWeek("")
    setStudyColor("#00ff00")
    setMessage(null)
  }

  const handleDeletePost = async (post: any) => {
    const confirmDelete = confirm("정말로 삭제하시겠습니까?")
    if (!confirmDelete) {
      return
    }

    const table = getTableName(board)
    if (!table) return

    let deleteQuery
    if (table === "editor_3_study_timetable") {
      // For timetable, use combination of fields since there's no id column
      deleteQuery = supabase
        .from(table)
        .delete()
        .eq("study_name", post.study_name)
        .eq("leader", post.leader)
        .eq("start_time", post.start_time)
        .eq("end_time", post.end_time)
    } else {
      // For other tables, use id
      deleteQuery = supabase.from(table).delete().eq("id", post.id)
    }

    const { error } = await deleteQuery

    if (error) {
      console.log("[v0] Delete error:", error)
      setMessage("삭제 실패: " + error.message)
    } else {
      setMessage("삭제 완료")
      fetchPosts(board)
      setTimeout(() => {
        setMessage(null)
      }, 2000)
    }
  }

  // 학회실 시간표용 폼 검증 함수
  const validateTimetableForm = () => {
    if (!studyName.trim()) {
      setMessage("스터디명을 입력해주세요.")
      return false
    }
    if (!studyLeader.trim()) {
      setMessage("스터디장을 입력해주세요.")
      return false
    }
    if (!startTime) {
      setMessage("시작 시간을 선택해주세요.")
      return false
    }
    if (!endTime) {
      setMessage("끝나는 시간을 선택해주세요.")
      return false
    }
    if (!dayOfWeek) {
      setMessage("요일을 선택해주세요.")
      return false
    }

    // 시간 검증 로직 추가
    const startHour = Number.parseInt(startTime.split(":")[0])
    const startMinute = Number.parseInt(startTime.split(":")[1])
    const endHour = Number.parseInt(endTime.split(":")[0])
    const endMinute = Number.parseInt(endTime.split(":")[1])

    const startTotalMinutes = startHour * 60 + startMinute
    const endTotalMinutes = endHour * 60 + endMinute

    if (startTotalMinutes >= endTotalMinutes) {
      setMessage("시작 시간은 끝나는 시간보다 빨라야 합니다.")
      return false
    }

    return true
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">📋 관리자 게시판</h1>

      {/* 게시판 선택 */}
      <select
        value={board}
        onChange={(e) => {
          setBoard(e.target.value as BoardType)
          fetchPosts(e.target.value as BoardType)
        }}
        className="border rounded px-3 py-2 mb-6"
      >
        <option value="공지">공지</option>
        <option value="프로젝트">프로젝트</option>
        <option value="스터디">스터디</option>
        <option value="학회실 사용 시간표">학회실 사용 시간표</option>
      </select>

      {/* 새 글 작성 */}
      <div className="mb-8 border p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">새 게시글 작성</h2>

        {board === "공지" && (
          <textarea
            placeholder="내용"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full border px-3 py-2 mb-2 rounded"
          />
        )}

        {board === "프로젝트" && (
          <div className="space-y-2">
            <input
              className="w-full border px-3 py-2 rounded"
              placeholder="프로젝트명"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              className="w-full border px-3 py-2 rounded"
              placeholder="기간"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
            <input
              className="w-full border px-3 py-2 rounded"
              placeholder="카테고리"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <input
              className="w-full border px-3 py-2 rounded"
              placeholder="학기 (예: 2024-2)"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
            />
            <input
              className="w-full border px-3 py-2 rounded"
              type="number"
              placeholder="팀 규모"
              value={teamSize ?? ""}
              onChange={(e) => setTeamSize(Number(e.target.value))}
            />
            <input
              className="w-full border px-3 py-2 rounded"
              placeholder="팀원 (쉼표 구분)"
              value={members}
              onChange={(e) => setMembers(e.target.value)}
            />
            <textarea
              className="w-full border px-3 py-2 rounded"
              placeholder="간단 설명"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <textarea
              className="w-full border px-3 py-2 rounded"
              placeholder="상세 설명"
              value={detailedDescription}
              onChange={(e) => setDetailedDescription(e.target.value)}
            />
            <input
              className="w-full border px-3 py-2 rounded"
              placeholder="기술스택 (쉼표로 구분)"
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
            />
            <input type="file" onChange={(e) => setImage(e.target.files?.[0] || null)} />
          </div>
        )}

        {board === "학회실 사용 시간표" && (
          <div className="space-y-2">
            <input
              className="w-full border px-3 py-2 rounded"
              placeholder="스터디명 *"
              value={studyName}
              onChange={(e) => setStudyName(e.target.value)}
              required
            />
            <input
              className="w-full border px-3 py-2 rounded"
              placeholder="스터디장 *"
              value={studyLeader}
              onChange={(e) => setStudyLeader(e.target.value)}
              required
            />
            <select
              className="w-full border px-3 py-2 rounded"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            >
              <option value="">시작 시간 선택 *</option>
              {timeOptions.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
            <select
              className="w-full border px-3 py-2 rounded"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            >
              <option value="">끝나는 시간 선택 *</option>
              {timeOptions.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
            <select
              className="w-full border px-3 py-2 rounded"
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(e.target.value)}
              required
            >
              <option value="">요일 선택 *</option>
              {dayOptions.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
            <div className="flex items-center space-x-2">
              <label className="text-sm">색깔:</label>
              <input
                type="color"
                value={studyColor}
                onChange={(e) => setStudyColor(e.target.value)}
                className="w-16 h-10 border rounded cursor-pointer"
              />
              <span className="text-sm text-gray-600">{studyColor}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end space-x-3 mt-3">
          {message && (
            <p
              className={`text-sm ${message.includes("실패") || message.includes("오류") ? "text-red-600" : "text-green-600"}`}
            >
              {message}
            </p>
          )}
          <button
            onClick={handleCreatePost}
            disabled={isUploading}
            className={`px-4 py-2 rounded text-white ${
              isUploading ? "bg-gray-400 cursor-not-allowed" : "bg-gray-700 hover:bg-gray-800"
            }`}
          >
            {isUploading ? "업로드 중..." : "등록하기"}
          </button>
        </div>
      </div>

      {/* 게시글 리스트 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">{board} 리스트</h2>
        <ul className="space-y-3">
          {posts.map((post, index) => (
            <li key={post.id || index} className="border rounded p-3 flex justify-between items-start gap-3">
              <div className="flex-1">
                {board === "공지" && <p className="text-sm text-gray-700">{post.text}</p>}
                {board === "프로젝트" && (
                  <div>
                    <h3 className="font-semibold text-lg">{post.text}</h3>
                    <p className="text-sm text-gray-600">{post.description}</p>
                    <p className="text-xs text-gray-500">
                      {post.duration} / {post.category} / {post.semester} / {post.tech_stack.join(", ")}
                    </p>
                    {post.image_url && (
                      <img
                        src={`${proj_baseUrl}${post.image_url}`}
                        alt={post.text}
                        className="w-40 h-24 object-cover mt-2 rounded"
                      />
                    )}
                  </div>
                )}
                {board === "스터디" && <p className="text-sm text-gray-700">{post.text}</p>}
                {board === "학회실 사용 시간표" && (
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 rounded border" style={{ backgroundColor: post.color }}></div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{post.study_name}</h3>
                      <p className="text-sm text-gray-600">스터디장: {post.leader}</p>
                      <p className="text-xs text-gray-500">
                        {post.start_time}~{post.end_time}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => handleDeletePost(post)}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
