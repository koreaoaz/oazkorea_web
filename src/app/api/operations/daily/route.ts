import {dailyCheck} from '@/lib/traffic-server'
export const dynamic='force-dynamic'
export const GET=(request:Request)=>dailyCheck(request,process.env)
