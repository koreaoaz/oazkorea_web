import {servePublicData} from '@/lib/public-data-server'
export const dynamic = 'force-dynamic'
export async function GET(request: Request, {params}: {params: Promise<{table: string}>}) {
  return servePublicData(request,(await params).table)
}
export const HEAD = GET
