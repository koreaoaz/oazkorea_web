import {trafficRequest} from '@/lib/traffic-server'
export const dynamic='force-dynamic'
export const GET=(request:Request)=>trafficRequest(request,process.env)
export const POST=GET
