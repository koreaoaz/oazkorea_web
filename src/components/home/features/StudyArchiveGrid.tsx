"use client"
import { useEffect, useRef, useState } from "react"
import type React from "react"

import Image from "next/image"
import { supabase } from "@/lib/supabaseClient"

// ===== 설정 =====
const BUCKET = "study-images" // 네가 만든 Public 버킷
const SIGNED_URL_TTL = 60 * 10 // 서명 URL 유효시간(초): 10분
const CARD_COUNT = 6 // 그리드 한 페이지 카드 수

type StudyItem = {
  id?: number
  name: string
  path: string
  signedUrl: string
  created_at?: string | null
  studyName: string
  studyDescription: string
  studyLeader: string
}

export default function StudyArchiveGrid() {
  // Hover 확장
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null)
  const leaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 업로드/목록
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState<StudyItem[]>([])
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null)
  const [studyName, setStudyName] = useState("")
  const [studyDescription, setStudyDescription] = useState("")
  const [studyLeader, setStudyLeader] = useState("")

  // Supabase 연결 오류
  const [supabaseError, setSupabaseError] = useState<string | null>(null)

  // 페이지네이션(실제 파일 개수 기반)
  const [currentPage, setCurrentPage] = useState(0)
  const totalCount = files.length
  const totalPages = Math.max(1, Math.ceil(totalCount / CARD_COUNT))
  const start = currentPage * CARD_COUNT
  const end = Math.min(start + CARD_COUNT, totalCount)
  const visibleItems = files.slice(start, end)

  async function ensureBucketExists() {
    if (!supabase) return false

    try {
      console.log("[v0] Testing direct bucket access...")

      // Try to list files in the bucket to test if we can access it
      const { data, error } = await supabase.storage.from(BUCKET).list("", { limit: 1 })

      if (error) {
        console.error("[v0] Bucket access test failed:", error)
        if (error.message.includes("not found") || error.message.includes("does not exist")) {
          setSupabaseError(`버킷 '${BUCKET}'이 존재하지 않습니다. Supabase 대시보드에서 버킷을 생성해주세요.`)
        } else {
          setSupabaseError(`버킷 접근 권한이 없습니다: ${error.message}`)
        }
        return false
      }

      console.log("[v0] Bucket access test successful")
      return true
    } catch (err) {
      console.error("[v0] Error testing bucket access:", err)
      setSupabaseError("버킷 접근 테스트 중 오류가 발생했습니다.")
      return false
    }
  }

  // ===== Supabase 목록 불러오기 (각 항목에 서명 URL 생성) =====
  async function fetchList() {
    if (!supabase) {
      setSupabaseError("Supabase가 설정되지 않았습니다. 환경변수를 확인해주세요.")
      return
    }

    try {
      console.log("[v0] Fetching file list from database...")

      // Get metadata from database
      const { data: studyData, error: dbError } = await supabase
        .from("editor_2_studies")
        .select("*")
        .order("created_at", { ascending: false })

      if (dbError) {
        console.error("Database query error:", dbError.message)
        setSupabaseError(`데이터베이스 조회 중 오류가 발생했습니다: ${dbError.message}`)
        return
      }

      console.log("[v0] Found database records:", studyData?.length || 0)
      if (studyData && studyData.length > 0) {
        console.log("[v0] Available columns in database:", Object.keys(studyData[0]))
      }

      // Get storage files
      const { data: storageData, error: storageError } = await supabase.storage
        .from(BUCKET)
        .list("", { limit: 1000, sortBy: { column: "created_at", order: "desc" } })

      if (storageError) {
        console.error("Storage list error:", storageError.message)
        setSupabaseError(`스토리지 목록을 불러오는 중 오류가 발생했습니다: ${storageError.message}`)
        return
      }

      const fileObjs = (storageData ?? []).filter((f) => f.name && !f.name.endsWith("/") && !f.name.endsWith(".json"))
      console.log("[v0] Found storage files:", fileObjs.length)

      const signedItems: StudyItem[] = []

      const { data: buckets } = await supabase.storage.listBuckets()
      const bucket = buckets?.find((b) => b.name === BUCKET)
      const isPublic = bucket?.public || false
      console.log("[v0] Bucket is public:", isPublic)

      // Match storage files with database records
      for (const f of fileObjs) {
        const path = f.name
        let finalUrl: string

        if (isPublic) {
          const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(path)
          finalUrl = publicUrl.publicUrl
        } else {
          const { data: signed, error: sErr } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(path, SIGNED_URL_TTL)
          if (sErr || !signed) continue
          finalUrl = signed.signedUrl
        }

        // Find matching database record
        const dbRecord = studyData?.find(
          (record) => record.filename === f.name || record.file_name === f.name || record.image_url === f.name,
        )

        let studyName = "스터디"
        let studyDescription = "설명이 없습니다."
        let studyLeader = "미정"
        let recordId: number | undefined

        if (dbRecord) {
          studyName = dbRecord.study_name || dbRecord.name || dbRecord.title || "스터디"
          studyDescription =
            dbRecord.outline ||
            dbRecord.study_description ||
            dbRecord.description ||
            dbRecord.content ||
            "설명이 없습니다."
          studyLeader = dbRecord.leader || "미정"
          recordId = dbRecord.id
          console.log("[v0] Found database record for", f.name, ":", studyName)
        } else {
          console.log("[v0] No database record found for", f.name, "- using defaults")
        }

        signedItems.push({
          id: recordId,
          name: f.name,
          path,
          signedUrl: finalUrl,
          created_at: (f as any)?.created_at ?? null,
          studyName,
          studyDescription,
          studyLeader,
        })
      }

      console.log("[v0] Final items with database metadata:", signedItems.length)
      setFiles(signedItems)
      setCurrentPage((p) => Math.min(p, Math.max(0, Math.ceil(signedItems.length / CARD_COUNT) - 1)))
    } catch (err) {
      console.error("Fetch list error:", err)
      setSupabaseError("목록을 불러오는 중 오류가 발생했습니다.")
    }
  }

  // ===== 업로드 기능 =====
  const handleUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0 || !studyName.trim() || !studyLeader.trim()) {
      alert("파일, 스터디 이름, 스터디장 이름을 모두 입력해주세요.")
      return
    }

    if (!supabase) {
      alert("Supabase 연결이 필요합니다.")
      return
    }

    setUploading(true)
    console.log("[v0] Starting upload process...")

    try {
      const canAccess = await ensureBucketExists()
      if (!canAccess) {
        console.log("[v0] Upload error: 버킷에 접근할 수 없습니다.")
        throw new Error("버킷에 접근할 수 없습니다.")
      }

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        const timestamp = Date.now()
        const shortId = Math.random().toString(36).substring(2, 10)
        const extension = file.name.split(".").pop() || "png"
        const filename = `${timestamp}_${shortId}.${extension}`

        console.log("[v0] Uploading file:", filename)

        // Upload image to storage
        const { data: uploadData, error: uploadError } = await supabase.storage.from(BUCKET).upload(filename, file)

        if (uploadError) {
          console.error("[v0] Upload error:", uploadError.message)
          throw new Error(`업로드 실패: ${uploadError.message}`)
        }

        console.log("[v0] File uploaded successfully:", uploadData.path)

        // Save metadata to database
        const insertData = {
          filename: filename,
          study_name: studyName.trim(),
          outline: studyDescription.trim() || "설명이 없습니다.",
          leader: studyLeader.trim(),
        }

        const { error: dbError } = await supabase.from("editor_2_studies").insert(insertData)

        if (dbError) {
          console.error("[v0] Database insert error:", dbError.message)
          console.warn("[v0] Database insert failed, but file upload succeeded. File:", filename)
        } else {
          console.log("[v0] Metadata saved to database successfully")
        }
      }

      // Reset form and refresh list
      setSelectedFiles(null)
      setStudyName("")
      setStudyDescription("")
      setStudyLeader("")
      setShowUploadForm(false)
      await fetchList()

      console.log("[v0] Upload completed successfully")
    } catch (error: any) {
      console.error("[v0] Upload process error:", error.message)
      alert(`업로드 중 오류가 발생했습니다: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  // ===== 삭제 기능 =====
  const handleDelete = async (item: StudyItem) => {
    if (!confirm(`"${item.studyName}" 스터디를 삭제하시겠습니까?`)) {
      return
    }

    if (!supabase) {
      alert("Supabase 연결이 필요합니다.")
      return
    }

    try {
      console.log("[v0] Deleting item:", item.name)

      // Delete from database
      if (item.id) {
        const { error: dbError } = await supabase.from("editor_2_studies").delete().eq("id", item.id)

        if (dbError) {
          console.error("[v0] Database delete error:", dbError.message)
          throw new Error(`데이터베이스 삭제 실패: ${dbError.message}`)
        }
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([item.name])

      if (storageError) {
        console.error("[v0] Storage delete error:", storageError.message)
        throw new Error(`스토리지 삭제 실패: ${storageError.message}`)
      }

      console.log("[v0] Item deleted successfully")
      await fetchList()
    } catch (error: any) {
      console.error("[v0] Delete error:", error.message)
      alert(`삭제 중 오류가 발생했습니다: ${error.message}`)
    }
  }

  // ===== 파일 선택 핸들러 =====
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      setSelectedFiles(files)
      setShowUploadForm(true)
    }
  }

  useEffect(() => {
    if (supabase) {
      ensureBucketExists().then((success) => {
        if (success) {
          fetchList()
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ===== Hover 핸들러 =====
  const handleMouseEnter = (index: number) => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => setExpandedIndex(index), 900)
  }
  const handleMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    leaveTimerRef.current = setTimeout(() => setExpandedIndex(null), 700)
  }

  // ===== 페이지 이동 =====
  const goPrev = () => setCurrentPage((p) => Math.max(0, p - 1))
  const goNext = () => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))

  useEffect(() => {
    setExpandedIndex(null)
  }, [currentPage])

  return (
    <div className="w-full px-10 py-8">
      {/* 제목 */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-3xl font-bold">2025-2 스터디 목록</h2>
        {/* ===== 업로드 버튼 ===== */}
        <div className="flex items-center gap-4">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 cursor-pointer transition-colors"
          >
            스터디 추가
          </label>
        </div>
      </div>

      {/* ===== 업로드 폼 ===== */}
      {showUploadForm && (
        <div className="mb-6 p-6 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">스터디 정보 입력</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                스터디 이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={studyName}
                onChange={(e) => setStudyName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="스터디 이름을 입력하세요"
                maxLength={100}
              />
              <div className="text-xs text-gray-500 mt-1">{studyName.length}/100</div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                스터디장 이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={studyLeader}
                onChange={(e) => setStudyLeader(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="스터디장 이름을 입력하세요"
                maxLength={50}
              />
              <div className="text-xs text-gray-500 mt-1">{studyLeader.length}/50</div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">스터디 설명</label>
              <textarea
                value={studyDescription}
                onChange={(e) => setStudyDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-32 resize-none"
                placeholder="스터디에 대한 자세한 설명을 입력하세요"
                maxLength={2000}
              />
              <div className="text-xs text-gray-500 mt-1">{studyDescription.length}/2000</div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleUpload}
                disabled={uploading || !studyName.trim() || !studyLeader.trim()}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {uploading ? "업로드 중..." : "업로드"}
              </button>
              <button
                onClick={() => {
                  setShowUploadForm(false)
                  setSelectedFiles(null)
                  setStudyName("")
                  setStudyDescription("")
                  setStudyLeader("")
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative w-full max-w-5xl mx-auto">
        {supabaseError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold mb-2 text-red-500">Supabase 연결 오류</h3>
            <p className="text-muted-foreground mb-4">{supabaseError}</p>
            <div className="bg-gray-100 p-4 rounded-md text-sm text-left max-w-lg">
              <p className="font-semibold mb-2">해결 방법:</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>Supabase 대시보드에서 {BUCKET} 버킷 생성</li>
                <li>editor_2_studies 테이블 생성 (SQL 스크립트 실행)</li>
                <li>환경변수 설정 확인</li>
              </ol>
            </div>
          </div>
        ) : files.length === 0 ? (
          <div></div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-6" style={{ minHeight: "600px" }}>
              {visibleItems.map((item, idx) => {
                const globalIdx = start + idx
                const row = Math.floor(idx / 3)
                const isInExpandedRows =
                  expandedIndex !== null &&
                  (Math.floor((expandedIndex - start) / 3) === row ||
                    Math.floor((expandedIndex - start) / 3) === row - 1)

                return (
                  <div
                    key={item.path}
                    className={`relative rounded-lg shadow-md bg-white overflow-hidden transition-all duration-300 group ${
                      expandedIndex !== null && isInExpandedRows ? "opacity-0" : "opacity-100"
                    }`}
                    onMouseEnter={() => handleMouseEnter(globalIdx)}
                    style={{ height: "300px" }}
                  >
                    {/* ===== 삭제 버튼 ===== */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(item)
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-600"
                    >
                      삭제
                    </button>

                    <div className="h-full p-6 flex flex-col items-center justify-center">
                      <div className="w-4/5 aspect-square rounded-md overflow-hidden mb-4">
                        <Image
                          src={item.signedUrl || "/placeholder.svg"}
                          alt={item.studyName}
                          width={200}
                          height={200}
                          className="w-full h-full object-cover"
                          unoptimized
                          priority={idx < 2}
                        />
                      </div>
                      <h3 className="text-base font-semibold text-center px-2">{item.studyName}</h3>
                    </div>
                  </div>
                )
              })}
            </div>

            {expandedIndex !== null && files[expandedIndex] && (
              <div
                className={`absolute bg-white rounded-lg shadow-lg transform transition-all duration-700 ease-in-out z-20 ${
                  expandedIndex !== null ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                }`}
                style={{
                  top: (() => {
                    const cardRow = Math.floor((expandedIndex - start) / 3)
                    const totalRows = Math.ceil(visibleItems.length / 3)
                    if (cardRow === totalRows - 1 && totalRows > 1) {
                      return `${(cardRow - 1) * 324}px`
                    }
                    return `${cardRow * 324}px`
                  })(),
                  left: "0",
                  right: "0",
                  height: "635px",
                }}
                onMouseLeave={handleMouseLeave}
              >
                {/* ===== 확장 카드에서 삭제 버튼 ===== */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(files[expandedIndex])
                  }}
                  className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 z-30"
                >
                  삭제
                </button>

                <div className="h-full flex">
                  <div className="w-1/2 p-8 flex items-center justify-center">
                    <div className="w-full aspect-square rounded-lg overflow-hidden max-w-[320px]">
                      <Image
                        src={files[expandedIndex].signedUrl || "/placeholder.svg"}
                        alt={files[expandedIndex].studyName}
                        width={400}
                        height={400}
                        className="w-full h-full object-cover"
                        unoptimized
                        priority
                      />
                    </div>
                  </div>
                  <div className="w-1/2 p-8 flex flex-col justify-center">
                    <h2 className="text-2xl font-bold mb-6">{files[expandedIndex].studyName}</h2>
                    <div className="mb-4">
                      <span className="text-lg font-semibold text-gray-700">스터디장: </span>
                      <span className="text-lg text-gray-600">{files[expandedIndex].studyLeader}</span>
                    </div>
                    <div className="text-gray-600 leading-relaxed overflow-y-auto max-h-[400px]">
                      {files[expandedIndex].studyDescription.split("\n").map((line, i) => (
                        <p key={i} className="mb-2">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentPage > 0 && (
              <button
                type="button"
                onClick={goPrev}
                className="absolute bottom-4 -left-14 -translate-x-[10px] h-11 w-11 rounded-full bg-black text-white shadow backdrop-blur flex items-center justify-center transform transition-transform duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/40"
                aria-label="Previous page"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                  <path
                    d="M15 19l-7-7 7-7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}

            {currentPage < totalPages - 1 && (
              <button
                type="button"
                onClick={goNext}
                className="absolute bottom-4 -right-14 translate-x-[10px] h-11 w-11 rounded-full bg-black text-white shadow backdrop-blur flex items-center justify-center transform transition-transform duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/40"
                aria-label="Next page"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                  <path
                    d="M9 5l7 7-7 7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}

            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span>{`${currentPage + 1} / ${totalPages} (총 ${totalCount}개 스터디)`}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
