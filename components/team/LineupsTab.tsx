"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable, useDraggable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Save, Loader2, ChevronDown, Trash2, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { SeatAssignment, PerformanceRole } from "@/lib/types";
import {
  analyzeBalance, autoBalance, describeSide, describeTrim, type BalanceGrade,
} from "@/lib/lineup/balance";

// ── Types ─────────────────────────────────────────────────────────────────────
type MemberSummary = {
  user_id: string;
  full_name: string;
  paddle_side: string;
  weight_kg?: number | null;
  performance_role?: PerformanceRole | null;
};

type SavedLineup = {
  id: string;
  name: string;
  boat_size: number;
  assignments: SeatAssignment[];
};

// Slot IDs: "seat-N-left", "seat-N-right", "seat-drummer", "seat-steerer", "pool"
function slotId(seat: number | "drummer" | "steerer", side?: "left" | "right") {
  if (seat === "drummer" || seat === "steerer") return `seat-${seat}`;
  return `seat-${seat}-${side}`;
}
function parseSlot(id: string): { seat: number | "drummer" | "steerer"; side?: "left" | "right" } | null {
  if (!id.startsWith("seat-")) return null;
  const rest = id.slice(5);
  if (rest === "drummer") return { seat: "drummer" };
  if (rest === "steerer") return { seat: "steerer" };
  const parts = rest.split("-");
  return { seat: parseInt(parts[0]), side: parts[1] as "left" | "right" };
}

// ── Draggable athlete chip ────────────────────────────────────────────────────
function AthleteChip({ member, selected, onClick }: {
  member: MemberSummary; selected: boolean; onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `athlete-${member.user_id}` });
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 };

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold whitespace-nowrap transition-all touch-manipulation ${
        selected
          ? "border-[#0EA5E9] bg-[#0EA5E9]/20 text-[#0EA5E9]"
          : "border-[#1E293B] bg-[#0D1528] text-[#94A3B8] hover:border-[#334155]"
      }`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${member.paddle_side === "left" ? "bg-[#0EA5E9]" : member.paddle_side === "right" ? "bg-[#06B6D4]" : "bg-[#F59E0B]"}`} />
      {member.full_name.split(" ")[0]}
      {member.weight_kg ? <span className="text-[9px] text-[#475569]">{member.weight_kg}kg</span> : null}
    </button>
  );
}

// ── Seat slot ─────────────────────────────────────────────────────────────────
function SeatSlot({ seat, side, occupant, selected, onTap }: {
  seat: number | "drummer" | "steerer";
  side?: "left" | "right";
  occupant?: MemberSummary;
  selected?: boolean;
  onTap: () => void;
}) {
  const id = slotId(seat, side);
  const { setNodeRef, isOver } = useDroppable({ id });
  const isSpecial = seat === "drummer" || seat === "steerer";

  return (
    <button
      ref={setNodeRef}
      onClick={onTap}
      className={`flex flex-col items-center justify-center min-h-[52px] rounded-xl border text-center transition-all touch-manipulation w-full ${
        isOver
          ? "border-[#0EA5E9] bg-[#0EA5E9]/20"
          : isSpecial
          ? "border-[#F59E0B]/30 bg-[#F59E0B]/5"
          : side === "left"
          ? "border-[#0EA5E9]/20 bg-[#0EA5E9]/5"
          : "border-[#06B6D4]/20 bg-[#06B6D4]/5"
      } ${selected ? "ring-2 ring-[#0EA5E9]" : ""}`}
    >
      {occupant ? (
        <>
          <span className="text-[11px] font-bold text-[#F1F5F9] leading-tight px-1">
            {occupant.full_name.split(" ")[0]}
          </span>
          <span className={`text-[9px] mt-0.5 ${
            occupant.paddle_side === "left" ? "text-[#0EA5E9]" :
            occupant.paddle_side === "right" ? "text-[#06B6D4]" : "text-[#F59E0B]"
          }`}>
            {occupant.paddle_side === "left" ? "L" : occupant.paddle_side === "right" ? "R" : "B"}
            {occupant.weight_kg ? ` · ${occupant.weight_kg}kg` : ""}
          </span>
        </>
      ) : (
        <span className="text-[10px] text-[#334155]">
          {isSpecial ? (seat === "drummer" ? "🥁" : "⚓") : `${seat}${side === "left" ? "L" : "R"}`}
        </span>
      )}
    </button>
  );
}

// ── Balance panel ─────────────────────────────────────────────────────────────

const GRADE_COLOR: Record<BalanceGrade, string> = {
  good: "#22C55E",
  ok: "#F59E0B",
  poor: "#EF4444",
};

/** Weight difference rendered as a bar leaning away from centre. */
function TrimRow({
  label, diffKg, grade, detail, leftTag, rightTag,
}: {
  label: string;
  diffKg: number;
  grade: BalanceGrade;
  detail: string;
  leftTag: string;
  rightTag: string;
}) {
  // 25kg of difference fills half the bar; beyond that it pins.
  const pct = Math.min(Math.abs(diffKg) / 25, 1) * 50;
  const leansFirst = diffKg > 0;

  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-1">
        <span className="font-bold text-[#64748B] uppercase tracking-wide">{label}</span>
        <span className="font-bold tabular-nums" style={{ color: GRADE_COLOR[grade] }}>
          {Math.abs(diffKg) < 0.5 ? "even" : `${Math.abs(diffKg).toFixed(1)}kg`}
        </span>
      </div>
      <div className="relative h-2.5 rounded-full bg-[#0B1220] overflow-hidden">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#334155]" />
        <div
          className="absolute top-0 bottom-0 rounded-full transition-all"
          style={{
            backgroundColor: GRADE_COLOR[grade],
            left: leansFirst ? `${50 - pct}%` : "50%",
            width: `${Math.max(pct, 1)}%`,
          }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] mt-1 text-[#475569]">
        <span>{leftTag}</span>
        <span className="text-[#64748B]">{detail}</span>
        <span>{rightTag}</span>
      </div>
    </div>
  );
}

function BalancePanel({
  assignments, members, boatSize,
}: {
  assignments: SeatAssignment[];
  members: MemberSummary[];
  boatSize: number;
}) {
  const report = analyzeBalance(assignments, members, boatSize);

  return (
    <div className="rounded-xl bg-[#111827] border border-[#1E293B] p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-[#0EA5E9]">
          {report.leftCount}L · {report.leftWeightKg.toFixed(0)}kg
        </span>
        <span className="text-[#475569]">
          {report.seatedCount} / {members.length} placed
        </span>
        <span className="font-bold text-[#06B6D4]">
          {report.rightWeightKg.toFixed(0)}kg · {report.rightCount}R
        </span>
      </div>

      <TrimRow
        label="Side balance"
        diffKg={report.sideDiffKg}
        grade={report.sideGrade}
        detail={describeSide(report)}
        leftTag="left"
        rightTag="right"
      />

      <TrimRow
        label="Bow / stern trim"
        diffKg={report.trimDiffKg}
        grade={report.trimGrade}
        detail={describeTrim(report)}
        leftTag="bow"
        rightTag="stern"
      />

      {(report.offSide.length > 0 || report.missingWeight.length > 0) && (
        <div className="flex flex-col gap-1 pt-1 border-t border-[#1E293B]">
          {report.offSide.length > 0 && (
            <div className="text-[10px] text-[#FBBF24]">
              {report.offSide.length} on their off side: {report.offSide.map(m => m.full_name).join(", ")}
            </div>
          )}
          {report.missingWeight.length > 0 && (
            <div className="text-[10px] text-[#64748B]">
              No weight recorded for {report.missingWeight.map(m => m.full_name).join(", ")} — balance
              figures exclude them.
            </div>
          )}
        </div>
      )}

      <div className="text-[10px] text-[#475569]">
        {report.totalWeightKg.toFixed(0)} kg of paddlers aboard
      </div>
    </div>
  );
}

// ── LineupsTab ────────────────────────────────────────────────────────────────
export default function LineupsTab({
  teamId, userId, isCoach, isDemoMode, members,
}: {
  teamId: string;
  userId: string;
  isCoach: boolean;
  isDemoMode: boolean;
  members: MemberSummary[];
}) {
  const [assignments, setAssignments] = useState<SeatAssignment[]>([]);
  const [boatSize, setBoatSize] = useState(20);
  const [customSize, setCustomSize] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [lineupName, setLineupName] = useState("Race Boat");
  const [savedLineups, setSavedLineups] = useState<SavedLineup[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string | null>(null); // user_id of selected athlete
  const [activeId, setActiveId] = useState<string | null>(null); // drag overlay

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const loadSaved = useCallback(async () => {
    if (isDemoMode || !isCoach) return;
    const { createClient } = await import("@/lib/supabase/client");
    const sb = createClient();
    const { data } = await sb.from("team_lineups").select("id, name, boat_size, assignments").eq("team_id", teamId).order("updated_at", { ascending: false }).limit(20);
    setSavedLineups((data ?? []) as SavedLineup[]);
  }, [teamId, isDemoMode, isCoach]);

  useEffect(() => { void (async () => { await loadSaved(); })(); }, [loadSaved]);

  // ── DnD ──────────────────────────────────────────────────────────────────
  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const athleteId = String(active.id).replace("athlete-", "");
    if (over.id === "pool") {
      // Dropped back to pool — remove from boat
      setAssignments(prev => prev.filter(a => a.user_id !== athleteId));
      return;
    }
    const target = parseSlot(String(over.id));
    if (!target) return;
    const member = members.find(m => m.user_id === athleteId);
    if (!member) return;
    assignToSlot(athleteId, target.seat, target.side);
  }

  // ── Tap-to-place ──────────────────────────────────────────────────────────
  function handleAthleteClick(userId: string) {
    setSelected(prev => prev === userId ? null : userId);
  }

  function handleSlotTap(seat: number | "drummer" | "steerer", side?: "left" | "right") {
    const occupant = assignments.find(a =>
      typeof seat === "string" ? a.side === seat : a.seat === seat && a.side === side
    );

    if (selected) {
      if (occupant?.user_id === selected) {
        // Tapping the seat of the paddler you just picked takes them out.
        // Without this there was no way to remove one athlete — clearSeat
        // existed but nothing called it, so the only option was Clear all.
        clearSeat(seat, side);
      } else {
        assignToSlot(selected, seat, side);
      }
      setSelected(null);
    } else if (occupant?.user_id) {
      // Select the occupant (to move them)
      setSelected(occupant.user_id);
    }
  }

  function assignToSlot(userId: string, seat: number | "drummer" | "steerer", side?: "left" | "right") {
    const member = members.find(m => m.user_id === userId);
    if (!member) return;
    setAssignments(prev => {
      // Remove athlete from wherever they currently are
      const without = prev.filter(a => a.user_id !== userId);
      // Remove whoever is currently in the target slot
      const withoutTarget = without.filter(a =>
        typeof seat === "string" ? a.side !== seat : !(a.seat === seat && a.side === side)
      );
      return [...withoutTarget, {
        seat,
        side: typeof seat === "string" ? seat as "drummer" | "steerer" : side!,
        user_id: userId,
        name: member.full_name,
      } as SeatAssignment];
    });
  }

  function clearSeat(seat: number | "drummer" | "steerer", side?: "left" | "right") {
    setAssignments(prev => prev.filter(a =>
      typeof seat === "string" ? a.side !== seat : !(a.seat === seat && a.side === side)
    ));
    setSelected(null);
  }

  const effectiveSize = showCustom && customSize ? Math.max(4, Math.min(40, parseInt(customSize) || 20)) : boatSize;
  const rows = Math.floor(effectiveSize / 2);

  function getOccupant(seat: number | "drummer" | "steerer", side?: "left" | "right") {
    const a = assignments.find(a =>
      typeof seat === "string" ? a.side === seat : a.seat === seat && a.side === side
    );
    return a?.user_id ? members.find(m => m.user_id === a.user_id) : undefined;
  }

  const assignedIds = new Set(assignments.map(a => a.user_id).filter(Boolean));
  const pool = members.filter(m => !assignedIds.has(m.user_id));
  const activeAthlete = activeId ? members.find(m => m.user_id === activeId.replace("athlete-", "")) : null;

  async function saveLineup() {
    if (isDemoMode) { toast.success("Lineup saved (demo mode)"); return; }
    setSaving(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const sb = createClient();
      await sb.from("team_lineups").insert({
        team_id: teamId, name: lineupName, boat_size: effectiveSize,
        assignments, created_by: userId,
      });
      await loadSaved();
      toast.success(`"${lineupName}" saved!`);
    } finally {
      setSaving(false);
    }
  }

  function loadLineup(l: SavedLineup) {
    setBoatSize(l.boat_size);
    setAssignments(l.assignments);
    setLineupName(l.name);
    setShowSaved(false);
  }

  function handleAutoBalance() {
    // Keep whoever the coach has already put in the specialist seats — those
    // are picked on skill, not weight, so the optimiser shouldn't reshuffle them.
    const drummerId = assignments.find(a => a.seat === "drummer")?.user_id;
    const steererId = assignments.find(a => a.seat === "steerer")?.user_id;

    const { assignments: next, unseated, movedOffSide } = autoBalance(members, effectiveSize, {
      drummer: members.find(m => m.user_id === drummerId),
      steerer: members.find(m => m.user_id === steererId),
    });

    setAssignments(next);
    setSelected(null);

    const report = analyzeBalance(next, members, effectiveSize);
    const notes = [describeSide(report)];
    if (movedOffSide.length) notes.push(`${movedOffSide.length} moved off their usual side`);
    if (unseated.length) notes.push(`${unseated.length} left in the pool`);
    toast.success("Boat balanced", { description: notes.join(" · ") });
  }

  async function deleteLineup(id: string) {
    if (isDemoMode) return;
    const { createClient } = await import("@/lib/supabase/client");
    const sb = createClient();
    await sb.from("team_lineups").delete().eq("id", id);
    setSavedLineups(prev => prev.filter(l => l.id !== id));
    toast.success("Lineup deleted");
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex flex-col gap-4">
        {/* Name + save/load row */}
        <div className="flex gap-2">
          <Input
            className="flex-1"
            value={lineupName}
            onChange={e => setLineupName(e.target.value)}
            placeholder="Lineup name"
          />
          <Button onClick={saveLineup} disabled={saving} className="shrink-0 gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </Button>
          {(savedLineups.length > 0 || isDemoMode) && (
            <Button variant="outline" onClick={() => setShowSaved(!showSaved)} className="shrink-0 gap-1">
              Load <ChevronDown size={12} />
            </Button>
          )}
        </div>

        {/* Saved lineups dropdown */}
        {showSaved && (
          <div className="rounded-xl border border-[#1E293B] bg-[#0D1528] overflow-hidden">
            {savedLineups.map(l => (
              <div key={l.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#1E293B] last:border-0">
                <button className="flex-1 text-left" onClick={() => loadLineup(l)}>
                  <div className="text-sm font-semibold text-[#F1F5F9]">{l.name}</div>
                  <div className="text-[10px] text-[#475569]">{l.boat_size}-seat · {l.assignments.filter(a => a.user_id).length} assigned</div>
                </button>
                <button onClick={() => deleteLineup(l.id)} className="text-[#EF4444]/50 hover:text-[#EF4444]">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Boat size selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[#64748B] font-semibold shrink-0">Boat size:</span>
          {[10, 20].map(s => (
            <button
              key={s}
              onClick={() => { setBoatSize(s); setShowCustom(false); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                !showCustom && boatSize === s ? "border-[#0EA5E9]/50 bg-[#0EA5E9]/20 text-[#0EA5E9]" : "border-[#1E293B] text-[#475569] hover:border-[#334155]"
              }`}
            >
              {s} seats
            </button>
          ))}
          <button
            onClick={() => setShowCustom(!showCustom)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              showCustom ? "border-[#0EA5E9]/50 bg-[#0EA5E9]/20 text-[#0EA5E9]" : "border-[#1E293B] text-[#475569] hover:border-[#334155]"
            }`}
          >
            Custom
          </button>
          {showCustom && (
            <input
              type="number" min={4} max={40} step={2}
              value={customSize}
              onChange={e => setCustomSize(e.target.value)}
              placeholder="e.g. 22"
              className="w-20 bg-[#0D1528] border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-[#F1F5F9] outline-none focus:border-[#0EA5E9]"
            />
          )}
        </div>

        {/* Balance + auto-fill */}
        <BalancePanel assignments={assignments} members={members} boatSize={effectiveSize} />

        {isCoach && members.length > 0 && (
          <button
            onClick={handleAutoBalance}
            className="flex items-center justify-center gap-2 w-full rounded-xl border border-[#0EA5E9]/30 bg-[#0EA5E9]/10 hover:bg-[#0EA5E9]/20 text-[#0EA5E9] text-xs font-bold py-3 transition-colors"
          >
            <Scale size={15} />
            Auto-balance the boat
          </button>
        )}

        {/* Instruction */}
        {selected ? (
          <div className="text-xs text-[#0EA5E9] bg-[#0EA5E9]/10 rounded-xl p-3 text-center">
            <strong>{members.find(m => m.user_id === selected)?.full_name.split(" ")[0]}</strong> selected — tap a seat to place, or tap again to deselect
          </div>
        ) : (
          <div className="text-xs text-[#475569] text-center">
            Tap an athlete to select, then tap a seat — or drag directly on desktop
          </div>
        )}

        {/* ── Boat diagram ─────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] overflow-hidden">
          {/* Bow / Drummer */}
          <div className="bg-[#F59E0B]/10 border-b border-[#1E293B] px-3 pt-3 pb-2">
            <div className="text-[9px] text-center text-[#475569] uppercase tracking-widest mb-1.5">Bow — Front of Boat</div>
            <SeatSlot
              seat="drummer" side={undefined}
              occupant={getOccupant("drummer")}
              selected={selected === getOccupant("drummer")?.user_id}
              onTap={() => handleSlotTap("drummer")}
            />
          </div>

          {/* Paddler rows */}
          <div className="px-3 py-2 flex flex-col gap-1.5">
            <div className="grid grid-cols-2 gap-1.5 mb-0.5">
              <div className="text-[9px] text-[#0EA5E9] text-center font-bold uppercase tracking-wider">Left</div>
              <div className="text-[9px] text-[#06B6D4] text-center font-bold uppercase tracking-wider">Right</div>
            </div>
            {Array.from({ length: rows }, (_, i) => {
              const leftSeat  = i * 2 + 1;
              const rightSeat = i * 2 + 2;
              return (
                <div key={i} className="grid grid-cols-2 gap-1.5">
                  <SeatSlot
                    seat={leftSeat} side="left"
                    occupant={getOccupant(leftSeat, "left")}
                    selected={selected === getOccupant(leftSeat, "left")?.user_id}
                    onTap={() => handleSlotTap(leftSeat, "left")}
                  />
                  <SeatSlot
                    seat={rightSeat} side="right"
                    occupant={getOccupant(rightSeat, "right")}
                    selected={selected === getOccupant(rightSeat, "right")?.user_id}
                    onTap={() => handleSlotTap(rightSeat, "right")}
                  />
                </div>
              );
            })}
          </div>

          {/* Stern / Steerer */}
          <div className="bg-[#F59E0B]/10 border-t border-[#1E293B] px-3 pb-3 pt-2">
            <SeatSlot
              seat="steerer" side={undefined}
              occupant={getOccupant("steerer")}
              selected={selected === getOccupant("steerer")?.user_id}
              onTap={() => handleSlotTap("steerer")}
            />
            <div className="text-[9px] text-center text-[#475569] uppercase tracking-widest mt-1.5">Stern — Back of Boat</div>
          </div>
        </div>

        {/* ── Athlete pool ─────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Unassigned ({pool.length})</span>
            {assignments.length > 0 && (
              <button
                onClick={() => { setAssignments([]); setSelected(null); }}
                className="text-xs text-[#EF4444]/60 hover:text-[#EF4444]"
              >
                Clear all
              </button>
            )}
          </div>
          <div
            id="pool"
            className="flex gap-2 flex-wrap p-3 rounded-xl border border-dashed border-[#334155] min-h-[52px]"
          >
            {pool.length === 0 ? (
              <span className="text-xs text-[#334155] self-center">All athletes placed!</span>
            ) : pool.map(m => (
              <AthleteChip
                key={m.user_id}
                member={m}
                selected={selected === m.user_id}
                onClick={() => handleAthleteClick(m.user_id)}
              />
            ))}
          </div>
        </div>

        {/* DragOverlay — shows what's being dragged */}
        <DragOverlay>
          {activeAthlete && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#0EA5E9] bg-[#0EA5E9]/20 text-[#0EA5E9] text-xs font-semibold shadow-lg">
              {activeAthlete.full_name.split(" ")[0]}
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
