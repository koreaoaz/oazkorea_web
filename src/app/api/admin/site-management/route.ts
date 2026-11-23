import {adminPort} from '@/lib/admin/server'
import {acceptanceRpc} from '@/lib/acceptance-rpc'
import {handleSiteManagement} from '@/lib/admin/site-management'
export const dynamic='force-dynamic'
export async function POST(request:Request){
 return handleSiteManagement(request,process.env,token=>({verify:()=>adminPort(token).verify(token),execute:command=>acceptanceRpc('site_manage',{command},token)}))
}
