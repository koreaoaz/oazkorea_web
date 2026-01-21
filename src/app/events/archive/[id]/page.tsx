import { supabase } from "@/lib/supabaseClient";
import { notFound } from "next/navigation"
import { ImageFromStorage } from "../components/ImageFromStorage"

type ImageItem = {
  order: number
  filename: string
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function EventDetailPage({ params }: PageProps) {
    const { id } = await params
  const { data: event, error } = await supabase
    .from("editor_6_events")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !event) {
    notFound()
  }

  const images: ImageItem[] =
    typeof event.filenames === "string"
      ? JSON.parse(event.filenames)
      : event.filenames ?? []

  images.sort((a, b) => a.order - b.order)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* 상단 텍스트 */}
      <header className="mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
            {event.title}
        </h1>

        {event.description && (
            <p className="text-gray-600 whitespace-pre-wrap mb-6">
            {event.description}
            </p>
        )}

        <hr className="border-t border-gray-200" />
        </header>

      {/* 이미지 본문 */}
      <section className="space-y-2">
        {images.map((img) => (
          <ImageFromStorage
            key={img.filename}
            board="행사"
            filename={img.filename}
            className="w-full rounded-lg border"
          />
        ))}
      </section>
    </div>
  )
}
