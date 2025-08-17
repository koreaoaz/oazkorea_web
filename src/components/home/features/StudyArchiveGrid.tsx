"use client"
import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { supabase } from "@/lib/supabaseClient"

// ===== 설정 =====
const BUCKET = "study-images" // 네가 만든 Public 버킷
const SIGNED_URL_TTL = 60 * 10 // 서명 URL 유효시간(초): 10분
const CARD_COUNT = 6 // 그리드 한 페이지 카드 수

type StudyItem = {
  name: string
  path: string
  signedUrl: string
  created_at?: string | null
  studyName: string
  studyDescription: string
}

export default function StudyArchiveGrid() {
  // Hover 확장
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null)
  const leaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 업로드/목록
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState<StudyItem[]>([])

  const [studyName, setStudyName] = useState("")
  const [studyDescription, setStudyDescription] = useState("")
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null)

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
      console.log("[v0] Fetching file list...")
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list("", { limit: 1000, sortBy: { column: "created_at", order: "desc" } })

      if (error) {
        console.error("list error:", error.message)
        if (error.message.includes("not found") || error.message.includes("does not exist")) {
          setSupabaseError(`버킷 '${BUCKET}'이 존재하지 않습니다. Supabase 대시보드에서 버킷을 생성해주세요.`)
        } else {
          setSupabaseError(`목록을 불러오는 중 오류가 발생했습니다: ${error.message}`)
        }
        return
      }

      const fileObjs = (data ?? []).filter((f) => f.name && !f.name.endsWith("/") && !f.name.endsWith(".json"))
      console.log("[v0] Found image files:", fileObjs.length)

      const signedItems: StudyItem[] = []

      const { data: buckets } = await supabase.storage.listBuckets()
      const bucket = buckets?.find((b) => b.name === BUCKET)
      const isPublic = bucket?.public || false
      console.log("[v0] Bucket is public:", isPublic)

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

        let studyName = "스터디"
        let studyDescription = "설명이 없습니다."

        const jsonFileName = f.name.replace(/\.[^.]+$/, ".json")
        console.log("[v0] Looking for metadata file:", jsonFileName)

        try {
          const { data: jsonData, error: jsonError } = await supabase.storage.from(BUCKET).download(jsonFileName)

          if (!jsonError && jsonData) {
            const text = await jsonData.text()
            console.log("[v0] Found metadata for", f.name, ":", text.substring(0, 100))
            const metadata = JSON.parse(text)
            studyName = metadata.studyName || "스터디"
            studyDescription = metadata.studyDescription || "설명이 없습니다."
            console.log("[v0] Parsed metadata - Name:", studyName, "Description length:", studyDescription.length)
          } else {
            console.log("[v0] No metadata file found for", f.name, "- using filename fallback")
            // Fallback to filename parsing
            const parts = f.name.split("_")
            if (parts.length >= 3) {
              try {
                studyName = decodeURIComponent(parts[2].split(".")[0]) || "스터디"
              } catch (e) {
                console.log("[v0] Filename parsing failed for", f.name)
              }
            }
          }
        } catch (e) {
          console.log("[v0] Error loading metadata for", f.name, ":", e)
          // Fallback to filename parsing
          const parts = f.name.split("_")
          if (parts.length >= 3) {
            try {
              studyName = decodeURIComponent(parts[2].split(".")[0]) || "스터디"
            } catch (e) {
              console.log("[v0] Filename parsing failed for", f.name)
            }
          }
        }

        signedItems.push({
          name: f.name,
          path,
          signedUrl: finalUrl,
          created_at: (f as any)?.created_at ?? null,
          studyName,
          studyDescription,
        })
      }

      console.log(
        "[v0] Final items with metadata:",
        signedItems.map((item) => ({
          name: item.name,
          studyName: item.studyName,
          descLength: item.studyDescription.length,
        })),
      )
      setFiles(signedItems)
      setCurrentPage((p) => Math.min(p, Math.max(0, Math.ceil(signedItems.length / CARD_COUNT) - 1)))
    } catch (err) {
      console.error("Fetch list error:", err)
      setSupabaseError("목록을 불러오는 중 오류가 발생했습니다.")
    }
  }

  // ===== 업로드 =====
  async function handleUpload() {
    if (!selectedFiles || selectedFiles.length === 0) return
    if (!studyName.trim()) {
      alert("스터디 이름을 입력해주세요.")
      return
    }

    if (!supabase) {
      alert("Supabase가 설정되지 않았습니다. 환경변수를 확인해주세요.")
      return
    }

    setUploading(true)
    try {
      console.log("[v0] Starting upload process...")
      const bucketReady = await ensureBucketExists()
      console.log("[v0] Bucket ready:", bucketReady)

      if (!bucketReady) {
        throw new Error("버킷에 접근할 수 없습니다.")
      }

      for (const file of Array.from(selectedFiles)) {
        console.log("[v0] Uploading file:", file.name)
        const ext = (() => {
          const m = file.name.match(/\.([a-zA-Z0-9]+)$/)
          return m ? m[1].toLowerCase() : "bin"
        })()

        const timestamp = Date.now()
        const shortId = crypto.randomUUID().split("-")[0]
        const safeName = `${timestamp}_${shortId}.${ext}`

        console.log("[v0] Safe filename:", safeName)

        const { error } = await supabase.storage.from(BUCKET).upload(safeName, file, {
          cacheControl: "3600",
          upsert: false,
        })

        if (error) {
          console.error("[v0] Upload error:", error)
          throw new Error(`업로드 실패: ${error.message}`)
        }

        const jsonFileName = safeName.replace(/\.[^.]+$/, ".json")
        const metadata = {
          studyName: studyName.trim(),
          studyDescription: studyDescription.trim() || "설명없음",
          originalFileName: file.name,
          uploadedAt: new Date().toISOString(),
        }

        const jsonBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: "application/json" })

        const { error: jsonError } = await supabase.storage.from(BUCKET).upload(jsonFileName, jsonBlob, {
          cacheControl: "3600",
          upsert: false,
        })

        if (jsonError) {
          console.warn("[v0] JSON metadata upload failed:", jsonError)
          // Don't fail the entire upload if JSON fails
        }

        console.log("[v0] File uploaded successfully:", safeName)
      }

      console.log("[v0] All files uploaded, refreshing list...")
      await fetchList()

      setStudyName("")
      setStudyDescription("")
      setSelectedFiles(null)
      setShowUploadForm(false)
    } catch (err: any) {
      console.error("[v0] Upload process error:", err)
      const errorMessage = err.message || "업로드 중 오류가 발생했습니다."
      alert(errorMessage)
      setSupabaseError(errorMessage)
    } finally {
      setUploading(false)
    }
  }

  // ===== 삭제 =====
  async function handleDelete(item: StudyItem) {
    if (!supabase) {
      alert("Supabase가 설정되지 않았습니다.")
      return
    }

    if (!confirm(`"${item.studyName}" 스터디를 삭제하시겠습니까?`)) {
      return
    }

    try {
      console.log("[v0] Deleting file:", item.name)

      // Delete the image file
      const { error: imageError } = await supabase.storage.from(BUCKET).remove([item.path])
      if (imageError) {
        console.error("[v0] Error deleting image:", imageError)
        throw new Error(`이미지 삭제 실패: ${imageError.message}`)
      }

      // Delete the metadata JSON file
      const jsonFileName = item.name.replace(/\.[^.]+$/, ".json")
      const { error: jsonError } = await supabase.storage.from(BUCKET).remove([jsonFileName])
      if (jsonError) {
        console.warn("[v0] Error deleting metadata (continuing):", jsonError)
      }

      console.log("[v0] File deleted successfully, refreshing list...")
      await fetchList()

      // Reset expanded state if the deleted item was expanded
      if (expandedIndex !== null && files[expandedIndex]?.name === item.name) {
        setExpandedIndex(null)
      }
    } catch (err: any) {
      console.error("[v0] Delete error:", err)
      alert(err.message || "삭제 중 오류가 발생했습니다.")
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
      {/* 제목 + 업로드 */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-3xl font-bold">2025-2 스터디 목록</h2>

        <label className="inline-flex items-center gap-3 rounded-md bg-black text-white px-4 py-2 text-sm cursor-pointer hover:bg-black/80 transition">
          스터디 추가
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              setSelectedFiles(e.target.files)
              if (e.target.files && e.target.files.length > 0) {
                setShowUploadForm(true)
              }
            }}
            disabled={uploading || !supabase}
          />
        </label>
      </div>

      {showUploadForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">스터디 정보 입력</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">스터디 이름 *</label>
                <input
                  type="text"
                  value={studyName}
                  onChange={(e) => setStudyName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="예: React 스터디"
                  maxLength={30}
                />
                <div className="text-xs text-gray-500 mt-1">{studyName.length}/30자</div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">스터디 설명</label>
                <textarea
                  value={studyDescription}
                  onChange={(e) => setStudyDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black h-32 resize-none"
                  placeholder="스터디에 대한 자세한 설명을 입력하세요..."
                  maxLength={2000}
                />
                <div className="text-xs text-gray-500 mt-1">{studyDescription.length}/2000자</div>
              </div>

              <div className="text-sm text-gray-500">선택된 파일: {selectedFiles?.length}개</div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowUploadForm(false)
                  setSelectedFiles(null)
                  setStudyName("")
                  setStudyDescription("")
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition"
                disabled={uploading}
              >
                취소
              </button>
              <button
                onClick={handleUpload}
                className="flex-1 px-4 py-2 bg-black text-white rounded-md hover:bg-black/80 transition"
                disabled={uploading || !studyName.trim()}
              >
                {uploading ? "업로드 중..." : "업로드"}
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
              <p className="font-semibold mb-2">RLS 정책 해결 방법:</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>Supabase 대시보드 → Storage → {BUCKET} 버킷 클릭</li>
                <li>Configuration → RLS policies</li>
                <li className="font-semibold">옵션 1: RLS 비활성화 (간단함)</li>
                <li className="ml-4">- "Enable RLS" 체크 해제</li>
                <li className="font-semibold">옵션 2: 업로드 정책 추가</li>
                <li className="ml-4">- "New Policy" → "For full customization"</li>
                <li className="ml-4">- Policy name: "Allow uploads"</li>
                <li className="ml-4">- Operation: INSERT</li>
                <li className="ml-4">
                  - Policy definition: <code className="bg-gray-200 px-1">true</code>
                </li>
              </ol>
            </div>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold mb-2">아직 등록된 스터디가 없습니다</h3>
            <p className="text-muted-foreground">위의 "스터디 추가" 버튼을 클릭해서 첫 번째 스터디를 등록해보세요!</p>
          </div>
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
                    className={`relative rounded-lg shadow-md bg-white overflow-hidden transition-all duration-300 ${
                      expandedIndex !== null && isInExpandedRows ? "opacity-0" : "opacity-100"
                    }`}
                    onMouseEnter={() => handleMouseEnter(globalIdx)}
                    style={{ height: "300px" }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(item)
                      }}
                      className="absolute top-2 right-2 px-2 py-1 bg-red-500 text-white rounded text-xs opacity-0 hover:opacity-100 transition-opacity duration-200 z-10 hover:bg-red-600"
                      title="삭제"
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
                    // If it's the bottom row and there are multiple rows, position to cover both rows
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
                <button
                  onClick={() => handleDelete(files[expandedIndex])}
                  className="absolute top-4 right-4 px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors duration-200 text-sm font-medium z-30"
                  title="삭제"
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
