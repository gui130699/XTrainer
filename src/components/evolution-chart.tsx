"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface TrendPoint {
  date: string;
  value: number;
}

export function EvolutionChart({ data, unit = "", color = "#22d3ee" }: { data: TrendPoint[]; unit?: string; color?: string }) {
  return <ResponsiveContainer width="100%" height={270}><LineChart data={data}><XAxis dataKey="date"/><YAxis domain={["auto", "auto"]}/><Tooltip formatter={(value) => [`${Number(value).toLocaleString("pt-BR")}${unit}`, "Valor"]}/><Line type="monotone" dataKey="value" stroke={color} strokeWidth={3}/></LineChart></ResponsiveContainer>;
}
