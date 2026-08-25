"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, MapPin, Clock, Calendar, ChevronDown, ChevronUp, Check, X, HelpCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { EventType, RsvpStatus } from "@/lib/types";
import { toLocalDateStr } from "@/lib/utils";

// ── Demo data ─────────────────────────────────────────────────────────────────
const TODAY = "2026-06-05";
const DEMO_EVENTS = [
  { id: "e1", title: "Saturday Water Practice", event_date: "2026-06-07", event_time: "07:00", location: "Lake Windermere Boat Club", event_type: "practice"     as EventType, description: "Bring your own paddle. Focus on starts." },
  { id: "e2", title: "2k Erg Test",              event_date: "2026-06-10", event_time: "18:00", location: "Club Gym",                  event_type: "time_trial"  as EventType, description: "Full effort 2000m test. Rest the day before." },
  { id: "e3", title: "Regional Race",            event_date: "2026-06-15", event_time: "09:00", location: "Riverside Regatta Course",  event_type: "race"        as EventType, description: "500m open mixed. Line up by 8:30am." },
];
const DEMO_RSVPS: Record<string, { yes: number; no: number; maybe: number; leftYes: number; rightYes: number }> = {
  e1: { yes: 3, no: 1, maybe: 1, leftYes: 2, rightYes: 1 },
  e2: { yes: 4, no: 0, maybe: 1, leftYes: 2, rightYes: 2 },
  e3: { yes: 2, no: 2, maybe: 1, leftYes: 1, rightYes: 1 },
};

// ── Types ─────────────────────────────────────────────────────────────────────
type TeamEvent = {
  id: string;
  title: string;
  event_date: string;
  event_time?: string;
  location?: string;
  event_type: EventType;
  description?: string;
};

type RsvpSummary = { yes: number; no: number; maybe: number; leftYes: number; rightYes: number };

type Member = { user_id: string; paddle_side: string };

// ── Helpers ───────────────────────────────────────────────────────────────────
const EVENT_TYPE_LABEL: Record<EventType, string> = {
  practice: "Practice", race: "Race", time_trial: "Time Trial", tryout: "Tryout", social: "Social",
};
const EVENT_TYPE_COLOR: Record<EventType, string> = {
  practice: "#0EA5E9", race: "#EF4444", time_trial: "#F59E0B", tryout: "#A855F7", social: "#10B981",
};

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function fmtTime(t?: string) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")}${ampm}`;
}
function daysUntil(d: string) {
  const diff = Math.round((new Date(d + "T00:00:00").getTime() - new Date(TODAY + "T00:00:00").getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return `${Math.abs(diff)}d ago`;
  return `In ${diff} days`;
}

// ── Event card ────────────────────────────────────────────────────────────────
function EventCard({
  event, myRsvp, summary, isCoach,
  onRsvp, onDelete,
}: {
  event: TeamEvent;
  myRsvp?: RsvpStatus;
  summary?: RsvpSummary;
  isCoach: boolean;
  onRsvp: (status: RsvpStatus) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const accent = EVENT_TYPE_COLOR[event.event_type];
  const isPast = event.event_date < TODAY;

  return (
    <div className={`rounded-2xl border bg-[#0D1528] overflow-hidden ${isPast ? "opacity-60" : ""}`}
      style={{ borderColor: `${accent}30` }}>
      <button className="w-full p-4 text-left" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge className="text-[10px]" style={{ backgroundColor: `${accent}20`, color: accent }}>
                {EVENT_TYPE_LABEL[event.event_type]}
              </Badge>
              <span className="text-[10px] font-medium" style={{ color: accent }}>{daysUntil(event.event_date)}</span>
            </div>
            <div className="text-sm font-bold text-[#F1F5F9]">{event.title}</div>
            <div className="flex items-center gap-3 mt-1 text-xs text-[#64748B]">
              <span className="flex items-center gap-1"><Calendar size={11} />{fmtDate(event.event_date)}</span>
              {event.event_time && <span className="flex items-center gap-1"><Clock size={11} />{fmtTime(event.event_time)}</span>}
            </div>
          </div>
          {/* RSVP status pill */}
          {!isPast && myRsvp && (
            <div className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold ${
              myRsvp === "yes" ? "bg-[#10B981]/20 text-[#10B981]" :
              myRsvp === "no" ? "bg-[#EF4444]/20 text-[#EF4444]" :
              "bg-[#F59E0B]/20 text-[#F59E0B]"
            }`}>
              {myRsvp === "yes" ? "✓ Going" : myRsvp === "no" ? "✗ Can&apos;t go" : "? Maybe"}
            </div>
          )}
          {expanded ? <ChevronUp size={14} className="text-[#475569] shrink-0" /> : <ChevronDown size={14} className="text-[#475569] shrink-0" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[#1E293B]">
          {event.location && (
            <div className="flex items-center gap-1.5 mt-3 text-xs text-[#94A3B8]">
              <MapPin size={12} />{event.location}
            </div>
          )}
          {event.description && (
            <p className="text-xs text-[#64748B] mt-2 leading-relaxed">{event.description}</p>
          )}

          {/* RSVP buttons */}
          {!isPast && (
            <div className="mt-4">
              <p className="text-[10px] font-semibold text-[#475569] uppercase tracking-wider mb-2">Your RSVP</p>
              <div className="flex gap-2">
                {(["yes", "no", "maybe"] as RsvpStatus[]).map(s => (
                  <button
                    key={s}
                    onClick={() => onRsvp(s)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                      myRsvp === s
                        ? s === "yes" ? "bg-[#10B981]/20 border-[#10B981]/50 text-[#10B981]"
                        : s === "no"  ? "bg-[#EF4444]/20 border-[#EF4444]/50 text-[#EF4444]"
                        :               "bg-[#F59E0B]/20 border-[#F59E0B]/50 text-[#F59E0B]"
                        : "bg-[#111827] border-[#1E293B] text-[#64748B] hover:border-[#334155]"
                    }`}
                  >
                    {s === "yes" ? <Check size={12} /> : s === "no" ? <X size={12} /> : <HelpCircle size={12} />}
                    {s === "yes" ? "Going" : s === "no" ? "Can&apos;t go" : "Maybe"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Coach: RSVP summary */}
          {isCoach && summary && (
            <div className="mt-4 p-3 rounded-xl bg-[#111827] border border-[#1E293B]">
              <p className="text-[10px] font-semibold text-[#475569] uppercase tracking-wider mb-2">Attendance Summary</p>
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div>
                  <div className="text-base font-black text-[#10B981]">{summary.yes}</div>
                  <div className="text-[9px] text-[#64748B]">Going</div>
                </div>
                <div>
                  <div className="text-base font-black text-[#EF4444]">{summary.no}</div>
                  <div className="text-[9px] text-[#64748B]">Can&apos;t go</div>
                </div>
                <div>
                  <div className="text-base font-black text-[#F59E0B]">{summary.maybe}</div>
                  <div className="text-[9px] text-[#64748B]">Maybe</div>
                </div>
              </div>
              {summary.yes > 0 && (
                <div className="text-[11px] text-[#64748B]">
                  Confirmed side balance: <span className="text-[#0EA5E9] font-bold">{summary.leftYes}L</span> / <span className="text-[#06B6D4] font-bold">{summary.rightYes}R</span>
                  {summary.leftYes !== summary.rightYes && (
                    <span className="text-[#F59E0B]"> — {Math.abs(summary.leftYes - summary.rightYes)} imbalance</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Coach: delete */}
          {isCoach && !isPast && (
            <button
              onClick={onDelete}
              className="mt-3 text-xs text-[#EF4444]/60 hover:text-[#EF4444] transition-colors"
            >
              Cancel event
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Create event form ─────────────────────────────────────────────────────────
function CreateEventForm({ onSave, onCancel }: { onSave: (f: Omit<TeamEvent, "id">) => Promise<void>; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: "", date: "", time: "", location: "", type: "practice" as EventType, notes: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.date) return;
    setBusy(true);
    await onSave({ title: form.title, event_date: form.date, event_time: form.time || undefined, location: form.location || undefined, event_type: form.type, description: form.notes || undefined });
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-4 flex flex-col gap-3">
      <h3 className="text-sm font-bold text-[#F1F5F9]">Schedule an Event</h3>
      <Input label="Title" placeholder="Saturday Water Practice" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Date" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
        <Input label="Time (optional)" type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
      </div>
      <Input label="Location (optional)" placeholder="Boat Club / Gym" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
      <div>
        <label className="block text-xs text-[#64748B] font-medium mb-1.5">Event Type</label>
        <div className="flex gap-2 flex-wrap">
          {(["practice","race","time_trial","tryout","social"] as EventType[]).map(t => (
            <button key={t} type="button" onClick={() => setForm({ ...form, type: t })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${form.type === t ? "bg-[#0EA5E9]/20 border-[#0EA5E9]/50 text-[#0EA5E9]" : "border-[#1E293B] text-[#475569] hover:border-[#334155]"}`}>
              {EVENT_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
      <Input label="Notes (optional)" placeholder="Bring your own paddle." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
      <div className="flex gap-2 mt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy} className="flex-1">Cancel</Button>
        <Button type="submit" disabled={busy || !form.title || !form.date} className="flex-1">
          {busy ? <Loader2 size={14} className="animate-spin" /> : "Schedule"}
        </Button>
      </div>
    </form>
  );
}

// ── ScheduleTab ───────────────────────────────────────────────────────────────
export default function ScheduleTab({
  teamId, userId, isCoach, isDemoMode, members,
}: {
  teamId: string;
  userId: string;
  isCoach: boolean;
  isDemoMode: boolean;
  members: Member[];
}) {
  const [events, setEvents] = useState<TeamEvent[]>(isDemoMode ? DEMO_EVENTS as TeamEvent[] : []);
  const [summaries, setSummaries] = useState<Record<string, RsvpSummary>>(isDemoMode ? DEMO_RSVPS : {});
  const [myRsvps, setMyRsvps] = useState<Record<string, RsvpStatus>>(isDemoMode ? { e1: "yes" } : {});
  const [loading, setLoading] = useState(!isDemoMode);
  const [showCreate, setShowCreate] = useState(false);

  const loadSchedule = useCallback(async () => {
    if (isDemoMode) return;
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const sb = createClient();

      const { data: evtsData } = await sb
        .from("team_events")
        .select("id, title, event_date, event_time, location, event_type, description")
        .eq("team_id", teamId)
        .gte("event_date", toLocalDateStr(new Date(Date.now() - 30 * 86400000)))
        .order("event_date", { ascending: true });
      setEvents((evtsData ?? []) as TeamEvent[]);

      type EvtRow = { id: string };
      type RsvpMineRow = { event_id: string; status: string };
      type RsvpAllRow = { event_id: string; user_id: string; status: string };
      const eventIds = ((evtsData ?? []) as EvtRow[]).map((e: EvtRow) => e.id);
      if (eventIds.length === 0) return;

      // Load own RSVPs
      const { data: mine } = await sb.from("event_rsvp").select("event_id, status").eq("user_id", userId).in("event_id", eventIds);
      const myMap: Record<string, RsvpStatus> = {};
      ((mine ?? []) as RsvpMineRow[]).forEach((r: RsvpMineRow) => { myMap[r.event_id] = r.status as RsvpStatus; });
      setMyRsvps(myMap);

      // Coach: load all RSVPs and compute side balance
      if (isCoach) {
        const { data: all } = await sb.from("event_rsvp").select("event_id, user_id, status").in("event_id", eventIds);
        const smap: Record<string, RsvpSummary> = {};
        eventIds.forEach((id: string) => { smap[id] = { yes: 0, no: 0, maybe: 0, leftYes: 0, rightYes: 0 }; });
        ((all ?? []) as RsvpAllRow[]).forEach((r: RsvpAllRow) => {
          const s = smap[r.event_id];
          if (!s) return;
          s[r.status as RsvpStatus]++;
          if (r.status === "yes") {
            const m = members.find(m => m.user_id === r.user_id);
            if (m?.paddle_side === "left") s.leftYes++;
            else if (m?.paddle_side === "right") s.rightYes++;
          }
        });
        setSummaries(smap);
      }
    } finally {
      setLoading(false);
    }
  }, [teamId, userId, isCoach, isDemoMode, members]);

  useEffect(() => { loadSchedule(); }, [loadSchedule]);

  async function handleRsvp(eventId: string, status: RsvpStatus) {
    if (isDemoMode) {
      setMyRsvps(prev => ({ ...prev, [eventId]: status }));
      toast.success("RSVP updated (demo mode)");
      return;
    }
    const { createClient } = await import("@/lib/supabase/client");
    const sb = createClient();
    await sb.from("event_rsvp").upsert({ event_id: eventId, user_id: userId, status, updated_at: new Date().toISOString() }, { onConflict: "event_id,user_id" });
    setMyRsvps(prev => ({ ...prev, [eventId]: status }));
    await loadSchedule();
    toast.success("RSVP updated");
  }

  async function handleCreate(form: Omit<TeamEvent, "id">) {
    if (isDemoMode) {
      const newEvt: TeamEvent = { ...form, id: `demo-${Date.now()}` };
      setEvents(prev => [...prev, newEvt].sort((a, b) => a.event_date.localeCompare(b.event_date)));
      setShowCreate(false);
      toast.success("Event scheduled (demo mode)");
      return;
    }
    const { createClient } = await import("@/lib/supabase/client");
    const sb = createClient();
    await sb.from("team_events").insert({ team_id: teamId, created_by: userId, ...form });
    setShowCreate(false);
    await loadSchedule();
    toast.success("Event scheduled!");
  }

  async function handleDelete(eventId: string) {
    if (isDemoMode) {
      setEvents(prev => prev.filter(e => e.id !== eventId));
      return;
    }
    const { createClient } = await import("@/lib/supabase/client");
    const sb = createClient();
    await sb.from("team_events").delete().eq("id", eventId);
    await loadSchedule();
    toast.success("Event cancelled");
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 size={24} className="text-[#0EA5E9] animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {isCoach && !showCreate && (
        <Button onClick={() => setShowCreate(true)} className="w-full gap-2">
          <Plus size={16} /> Schedule Practice / Event
        </Button>
      )}
      {showCreate && <CreateEventForm onSave={handleCreate} onCancel={() => setShowCreate(false)} />}

      {events.length === 0 && !showCreate && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Calendar size={32} className="text-[#334155]" />
          <p className="text-sm text-[#475569]">
            {isCoach ? "No events scheduled yet. Create one above." : "No upcoming events. Check back soon!"}
          </p>
        </div>
      )}

      {events.map(evt => (
        <EventCard
          key={evt.id}
          event={evt}
          myRsvp={myRsvps[evt.id]}
          summary={isCoach ? summaries[evt.id] : undefined}
          isCoach={isCoach}
          onRsvp={status => handleRsvp(evt.id, status)}
          onDelete={() => handleDelete(evt.id)}
        />
      ))}
    </div>
  );
}
