"use client"

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { CHART } from "@/lib/motion"

const chartConfig = {
  count: {
    label: "Sessions",
    color: "var(--metric-move)",
  },
} satisfies ChartConfig

/** Default daily goal band used as reference line — 1 session per day. */
const DAILY_GOAL = 1

export function HomeWeekChart({
  weekly,
  goalPerDay = DAILY_GOAL,
  isAnimationActive = true,
  animationDuration = CHART.barEnterMs,
}: {
  weekly: { day: string; count: number; active: boolean }[]
  goalPerDay?: number
  /** Set false after first enter (e.g. `useChartEnterOnce`) to avoid re-animating on data refresh. */
  isAnimationActive?: boolean
  animationDuration?: number
}) {
  const maxC = Math.max(1, goalPerDay, ...weekly.map((w) => w.count))
  const data = weekly.map((w) => ({
    name: w.day.charAt(0),
    full: w.day,
    count: w.count,
    active: w.active,
  }))

  return (
    <ChartContainer config={chartConfig} className="aspect-auto mx-auto h-[9.75rem] w-full">
      <BarChart accessibilityLayer data={data} margin={{ top: 4, right: 4, left: -4, bottom: 0 }}>
        <defs>
          {/* Vertical gradient on active bars — move token fading to primary at the cap. */}
          <linearGradient id="home-week-active" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--metric-move)" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" vertical={false} className="stroke-border/40" />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fontWeight: 700 }}
          interval={0}
        />
        <YAxis
          width={20}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 9 }}
          allowDecimals={false}
          domain={[0, maxC]}
        />
        <ReferenceLine
          y={goalPerDay}
          stroke="var(--metric-move)"
          strokeDasharray="3 3"
          strokeOpacity={0.5}
          ifOverflow="extendDomain"
        />
        <ChartTooltip
          cursor={{ fill: "color-mix(in oklch, var(--muted) 20%, transparent)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null
            const p = payload[0].payload as { full: string; count: number }
            return (
              <div className="rounded-xl border border-border/60 bg-background/95 px-2.5 py-1.5 text-xs shadow-lg backdrop-blur-md">
                <p className="font-semibold text-foreground">{p.full}</p>
                <p className="tabular-nums text-muted-foreground">{p.count} sessions</p>
              </div>
            )
          }}
        />
        <Bar
          dataKey="count"
          radius={[8, 8, 0, 0]}
          maxBarSize={36}
          isAnimationActive={isAnimationActive}
          animationDuration={animationDuration}
          animationEasing="ease-out"
        >
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={
                d.active
                  ? "url(#home-week-active)"
                  : "color-mix(in oklch, var(--muted-foreground) 14%, transparent)"
              }
              className="transition-[fill] duration-500"
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
