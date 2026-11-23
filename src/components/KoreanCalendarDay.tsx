'use client'
import {useUIText} from '@/components/LocaleProvider'
import type {DayButtonProps} from 'react-day-picker'
import {CalendarDayButton} from '@/components/ui/calendar'
import {holidayNames,koreanDayColor,seoulDateKey} from '@/lib/korean-holidays'
export function KoreanCalendarDay(props:DayButtonProps){
 const uiText=useUIText()
 const color=koreanDayColor(props.day.date),names=holidayNames(props.day.date)
 return <CalendarDayButton {...props} data-holiday={names.length?names.join(', '):undefined} data-date={seoulDateKey(props.day.date)} title={names.map(uiText).join(', ')||undefined} style={{...props.style,color,backgroundColor:color&&props.modifiers.selected?'#e0f2fe':props.style?.backgroundColor}}/>
}
