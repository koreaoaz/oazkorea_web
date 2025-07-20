"use client"

import * as React from "react"

import { Calendar } from "@/components/ui/calendar"

export default function Calendar01() {
  const [date, setDate] = React.useState<Date | undefined>(
    new Date(2025, 5, 12)
  )

  return (
    <div className="w-full h-auto flex justify-center items-center overflow-hidden">
      <Calendar
        mode="single"
        defaultMonth={date}
        selected={date}
        onSelect={setDate}
        className="-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg"
      />
    </div>
    
  )
}
