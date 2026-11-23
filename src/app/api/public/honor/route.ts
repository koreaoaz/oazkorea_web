import { handlePublicHonor } from '@/lib/honor-server'
import {securityBridgeFetch} from '@/lib/security-bridge'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handlePublicHonor(process.env,securityBridgeFetch())
}
