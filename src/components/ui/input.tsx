import * as React from 'react'
import {cn} from '@/lib/utils'
export function Input({className,...props}:React.ComponentProps<'input'>){
 return <input className={cn('flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:cursor-not-allowed disabled:opacity-50',className)} {...props}/>
}
