"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface ProgressChartProps {
  data: { date: string; split: number }[];
  color?: string;
  label?: string;
  invertY?: boolean;
}

export default function ProgressChartImpl({ data, color = "#0EA5E9", label = "Split", invertY = true }: ProgressChartProps) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
        <XAxis dataKey="date" tick={{ fill: "#8A98AC", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fill: "#8A98AC", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          reversed={invertY}
          tickFormatter={(v) => `${v}s`}
        />
        <Tooltip
          contentStyle={{ background: "#0D1528", border: "1px solid #1E293B", borderRadius: 8 }}
          labelStyle={{ color: "#94A3B8", fontSize: 12 }}
          itemStyle={{ color: "#F1F5F9", fontSize: 12 }}
          formatter={(v) => [`${v}s/500m`, label]}
        />
        <Line
          type="monotone"
          dataKey="split"
          stroke={color}
          strokeWidth={2.5}
          dot={{ fill: color, r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
