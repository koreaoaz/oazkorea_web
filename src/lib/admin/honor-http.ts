import {handleHonorWorkflow,type HonorWorkflowCommand,type HonorActor} from './honor-workflow'
export type HonorCommand=HonorWorkflowCommand
export type HonorPort={verify:(token:string)=>Promise<boolean>;session:()=>Promise<HonorActor|null>;execute:(command:HonorCommand)=>Promise<{data:unknown;code?:string}>}
/** Legacy HTTP URL uses the same parser, live role/MFA gate and database command. */
export function handleHonorRequest(request:Request,env:Readonly<Record<string,string|undefined>>,factory:(token:string)=>HonorPort){
 return handleHonorWorkflow(request,env,token=>{const port=factory(token);return {...port,verify:()=>port.verify(token)}})
}
