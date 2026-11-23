import { handleAdminRequest } from '@/lib/admin/http'
import { adminPort } from '@/lib/admin/server'

export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  return handleAdminRequest(request, process.env, adminPort)
}
