"use client"

import { TrendingUp } from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis } from "recharts"

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

export const description = "A linear line chart"

const chartData = [
  { month: "January", desktop: 186 },
  { month: "February", desktop: 305 },
  { month: "March", desktop: 237 },
  { month: "April", desktop: 73 },
  { month: "May", desktop: 209 },
  { month: "June", desktop: 214 },
]

const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export default function ChartLineLinear() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-bold text-black"></h3>
        <p className="text-sm text-muted-foreground"></p>
      </div>
      <ChartContainer config={chartConfig}>
        <LineChart
          accessibilityLayer
          data={chartData}
          margin={{
            left: 12,
            right: 12,
          }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => value.slice(0, 3)}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <Line
            dataKey="desktop"
            type="linear"
            stroke="#000080"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ChartContainer>
      <div className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium mx-4 mb-2">
          Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none mx-4 mb-4">
          Showing total visitors for the last 6 months
        </div>
      </div>
    </div>
  )
}
