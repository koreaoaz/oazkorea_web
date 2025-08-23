"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

type BoardType = "공지" | "프로젝트" | "스터디" | "학회실 사용 시간표"

const getTableName = (board: BoardType): string | null => {
  switch (board) {
    case "공지":
      return "editor_0_noti"
    case "프로젝트":
      return "editor_1_projects"
    case "스터디":
      return "editor_2_studies"
    case "학회실 사용 시간표":
      return "editor_3_study_timetable"
    default:
      return null
  }
}

const sanitizeFileName = (fileName: string): string => {
  // Get file extension
  const lastDotIndex = fileName.lastIndexOf(".")
  const name = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName
  const extension = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : ""

  // Remove or replace problematic characters
  const sanitized = name
    .replace(/[^\w\-_.]/g, "_") // Replace non-alphanumeric chars with underscore
    .replace(/\s+/g, "_") // Replace spaces with underscore
    .replace(/_{2,}/g, "_") // Replace multiple underscores with single
    .replace(/^_+|_+$/g, "") // Remove leading/trailing underscores
    .toLowerCase() // Convert to lowercase

  // Generate unique prefix to avoid conflicts
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substring(2, 8)

  return `${timestamp}_${randomStr}_${sanitized}${extension}`
}

const useDragAndDrop = (posts: any[], setPosts: any, board: BoardType) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [dropPosition, setDropPosition] = useState<"top" | "bottom" | null>(null)

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()

    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const height = rect.height

    const position = y < height / 2 ? "top" : "bottom"

    setDragOverIndex(index)
    setDropPosition(position)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
    setDropPosition(null)
  }

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()

    if (draggedIndex === null) return

    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const height = rect.height

    let newIndex = dropIndex
    if (y >= height / 2) {
      newIndex = dropIndex + 1
    }

    if (draggedIndex < newIndex) {
      newIndex -= 1
    }

    if (draggedIndex === newIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      setDropPosition(null)
      return
    }

    const newPosts = [...posts]
    const [draggedItem] = newPosts.splice(draggedIndex, 1)
    newPosts.splice(newIndex, 0, draggedItem)

    const table = getTableName(board)
    if (table) {
      try {
        for (let i = 0; i < newPosts.length; i++) {
          const { error } = await supabase
            .from(table)
            .update({ id: i + 1 })
            .eq("id", newPosts[i].id)

          if (error) {
            console.error("Error updating order:", error)
            return
          }
        }

        const updatedPosts = newPosts.map((post, index) => ({
          ...post,
          id: index + 1,
        }))

        setPosts(updatedPosts)
      } catch (error) {
        console.error("Error reordering posts:", error)
      }
    }

    setDraggedIndex(null)
    setDragOverIndex(null)
    setDropPosition(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
    setDropPosition(null)
  }

  return {
    draggedIndex,
    dragOverIndex,
    dropPosition,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  }
}

const useImageUpload = () => {
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setImage(file)

    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setImagePreview(null)
    }
  }

  const resetImage = () => {
    setImage(null)
    setImagePreview(null)
  }

  const clearImage = () => {
    setImage(null)
    setImagePreview(null)
    // Reset the file input
    const fileInput = document.getElementById("project-image") as HTMLInputElement
    if (fileInput) fileInput.value = ""
    const studyFileInput = document.getElementById("study-image") as HTMLInputElement
    if (studyFileInput) studyFileInput.value = ""
  }

  return {
    image,
    imagePreview,
    handleImageChange,
    resetImage,
    clearImage,
  }
}

const validateTimetableForm = () => {
  return true
}

const fetchPosts = async (board: BoardType, setPosts: any) => {
  const table = getTableName(board)
  if (!table) return

  const { data, error } = await supabase.from(table).select("*")
  if (error) {
    console.error("Error fetching posts:", error)
  } else {
    setPosts(data)
  }
}

const handleDeletePost = async (post: any, board: BoardType, setPosts: any) => {
  const confirmed = window.confirm("정말로 삭제하십니까?")
  if (!confirmed) {
    return
  }

  const table = getTableName(board as BoardType)
  if (!table) return

  try {
    if (post.filename) {
      let bucketName = ""

      if (board === "프로젝트") {
        bucketName = "project_img"
      } else if (board === "스터디") {
        bucketName = "study-images"
      }

      if (bucketName) {
        console.log("[v0] Attempting to delete image from bucket:", bucketName, "file:", post.filename)

        // First check if the file exists
        const { data: fileExists, error: listError } = await supabase.storage
          .from(bucketName)
          .list("", { search: post.filename })

        if (listError) {
          console.log("[v0] Error checking file existence:", listError)
        } else {
          console.log("[v0] File existence check result:", fileExists)
        }

        // Attempt to delete the file
        const { data: deleteData, error: storageError } = await supabase.storage
          .from(bucketName)
          .remove([post.filename])

        console.log("[v0] Delete operation result:", { data: deleteData, error: storageError })

        if (storageError) {
          console.error("[v0] Error deleting image from storage:", storageError)
          console.error("[v0] Storage error details:", {
            message: storageError.message,
            bucket: bucketName,
            filename: post.filename,
          })
          // Continue with post deletion even if image deletion fails
        } else {
          console.log("[v0] Successfully deleted image from storage")
          console.log("[v0] Deleted files:", deleteData)
        }
      }
    } else {
      console.log("[v0] No filename found for post, skipping image deletion")
    }

    // Delete post from database table
    console.log("[v0] Deleting post from table:", table, "with ID:", post.id)
    const { error } = await supabase.from(table).delete().eq("id", post.id)
    if (error) {
      console.error("[v0] Error deleting post from database:", error)
    } else {
      console.log("[v0] Successfully deleted post from database")
      fetchPosts(board as BoardType, setPosts)
    }
  } catch (error) {
    console.error("[v0] Unexpected error during post deletion:", error)
  }
}

const timeOptions = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
]
const dayOptions = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"]

const getBucketName = (type: "study" | "project"): string => {
  if (type === "study") {
    return "study-images" // This works based on debug logs
  } else {
    return "project_img" // Try the original name user mentioned
  }
}

export default function AdminBoardPage() {
  const [session, setSession] = useState<any>(null)
  const [board, setBoard] = useState<BoardType>("공지")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [availableBuckets, setAvailableBuckets] = useState<string[]>([])

  const [duration, setDuration] = useState("")
  const [category, setCategory] = useState("")
  const [semester, setSemester] = useState("")
  const [teamSize, setTeamSize] = useState<number | null>(null)
  const [members, setMembers] = useState("")
  const [techStack, setTechStack] = useState("")
  const [detailedDescription, setDetailedDescription] = useState("")
  const [studyName, setStudyName] = useState("")
  const [studyLeader, setStudyLeader] = useState("")
  const [studyOutline, setStudyOutline] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [dayOfWeek, setDayOfWeek] = useState("")
  const [studyColor, setStudyColor] = useState("#00ff00")

  const proj_baseUrl = process.env.NEXT_PUBLIC_PROJECT_STORAGE_URL

  const projectImage = useImageUpload()
  const studyImage = useImageUpload()

  const discoverBuckets = async () => {
    try {
      console.log("[v0] Discovering available buckets...")
      const { data: buckets, error } = await supabase.storage.listBuckets()

      if (error) {
        console.log("[v0] Error listing buckets:", error)
        return
      }

      const bucketNames = buckets?.map((bucket) => bucket.name) || []
      console.log("[v0] Available buckets:", bucketNames)
      setAvailableBuckets(bucketNames)

      return bucketNames
    } catch (error) {
      console.log("[v0] Error discovering buckets:", error)
      return []
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
    projectImage.resetImage()
    setStudyName("")
    setStudyLeader("")
    setStudyOutline("")
    studyImage.resetImage()
    setStartTime("")
    setEndTime("")
    setDayOfWeek("")
    setStudyColor("#00ff00")
    setMessage(null)
  }

  const handleCreatePost = async () => {
    const table = getTableName(board)
    if (!table) return

    setIsUploading(true)
    let imageUrl = null

    try {
      await discoverBuckets()

      if (board === "프로젝트" && projectImage.image) {
        const fileName = sanitizeFileName(projectImage.image.name)
        const bucketName = "project_img"
        console.log("[v0] Using project bucket:", bucketName)
        console.log("[v0] Sanitized project file name:", fileName)

        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, projectImage.image, { contentType: projectImage.image.type })

        if (uploadError) {
          console.log("[v0] Project image upload error:", uploadError)
          setMessage("프로젝트 이미지 업로드 실패: " + uploadError.message)
          setIsUploading(false)
          return
        }
        console.log("[v0] Project image uploaded successfully:", fileName)
        imageUrl = fileName
      }

      if (board === "스터디" && studyImage.image) {
        const fileName = sanitizeFileName(studyImage.image.name)
        const bucketName = "study-images"
        console.log("[v0] Using study bucket:", bucketName)
        console.log("[v0] Sanitized study file name:", fileName)

        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, studyImage.image, { contentType: studyImage.image.type })

        if (uploadError) {
          console.log("[v0] Study image upload error:", uploadError)
          setMessage("스터디 이미지 업로드 실패: " + uploadError.message)
          setIsUploading(false)
          return
        }
        console.log("[v0] Study image uploaded successfully:", fileName)
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
        const { data: maxIdData } = await supabase.from(table).select("id").order("id", { ascending: false }).limit(1)

        const nextId = maxIdData && maxIdData.length > 0 ? maxIdData[0].id + 1 : 1

        payload = {
          id: nextId,
          created_at: new Date().toISOString(),
          project_name: title,
          duration,
          category,
          semester,
          team_size: teamSize,
          members,
          description: body,
          detailed_description: detailedDescription,
          tech_stack: JSON.stringify({ stack: techStack.split(",").map((s) => s.trim()) }),
          filename: imageUrl,
        }
      } else if (board === "스터디") {
        const { data: maxIdData } = await supabase.from(table).select("id").order("id", { ascending: false }).limit(1)

        const nextId = maxIdData && maxIdData.length > 0 ? maxIdData[0].id + 1 : 1

        payload = {
          id: nextId,
          created_at: new Date().toISOString(),
          study_name: studyName,
          leader: studyLeader,
          outline: studyOutline,
          filename: imageUrl,
        }
      } else if (board === "학회실 사용 시간표") {
        const { data: maxIdData } = await supabase.from(table).select("id").order("id", { ascending: false }).limit(1)

        const nextId = maxIdData && maxIdData.length > 0 ? maxIdData[0].id + 1 : 1

        payload = {
          id: nextId,
          study_name: studyName,
          leader: studyLeader,
          color: studyColor,
          start_time: `${dayOfWeek} ${startTime}`,
          end_time: `${dayOfWeek} ${endTime}`,
          created_at: new Date().toISOString(),
        }
      }

      console.log("[v0] Inserting payload:", payload)
      console.log("[v0] Target table:", table)

      const { data, error } = await supabase.from(table).insert([payload])

      if (error) {
        console.log("[v0] Database insert error:", error)
        setMessage("게시글 등록 실패: " + error.message)
      } else {
        console.log("[v0] Insert successful:", data)
        setMessage("업로드 되었습니다!")
        resetForm()
        fetchPosts(board, setPosts)

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

  const dragAndDrop = useDragAndDrop(posts, setPosts, board)

  useEffect(() => {
    fetchPosts(board, setPosts)
    discoverBuckets()
  }, [board])

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold">📋 관리자 게시판</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold">게시판 선택</h2>
        </div>
        <div className="p-6">
          <select
            value={board}
            onChange={(e) => {
              const value = e.target.value as BoardType
              setBoard(value)
              fetchPosts(value, setPosts)
            }}
            className="w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="공지">공지</option>
            <option value="프로젝트">프로젝트</option>
            <option value="스터디">스터디</option>
            <option value="학회실 사용 시간표">학회실 사용 시간표</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold">새 게시글 작성</h2>
        </div>
        <div className="p-6 space-y-4">
          {board === "공지" && (
            <textarea
              placeholder="내용"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full min-h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
            />
          )}

          {board === "프로젝트" && (
            <div className="space-y-4">
              <input
                type="text"
                placeholder="프로젝트명"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="기간"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="카테고리"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="학기 (예: 2024-2)"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="number"
                  placeholder="팀 규모"
                  value={teamSize ?? ""}
                  onChange={(e) => setTeamSize(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <input
                type="text"
                placeholder="팀원 (쉼표 구분)"
                value={members}
                onChange={(e) => setMembers(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <textarea
                placeholder="간단 설명"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full min-h-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
              />
              <textarea
                placeholder="상세 설명"
                value={detailedDescription}
                onChange={(e) => setDetailedDescription(e.target.value)}
                className="w-full min-h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
              />
              <input
                type="text"
                placeholder="기술스택 (쉼표로 구분)"
                value={techStack}
                onChange={(e) => setTechStack(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <label htmlFor="project-image" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      <span className="text-sm font-medium">이미지 선택</span>
                    </div>
                  </label>
                  <input
                    id="project-image"
                    type="file"
                    accept="image/*"
                    onChange={projectImage.handleImageChange}
                    className="hidden"
                  />
                  {projectImage.image && <span className="text-sm text-gray-600">{projectImage.image.name}</span>}
                </div>
                {projectImage.imagePreview && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">미리보기:</span>
                    <img
                      src={projectImage.imagePreview || "/placeholder.svg"}
                      alt="미리보기"
                      className="w-20 h-20 object-cover rounded-md border"
                    />
                    <button
                      type="button"
                      onClick={projectImage.clearImage}
                      className="ml-2 px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {board === "스터디" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="스터디명 *"
                  value={studyName}
                  onChange={(e) => setStudyName(e.target.value)}
                  required
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="스터디장 *"
                  value={studyLeader}
                  onChange={(e) => setStudyLeader(e.target.value)}
                  required
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <textarea
                placeholder="스터디 설명 *"
                value={studyOutline}
                onChange={(e) => setStudyOutline(e.target.value)}
                required
                className="w-full min-h-40 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
              />
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <label htmlFor="study-image" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      <span className="text-sm font-medium">이미지 선택</span>
                    </div>
                  </label>
                  <input
                    id="study-image"
                    type="file"
                    accept="image/*"
                    onChange={studyImage.handleImageChange}
                    className="hidden"
                  />
                  {studyImage.image && <span className="text-sm text-gray-600">{studyImage.image.name}</span>}
                </div>
                {studyImage.imagePreview && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">미리보기:</span>
                    <img
                      src={studyImage.imagePreview || "/placeholder.svg"}
                      alt="미리보기"
                      className="w-20 h-20 object-cover rounded-md border"
                    />
                    <button
                      type="button"
                      onClick={studyImage.clearImage}
                      className="ml-2 px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {board === "학회실 사용 시간표" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="스터디명 *"
                  value={studyName}
                  onChange={(e) => setStudyName(e.target.value)}
                  required
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="스터디장 *"
                  value={studyLeader}
                  onChange={(e) => setStudyLeader(e.target.value)}
                  required
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">시작 시간 선택 *</option>
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
                <select
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">끝나는 시간 선택 *</option>
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">요일 선택 *</option>
                  {dayOptions.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">색깔:</label>
                <input
                  type="color"
                  value={studyColor}
                  onChange={(e) => setStudyColor(e.target.value)}
                  className="w-16 h-10 border rounded cursor-pointer"
                />
                <span className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm">{studyColor}</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
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
              className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isUploading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m5 5v-4m0 4h-4"
                    />
                  </svg>
                  업로드 중...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  등록하기
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold">{board} 리스트</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {posts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">게시글이 없습니다.</p>
            ) : (
              posts.map((post, index) => (
                <div key={post.id || index}>
                  {dragAndDrop.dragOverIndex === index && dragAndDrop.dropPosition === "top" && (
                    <div className="h-0.5 bg-gray-400 rounded-full mb-2" />
                  )}

                  <div
                    draggable
                    onDragStart={(e) => dragAndDrop.handleDragStart(e, index)}
                    onDragOver={(e) => dragAndDrop.handleDragOver(e, index)}
                    onDragLeave={dragAndDrop.handleDragLeave}
                    onDrop={(e) => dragAndDrop.handleDrop(e, index)}
                    onDragEnd={dragAndDrop.handleDragEnd}
                    className={`cursor-move transition-opacity bg-white border border-gray-200 rounded-lg shadow-sm ${
                      dragAndDrop.draggedIndex === index ? "opacity-50" : ""
                    }`}
                  >
                    <div className="p-6">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex items-start gap-3">
                          <svg
                            className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0 cursor-grab active:cursor-grabbing"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <circle cx="9" cy="5" r="1" />
                            <circle cx="15" cy="5" r="1" />
                            <circle cx="9" cy="12" r="1" />
                            <circle cx="15" cy="12" r="1" />
                            <circle cx="9" cy="19" r="1" />
                            <circle cx="15" cy="19" r="1" />
                          </svg>
                          <div className="flex-1">
                            {board === "공지" && <p className="text-sm text-gray-600">{post.text}</p>}

                            {board === "프로젝트" && (
                              <div className="space-y-3">
                                <div className="flex items-start gap-4">
                                  {post.filename && (
                                    <img
                                      src={`${supabase.storage.from("project_img").getPublicUrl(post.filename).data.publicUrl}`}
                                      alt={post.project_name}
                                      className="w-20 h-20 object-cover rounded-md border flex-shrink-0"
                                    />
                                  )}
                                  <div className="flex-1">
                                    <h3 className="font-semibold text-lg">{post.project_name}</h3>
                                    <p className="text-sm text-gray-600">{post.description}</p>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                                        {post.duration}
                                      </span>
                                      <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                                        {post.category}
                                      </span>
                                      <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                                        {post.semester}
                                      </span>
                                    </div>
                                    {(() => {
                                      try {
                                        const techStack = post.tech_stack
                                          ? typeof post.tech_stack === "string"
                                            ? JSON.parse(post.tech_stack)
                                            : post.tech_stack
                                          : null
                                        const stackArray = techStack?.stack || []

                                        return stackArray.length > 0 ? (
                                          <div className="flex flex-wrap gap-1 mt-2">
                                            {stackArray.map((tech: string, i: number) => (
                                              <span
                                                key={i}
                                                className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded border"
                                              >
                                                {tech}
                                              </span>
                                            ))}
                                          </div>
                                        ) : null
                                      } catch (error) {
                                        console.log("[v0] Tech stack parsing error:", error)
                                        return null
                                      }
                                    })()}
                                  </div>
                                </div>
                              </div>
                            )}

                            {board === "스터디" && (
                              <div className="flex items-start gap-4">
                                {post.filename && (
                                  <img
                                    src={`${supabase.storage.from("study-images").getPublicUrl(post.filename).data.publicUrl}`}
                                    alt={post.study_name}
                                    className="w-20 h-20 object-cover rounded-md border flex-shrink-0"
                                  />
                                )}
                                <div className="flex-1">
                                  <h3 className="font-semibold text-lg">{post.study_name}</h3>
                                  <p className="text-sm text-gray-600">스터디장: {post.leader}</p>
                                </div>
                              </div>
                            )}

                            {board === "학회실 사용 시간표" && (
                              <div className="flex items-center gap-4">
                                <div className="w-6 h-6 rounded border-2" style={{ backgroundColor: post.color }} />
                                <div className="flex-1">
                                  <h3 className="font-semibold text-lg">{post.study_name}</h3>
                                  <p className="text-sm text-gray-600">스터디장: {post.leader}</p>
                                  <p className="text-xs text-gray-500">
                                    {post.start_time} ~ {post.end_time}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeletePost(post, board, setPosts)}
                          className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>

                  {dragAndDrop.dragOverIndex === index && dragAndDrop.dropPosition === "bottom" && (
                    <div className="h-0.5 bg-gray-400 rounded-full mt-2" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
