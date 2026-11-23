'use client'
import Link from 'next/link'
import type {ComponentProps} from 'react'
import {useUIText} from './LocaleProvider'
/** Translate navigation labels while preserving the original destination and children. */
export default function LocalizedLink(props:ComponentProps<typeof Link>){
 const text=useUIText()
 return <Link {...props} aria-label={props['aria-label']?text(props['aria-label']):undefined} title={props.title?text(props.title):undefined}/>
}
