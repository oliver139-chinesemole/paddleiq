"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface VolumeChartProps {
  data: { week: string; distance: number }[];
}

export default function VolumeChartImpl({ data }: VolumeChartProps) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="distGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
        <XAxis dataKey="week" tick={{ fill: "#8A98AC", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#8A98AC", fontSize: 11 }} axisLine={false} tickLine={false}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          contentStyle={{ background: "#0D1528", border: "1px solid #1E293B", borderRadius: 8 }}
          labelStyle={{ color: "#94A3B8", fontSize: 12 }}
          itemStyle={{ color: "#F1F5F9", fontSize: 12 }}
          formatter={(v) => [`${(Number(v) / 1000).toFixed(1)}km`, "Distance"]}
        />
        <Area type="monotone" dataKey="distance" stroke="#0EA5E9" strokeWidth={2}
          fill="url(#distGrad)" dot={{ fill: "#0EA5E9", r: 3 }} activeDot={{ r: 5 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
