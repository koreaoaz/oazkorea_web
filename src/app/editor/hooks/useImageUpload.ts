import { useState } from "react"

export function useImageUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setFile(f)

    if (!f) return setPreview(null)

    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(f)
  }

  const reset = () => {
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? [])
    setFiles(selectedFiles)

    Promise.all(
      selectedFiles.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(file)
          })
      )
    ).then(setPreviews)
  }

  const reset = () => {
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
