import { TrendingUp, Calendar, Flame, Dumbbell } from "lucide-react";
import { Card, CardHeader, CardTitle, CardValue, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VolumeChart } from "@/components/charts/volume-chart";
import { ProgressChart } from "@/components/charts/progress-chart";
import { mockStats, mockErgSessions, weeklyVolumeData, ergProgressData } from "@/lib/data/seed";
import { formatTime, formatDistance, formatRelativeDate, formatPace } from "@/lib/utils";

export default function AnalyticsPage() {
  const avgSplit = ergProgressData[ergProgressData.length - 1].split;

  return (
    <div className="py-6 flex flex-col gap-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-[#F1F5F9]">Analytics</h1>
        <p className="text-sm text-[#64748B] mt-1">Your training trends over time.</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardTitle>Total Sessions</CardTitle>
          <CardValue className="mt-2">{mockStats.total_sessions}</CardValue>
          <p className="text-xs text-[#64748B] mt-1">all time</p>
        </Card>
        <Card>
          <CardTitle>Current Streak</CardTitle>
          <div className="flex items-center gap-2 mt-2">
            <Flame size={20} className="text-[#F97316]" />
            <CardValue>{mockStats.current_streak}</CardValue>
          </div>
          <p className="text-xs text-[#64748B] mt-1">days in a row</p>
        </Card>
        <Card>
          <CardTitle>Avg Stroke Rate</CardTitle>
          <CardValue className="mt-2">{mockStats.avg_stroke_rate}</CardValue>
          <p className="text-xs text-[#64748B] mt-1">spm this month</p>
        </Card>
        <Card>
          <CardTitle>Best 2k Split</CardTitle>
          <CardValue className="mt-2 text-2xl">{formatPace(avgSplit)}</CardValue>
          <p className="text-xs text-[#10B981] mt-1">↓ 10s from 30 days ago</p>
        </Card>
      </div>

      {/* Weekly Volume */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Distance</CardTitle>
          <Badge variant="default">4 weeks</Badge>
        </CardHeader>
        <CardContent>
          <VolumeChart data={weeklyVolumeData} />
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: "This Week", value: `${(mockStats.weekly_distance_m / 1000).toFixed(1)}km` },
              { label: "Avg / Week", value: `${(weeklyVolumeData.reduce((s, d) => s + d.distance, 0) / weeklyVolumeData.length / 1000).toFixed(1)}km` },
              { label: "Total", value: `${(weeklyVolumeData.reduce((s, d) => s + d.distance, 0) / 1000).toFixed(0)}km` },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-base font-bold text-[#F1F5F9]">{s.value}</div>
                <div className="text-[10px] text-[#64748B]">{s.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Erg Progress */}
      <Card>
        <CardHeader>
          <CardTitle>2k Erg Split Progress</CardTitle>
          <Badge variant="success">↓ Improving</Badge>
        </CardHeader>
        <CardContent>
          <ProgressChart data={ergProgressData} label="2k Split" />
          <div className="mt-3 flex items-center gap-2 bg-[#10B981]/10 rounded-xl p-3">
            <TrendingUp size={16} className="text-[#10B981]" />
            <span className="text-xs text-[#10B981] font-semibold">
              10 seconds improvement over the last 2 months
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Erg Session Log */}
      <div>
        <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">Erg Session Log</h2>
        <div className="flex flex-col gap-3">
          {mockErgSessions.map((session) => (
            <div key={session.id} className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Dumbbell size={14} className="text-[#0EA5E9]" />
                  <span className="text-sm font-bold text-[#F1F5F9]">{formatDistance(session.distance_m)}</span>
                  <Badge variant="secondary" className="text-[10px]">{session.workout_type}</Badge>
                </div>
                <span className="text-xs text-[#64748B]">{formatRelativeDate(session.date)}</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Time", value: formatTime(session.duration_sec) },
                  { label: "Split", value: formatPace(session.split_sec) },
                  { label: "SPM", value: String(session.stroke_rate) },
                  { label: "RPE", value: `${session.rpe}/10` },
                ].map((s) => (
                  <div key={s.label} className="bg-[#111827] rounded-xl p-2 text-center">
                    <div className="text-xs font-bold text-[#F1F5F9]">{s.value}</div>
                    <div className="text-[9px] text-[#475569] mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
              {session.notes && (
                <p className="text-xs text-[#64748B] mt-2 leading-relaxed line-clamp-2">{session.notes}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Training Load */}
      <Card>
        <CardHeader>
          <CardTitle>Training Load</CardTitle>
          <Badge variant="warning">Moderate</Badge>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { label: "Erg Volume", value: 72, color: "#0EA5E9" },
              { label: "Water Volume", value: 45, color: "#06B6D4" },
              { label: "Dryland", value: 30, color: "#10B981" },
              { label: "Recovery Index", value: 68, color: "#F59E0B" },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#64748B]">{label}</span>
                  <span className="font-semibold text-[#94A3B8]">{value}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#1E293B]">
                  <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
