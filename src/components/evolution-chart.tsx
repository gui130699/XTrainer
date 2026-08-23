"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface TrendPoint {
  date: string;
  value: number;
}

function ChartTooltip({ active, payload, unit }: { active?: boolean; payload?: { value?: number }[]; unit: string }) {
  if (!active || !payload?.length || payload[0]?.value == null) return null;
  return <div className="chart-tooltip"><strong>{Number(payload[0].value).toLocaleString("pt-BR")}{unit}</strong></div>;
}

export function EvolutionChart({ data, unit = "", color = "#22d3ee" }: { data: TrendPoint[]; unit?: string; color?: string }) {
  return <ResponsiveContainer width="100%" height={280}>
    <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
      <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false}/>
      <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false}/>
      <YAxis domain={["auto", "auto"]} tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={44}/>
      <Tooltip content={<ChartTooltip unit={unit}/>} cursor={{ stroke: "var(--border-strong)", strokeDasharray: "3 5" }}/>
      <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color, strokeWidth: 0 }} activeDot={{ r: 5 }}/>
    </LineChart>
  </ResponsiveContainer>;
}
