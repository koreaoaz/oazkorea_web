import { useEffect, useRef, useState } from "react"

export function useImageUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const revision = useRef(0)
  const readerRef = useRef<FileReader | null>(null)
  useEffect(() => () => { revision.current++; readerRef.current?.abort() }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const current = ++revision.current
    readerRef.current?.abort()
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setPreview(null)

    if (!f) return setPreview(null)

    const reader = new FileReader()
    readerRef.current = reader
    reader.onload = () => { if (current === revision.current) setPreview(typeof reader.result === "string" ? reader.result : null) }
    reader.onerror = () => { if (current === revision.current) setPreview(null) }
    reader.readAsDataURL(f)
  }

  const reset = () => {
    revision.current++
    readerRef.current?.abort()
    setFile(null)
    setPreview(null)
  }

  return {
    file,
    preview,
    handleChange,
    reset,
  }
}

export function useMultiImageUpload() {
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const revision = useRef(0)
  const readers = useRef<FileReader[]>([])
  useEffect(() => () => { revision.current++; readers.current.forEach(reader => reader.abort()) }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const current = ++revision.current
    readers.current.forEach(reader => reader.abort())
    readers.current = []
    const selectedFiles = Array.from(e.target.files ?? [])
    setFiles(selectedFiles)
    setPreviews([])

    Promise.all(
      selectedFiles.map(
        (file) =>
          new Promise<string | null>((resolve) => {
            const reader = new FileReader()
            readers.current.push(reader)
            reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null)
            reader.onerror = reader.onabort = () => resolve(null)
            reader.readAsDataURL(file)
          })
      )
    ).then(values => { if (current === revision.current) setPreviews(values.filter((value): value is string => value !== null)) })
  }

  const reset = () => {
    revision.current++
    readers.current.forEach(reader => reader.abort())
    setFiles([])
    setPreviews([])
  }

  return {
    files,
    previews,
    handleChange,
    reset,
  }
}
