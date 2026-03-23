"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { B } from "@/lib/constants";

// ── Colour helpers ────────────────────────────────────────────────────────────
const FLAG_HARD = { bg: "#fee2e2", border: "#fca5a5", text: "#991b1b", badge: "#ef4444" };
const FLAG_SOFT = { bg: "#fef3c7", border: "#fcd34d", text: "#92400e", badge: "#f59e0b" };
const FLAG_OK   = { bg: "#f0fdf4", border: "#86efac", text: "#166534", badge: "#22c55e" };

// ── Shift type colours (matches existing rota tab feel) ───────────────────────
const SHIFT_COLOURS = {
  teaching:  { bg: "#dbeafe", text: "#1e40af" },
  activity:  { bg: "#d1fae5", text: "#065f46" },
  overnight: { bg: "#ede9fe", text: "#5b21b6" },
  transfer:  { bg: "#fef3c7", text: "#92400e" },
  cover:     { bg: "#e0f2fe", text: "#0369a1" },
  duty:      { bg: "#fce7f3", text: "#9d174d" },
};

// ── Standard UKLC shift template for one day ─────────────────────────────────
// Used by "Apply Standard Template" button. Times match typical UKLC timetable.
// Base shifts applied to every centre
const STANDARD_SHIFTS = [
  { shift_type: "teaching",  role_required: "ANY_TEACHING",  start_time: "09:00", end_time: "12:30", min_staff: 1, session_count: 1 },
  { shift_type: "teaching",  role_required: "ANY_TEACHING",  start_time: "14:00", end_time: "17:30", min_staff: 1, session_count: 1 },
  { shift_type: "activity",  role_required: "ANY_ACTIVITY",  start_time: "09:00", end_time: "12:30", min_staff: 1, session_count: 0 },
  { shift_type: "activity",  role_required: "ANY_ACTIVITY",  start_time: "14:00", end_time: "17:30", min_staff: 1, session_count: 0 },
  { shift_type: "duty",      role_required: "ANY_ACTIVITY",  start_time: "19:00", end_time: "22:00", min_staff: 2, session_count: 0 },
];

// Overnight shift — only added if the centre has HP staff
const OVERNIGHT_SHIFT =
  { shift_type: "overnight", role_required: "HP", start_time: "22:00", end_time: "08:00", min_staff: 1, session_count: 0 };

// ── Date helpers ──────────────────────────────────────────────────────────────
function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function datesBetween(start, end) {
  const dates = [];
  let cur = start;
  while (cur <= end) { dates.push(cur); cur = addDays(cur, 1); }
  return dates;
}
function fmtDate(ds) {
  return new Date(ds + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", weekday: "short" });
}
function genId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ── Step indicator ────────────────────────────────────────────────────────────
function Steps({ current }) {
  const steps = ["Programme", "Shifts", "Generate", "Review"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 20 }}>
      {steps.map((s, i) => {
        const done    = i < current;
        const active  = i === current;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", display: "flex",
                alignItems: "center", justifyContent: "center", fontWeight: 800,
                fontSize: 12, fontFamily: "'Raleway', sans-serif",
                background: done ? B.navy : active ? B.red : B.border,
                color: done || active ? "#fff" : B.textMuted,
              }}>
                {done ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: active ? B.navy : B.textMuted, fontFamily: "'Raleway', sans-serif", whiteSpace: "nowrap" }}>{s}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 60, height: 2, background: done ? B.navy : B.border, margin: "0 4px", marginBottom: 16 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AiRotaTab({ centreId, centreName, staff, groups, progStart, progEnd, readOnly }) {
  const [step, setStep]                 = useState(0);
  const [programmes, setProgrammes]     = useState([]);
  const [selectedProg, setSelectedProg] = useState(null);
  const [shifts, setShifts]             = useState([]);
  const [solveResult, setSolveResult]   = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [generating, setGenerating]     = useState(false);
  const [publishing, setPublishing]     = useState(false);
  const [published, setPublished]       = useState(false);

  // New programme form
  const [newProgForm, setNewProgForm] = useState({ turn_number: 1, start_date: progStart, end_date: progEnd });
  const [showNewProg, setShowNewProg] = useState(false);

  // Load programmes for this centre
  const loadProgrammes = useCallback(async () => {
    if (!centreId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("programmes")
      .select("*")
      .eq("centre_id", centreId)
      .neq("status", "archived")
      .order("season_year", { ascending: false })
      .order("turn_number");
    if (error) setError(error.message);
    else setProgrammes(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { loadProgrammes(); }, [loadProgrammes]);

  // Load shifts for selected programme
  const loadShifts = useCallback(async (progId) => {
    const { data, error } = await supabase
      .from("shifts")
      .select("*")
      .eq("programme_id", progId)
      .neq("status", "cancelled")
      .order("shift_date")
      .order("start_time");
    if (error) setError(error.message);
    else setShifts(data || []);
  }, []);

  useEffect(() => {
    if (selectedProg) loadShifts(selectedProg.id);
  }, [selectedProg, loadShifts]);

  // ── Create programme ──────────────────────────────────
  const createProgramme = async () => {
    if (!centreId) return;
    setLoading(true);
    setError(null);
    const row = {
      id: genId(),
      centre_id: centreId,
      season_year: new Date(newProgForm.start_date).getFullYear(),
      turn_number: Number(newProgForm.turn_number),
      start_date: newProgForm.start_date,
      end_date: newProgForm.end_date,
      status: "draft",
    };
    const { data, error } = await supabase.from("programmes").insert(row).select().single();
    if (error) { setError(error.message); setLoading(false); return; }
    await loadProgrammes();
    setSelectedProg(data);
    setShowNewProg(false);
    setStep(1);
    setLoading(false);
  };

  // ── Calculate min teachers needed for a date + slot ──
  // Counts students on site in that lesson slot, divides by 16 (max class size)
  const calcMinTeachers = (dateStr, slot) => {
    if (!groups || !groups.length) return 1;
    let students = 0;
    groups.forEach((g) => {
      if (!g.arr || !g.dep) return;
      if (dateStr < g.arr || dateStr > g.dep) return;
      if (dateStr === g.arr || dateStr === g.dep) return;
      const daysSince = Math.floor((new Date(dateStr) - new Date(g.arr)) / 86400000);
      const weekNum = Math.floor(daysSince / 7);
      const groupSlot = weekNum % 2 === 0
        ? (g.lessonSlot || "AM")
        : (g.lessonSlot === "AM" ? "PM" : "AM");
      if (groupSlot === slot) students += (g.stu || 0);
    });
    return Math.max(1, Math.ceil(students / 16));
  };

  // ── Apply standard shift template ────────────────────
  const applyStandardTemplate = async () => {
    if (!selectedProg) return;
    const confirmed = shifts.length > 0
      ? window.confirm("This will replace all existing shifts for this programme. Continue?")
      : true;
    if (!confirmed) return;
    setLoading(true);
    setError(null);

    await supabase.from("shifts").delete().eq("programme_id", selectedProg.id);

    // Only add overnight shifts if this centre has HP staff
    const hasHP = (staff || []).some((s) => s.role === "HP");
    const shiftsToApply = hasHP ? [...STANDARD_SHIFTS, OVERNIGHT_SHIFT] : STANDARD_SHIFTS;

    const dates = datesBetween(selectedProg.start_date, selectedProg.end_date);
    const rows = [];
    dates.forEach((date) => {
      const minTeachersAM = calcMinTeachers(date, "AM");
      const minTeachersPM = calcMinTeachers(date, "PM");
      shiftsToApply.forEach((tmpl) => {
        let minStaff = tmpl.min_staff;
        if (tmpl.shift_type === "teaching") {
          minStaff = tmpl.start_time < "13:00" ? minTeachersAM : minTeachersPM;
        }
        rows.push({
          id: genId(),
          programme_id: selectedProg.id,
          centre_id: centreId,
          shift_date: date,
          start_time: tmpl.start_time,
          end_time: tmpl.end_time,
          shift_type: tmpl.shift_type,
          role_required: tmpl.role_required,
          min_staff: minStaff,
          session_count: tmpl.session_count,
          status: "draft",
        });
      });
    });

    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from("shifts").insert(rows.slice(i, i + 500));
      if (error) { setError(error.message); setLoading(false); return; }
    }
    await loadShifts(selectedProg.id);
    setLoading(false);
  };

  // ── Delete a shift ────────────────────────────────────
  const deleteShift = async (shiftId) => {
    await supabase.from("shifts").delete().eq("id", shiftId);
    setShifts((prev) => prev.filter((s) => s.id !== shiftId));
  };

  // ── Update shift min_staff ────────────────────────────
  const updateMinStaff = async (shiftId, value) => {
    const n = Math.max(0, parseInt(value) || 0);
    await supabase.from("shifts").update({ min_staff: n }).eq("id", shiftId);
    setShifts((prev) => prev.map((s) => s.id === shiftId ? { ...s, min_staff: n } : s));
  };

  // ── Run solver ────────────────────────────────────────
  const runSolver = async ({ dryRun = false } = {}) => {
    if (!selectedProg) return;
    setGenerating(true);
    setError(null);
    setSolveResult(null);
    try {
      const solverUrl = process.env.NEXT_PUBLIC_SOLVER_URL || "https://uklc-rota-solver-production.up.railway.app";
      const apiKey   = process.env.NEXT_PUBLIC_SOLVER_API_KEY || "";
      const res = await fetch(`${solverUrl}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          programme_id: selectedProg.id,
          dry_run: dryRun,
          time_limit_seconds: 30,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Solver request failed");
      setSolveResult(data);
      setPublished(false);
      if (!dryRun) setStep(3);
    } catch (e) {
      setError(e.message);
    }
    setGenerating(false);
  };

  // ── Publish draft assignments ─────────────────────────
  const publishRota = async () => {
    if (!selectedProg || !solveResult) return;
    setPublishing(true);
    setError(null);

    // Get all shift IDs for this programme
    const shiftIds = solveResult.assignments.map((a) => a.shift_id);
    const uniqueShiftIds = [...new Set(shiftIds)];

    // Update assignment status from draft → confirmed
    if (uniqueShiftIds.length > 0) {
      const { error } = await supabase
        .from("assignments")
        .update({ status: "confirmed" })
        .in("shift_id", uniqueShiftIds)
        .eq("status", "draft");
      if (error) { setError(error.message); setPublishing(false); return; }
    }

    // Update programme status to active
    await supabase
      .from("programmes")
      .update({ status: "active" })
      .eq("id", selectedProg.id);

    await loadProgrammes();
    setPublished(true);
    setPublishing(false);
  };

  // ── Group shifts by date for display ─────────────────
  const shiftsByDate = shifts.reduce((acc, s) => {
    if (!acc[s.shift_date]) acc[s.shift_date] = [];
    acc[s.shift_date].push(s);
    return acc;
  }, {});

  const shiftDates = Object.keys(shiftsByDate).sort();

  // ── Summary stats ─────────────────────────────────────
  const shiftTypeCounts = shifts.reduce((acc, s) => {
    acc[s.shift_type] = (acc[s.shift_type] || 0) + 1;
    return acc;
  }, {});

  // ── Status badge ──────────────────────────────────────
  const StatusBadge = ({ status }) => {
    const map = {
      draft:     { bg: "#e2e8f0", text: "#475569" },
      active:    { bg: "#d1fae5", text: "#065f46" },
      completed: { bg: "#dbeafe", text: "#1e40af" },
    };
    const c = map[status] || map.draft;
    return (
      <span style={{ background: c.bg, color: c.text, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700, fontFamily: "'Raleway', sans-serif" }}>
        {status}
      </span>
    );
  };

  if (!centreId) return (
    <div style={{ padding: 40, textAlign: "center", color: B.textMuted }}>
      Select a centre to use the AI Rota.
    </div>
  );

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1200, margin: "0 auto" }}>

      {/* ── Page heading ────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: B.navy, fontFamily: "'Raleway', sans-serif" }}>
          AI Rota Generator
        </div>
        <div style={{ fontSize: 12, color: B.textMuted, marginTop: 2 }}>
          {centreName} — OR-Tools constraint solver
        </div>
      </div>

      {/* ── Step indicator ──────────────────────────────── */}
      <Steps current={step} />

      {/* ── Error banner ────────────────────────────────── */}
      {error && (
        <div style={{ background: FLAG_HARD.bg, border: `1px solid ${FLAG_HARD.border}`, borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: FLAG_HARD.text, fontWeight: 600 }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer", fontWeight: 800, color: FLAG_HARD.text }}>✕</button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          STEP 0 — PROGRAMME SELECTION
      ══════════════════════════════════════════════════ */}
      {step === 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: B.navy }}>
              Select or create a programme (turn) for {centreName}
            </div>
            {!readOnly && (
              <button onClick={() => setShowNewProg((v) => !v)} style={{
                background: B.navy, color: "#fff", border: "none", borderRadius: 7,
                padding: "8px 16px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                fontFamily: "'Raleway', sans-serif",
              }}>
                + New Programme
              </button>
            )}
          </div>

          {/* New programme form */}
          {showNewProg && (
            <div style={{ background: B.ice, border: `1px solid ${B.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: B.navy, marginBottom: 12, fontFamily: "'Raleway', sans-serif" }}>Create New Programme</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 10, color: B.textMuted, fontWeight: 700 }}>Turn number</span>
                  <input type="number" min={1} value={newProgForm.turn_number}
                    onChange={(e) => setNewProgForm((p) => ({ ...p, turn_number: e.target.value }))}
                    style={{ padding: "7px 10px", border: `1px solid ${B.border}`, borderRadius: 6, fontSize: 12, width: 80, fontFamily: "'Open Sans', sans-serif" }} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 10, color: B.textMuted, fontWeight: 700 }}>Start date</span>
                  <input type="date" value={newProgForm.start_date}
                    onChange={(e) => setNewProgForm((p) => ({ ...p, start_date: e.target.value }))}
                    style={{ padding: "7px 10px", border: `1px solid ${B.border}`, borderRadius: 6, fontSize: 12, fontFamily: "'Open Sans', sans-serif" }} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 10, color: B.textMuted, fontWeight: 700 }}>End date</span>
                  <input type="date" value={newProgForm.end_date}
                    onChange={(e) => setNewProgForm((p) => ({ ...p, end_date: e.target.value }))}
                    style={{ padding: "7px 10px", border: `1px solid ${B.border}`, borderRadius: 6, fontSize: 12, fontFamily: "'Open Sans', sans-serif" }} />
                </label>
                <button onClick={createProgramme} disabled={loading} style={{
                  background: B.red, color: "#fff", border: "none", borderRadius: 7,
                  padding: "8px 18px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                  fontFamily: "'Raleway', sans-serif", opacity: loading ? 0.6 : 1,
                }}>
                  {loading ? "Creating…" : "Create"}
                </button>
                <button onClick={() => setShowNewProg(false)} style={{ background: "none", border: `1px solid ${B.border}`, borderRadius: 7, padding: "8px 14px", fontSize: 11, cursor: "pointer", fontFamily: "'Raleway', sans-serif", color: B.textMuted }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Programme list */}
          {loading && <div style={{ color: B.textMuted, fontSize: 12, padding: 20 }}>Loading…</div>}
          {!loading && programmes.length === 0 && (
            <div style={{ background: B.ice, border: `1px dashed ${B.border}`, borderRadius: 10, padding: 32, textAlign: "center" }}>
              <div style={{ fontSize: 13, color: B.textMuted, marginBottom: 8 }}>No programmes yet for {centreName}</div>
              <div style={{ fontSize: 11, color: B.textLight }}>Create a programme (turn) to get started</div>
            </div>
          )}
          {programmes.map((p) => (
            <div key={p.id} onClick={() => { setSelectedProg(p); setStep(1); }} style={{
              background: B.white, border: `1px solid ${selectedProg?.id === p.id ? B.navy : B.border}`,
              borderRadius: 10, padding: "14px 18px", marginBottom: 10,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 16,
              transition: "border-color 0.1s",
            }}>
              <div style={{ background: B.navy, color: B.yellow, borderRadius: 8, padding: "8px 14px", fontFamily: "'Raleway', sans-serif", fontWeight: 800, fontSize: 16, minWidth: 36, textAlign: "center" }}>
                {p.turn_number}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: B.navy, fontSize: 13 }}>
                  Turn {p.turn_number} — {p.season_year}
                </div>
                <div style={{ fontSize: 11, color: B.textMuted, marginTop: 2 }}>
                  {fmtDate(p.start_date)} → {fmtDate(p.end_date)}
                  <span style={{ marginLeft: 10, color: B.textLight }}>
                    ({datesBetween(p.start_date, p.end_date).length} days)
                  </span>
                </div>
              </div>
              <StatusBadge status={p.status} />
              <div style={{ color: B.textMuted, fontSize: 18 }}>›</div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          STEP 1 — SHIFT TEMPLATE
      ══════════════════════════════════════════════════ */}
      {step === 1 && selectedProg && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <button onClick={() => setStep(0)} style={{ background: "none", border: `1px solid ${B.border}`, borderRadius: 7, padding: "6px 12px", fontSize: 11, cursor: "pointer", color: B.textMuted }}>
              ← Back
            </button>
            <div>
              <div style={{ fontWeight: 700, color: B.navy, fontSize: 13 }}>
                Turn {selectedProg.turn_number} — {fmtDate(selectedProg.start_date)} to {fmtDate(selectedProg.end_date)}
              </div>
              <div style={{ fontSize: 11, color: B.textMuted }}>Define the shift template before generating the rota</div>
            </div>
          </div>

          {/* Template actions */}
          {!readOnly && (
            <div style={{ display: "flex", gap: 10, marginBottom: 16, padding: "12px 16px", background: B.ice, borderRadius: 10, border: `1px solid ${B.border}`, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: B.navy, marginRight: 4 }}>Shift template:</div>
              <button onClick={applyStandardTemplate} disabled={loading} style={{
                background: B.navy, color: "#fff", border: "none", borderRadius: 7,
                padding: "7px 16px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                fontFamily: "'Raleway', sans-serif", opacity: loading ? 0.6 : 1,
              }}>
                {loading ? "Applying…" : shifts.length > 0 ? "Re-apply Standard Template" : "Apply Standard Template"}
              </button>
              <div style={{ fontSize: 10, color: B.textMuted }}>
                Applies 6 shifts/day: Teaching AM+PM, Activity AM+PM, Evening Duty, Overnight HP
              </div>
            </div>
          )}

          {/* Shift stats */}
          {shifts.length > 0 && (
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              {Object.entries(shiftTypeCounts).map(([type, count]) => {
                const c = SHIFT_COLOURS[type] || { bg: "#f1f5f9", text: "#475569" };
                return (
                  <div key={type} style={{ background: c.bg, color: c.text, padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                    {type}: {count}
                  </div>
                );
              })}
              <div style={{ background: "#f1f5f9", color: "#475569", padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                Total: {shifts.length} shifts
              </div>
            </div>
          )}

          {/* Shifts by date — collapsed accordion */}
          {shifts.length === 0 && !loading && (
            <div style={{ background: B.ice, border: `1px dashed ${B.border}`, borderRadius: 10, padding: 32, textAlign: "center" }}>
              <div style={{ fontSize: 13, color: B.textMuted, marginBottom: 8 }}>No shifts yet</div>
              <div style={{ fontSize: 11, color: B.textLight }}>Apply the standard template above to generate shifts for all {datesBetween(selectedProg.start_date, selectedProg.end_date).length} days</div>
            </div>
          )}

          {shiftDates.length > 0 && (
            <div style={{ maxHeight: 420, overflowY: "auto", border: `1px solid ${B.border}`, borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ background: B.navy, color: "#fff" }}>
                    {["Date", "Type", "Role", "Start", "End", "Min staff"].map((h) => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, fontSize: 11, fontFamily: "'Raleway', sans-serif" }}>{h}</th>
                    ))}
                    {!readOnly && <th style={{ padding: "8px 12px" }} />}
                  </tr>
                </thead>
                <tbody>
                  {shiftDates.map((date, di) =>
                    shiftsByDate[date].map((s, si) => {
                      const c = SHIFT_COLOURS[s.shift_type] || { bg: "#f8fafc", text: "#334155" };
                      return (
                        <tr key={s.id} style={{ borderBottom: `1px solid ${B.borderLight}`, background: di % 2 === 0 ? B.white : "#f8fafc" }}>
                          {si === 0 ? (
                            <td rowSpan={shiftsByDate[date].length} style={{ padding: "6px 12px", fontWeight: 700, color: B.navy, verticalAlign: "middle", borderRight: `1px solid ${B.border}`, whiteSpace: "nowrap" }}>
                              {fmtDate(date)}
                            </td>
                          ) : null}
                          <td style={{ padding: "6px 12px" }}>
                            <span style={{ background: c.bg, color: c.text, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700 }}>
                              {s.shift_type}
                            </span>
                          </td>
                          <td style={{ padding: "6px 12px", color: B.textMuted }}>{s.role_required}</td>
                          <td style={{ padding: "6px 12px", fontFamily: "monospace", color: B.navy }}>{s.start_time}</td>
                          <td style={{ padding: "6px 12px", fontFamily: "monospace", color: B.navy }}>{s.end_time}</td>
                          <td style={{ padding: "6px 12px" }}>
                            {readOnly ? s.min_staff : (
                              <input type="number" min={0} max={20} value={s.min_staff}
                                onChange={(e) => updateMinStaff(s.id, e.target.value)}
                                style={{ width: 48, padding: "3px 6px", border: `1px solid ${B.border}`, borderRadius: 5, fontSize: 11, textAlign: "center", fontFamily: "'Open Sans', sans-serif" }} />
                            )}
                          </td>
                          {!readOnly && (
                            <td style={{ padding: "4px 8px", textAlign: "center" }}>
                              <button onClick={() => deleteShift(s.id)} title="Remove shift" style={{ background: "none", border: "none", cursor: "pointer", color: B.textLight, fontSize: 14, padding: "2px 6px" }}>✕</button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Next button */}
          {shifts.length > 0 && (
            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setStep(2)} style={{
                background: B.red, color: "#fff", border: "none", borderRadius: 8,
                padding: "10px 24px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                fontFamily: "'Raleway', sans-serif",
              }}>
                Next: Generate →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          STEP 2 — GENERATE
      ══════════════════════════════════════════════════ */}
      {step === 2 && selectedProg && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <button onClick={() => setStep(1)} style={{ background: "none", border: `1px solid ${B.border}`, borderRadius: 7, padding: "6px 12px", fontSize: 11, cursor: "pointer", color: B.textMuted }}>
              ← Back
            </button>
            <div>
              <div style={{ fontWeight: 700, color: B.navy, fontSize: 13 }}>Generate Rota</div>
              <div style={{ fontSize: 11, color: B.textMuted }}>Run the OR-Tools constraint solver to produce a draft rota</div>
            </div>
          </div>

          {/* Summary card */}
          <div style={{ background: B.ice, border: `1px solid ${B.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: B.navy, marginBottom: 12, fontFamily: "'Raleway', sans-serif" }}>Ready to generate</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
              {[
                { label: "Programme", value: `Turn ${selectedProg.turn_number}` },
                { label: "Duration", value: `${datesBetween(selectedProg.start_date, selectedProg.end_date).length} days` },
                { label: "Staff", value: `${staff.length} members` },
                { label: "Shifts", value: `${shifts.length} total` },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: B.white, border: `1px solid ${B.border}`, borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 10, color: B.textMuted, fontWeight: 700 }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: B.navy, fontFamily: "'Raleway', sans-serif" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Constraints checklist */}
          <div style={{ background: B.white, border: `1px solid ${B.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: B.navy, marginBottom: 12, fontFamily: "'Raleway', sans-serif" }}>Constraints applied</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[
                "HC-001 — 11h rest between shifts",
                "HC-002 — 1 day off per 7 days",
                "HC-004 — 48h/week max (non-opt-out)",
                "HC-006 — 5DFTT Mon–Fri only",
                "HC-007 — Activity cover every afternoon",
                "HC-008 — 1:20 overnight ratio (12–17)",
                "HC-009 — 1:15 overnight ratio (under-12)",
                "HC-010 — HP on overnight duty",
                "HC-016 — FTT/5DFTT academic only",
                // HC-018 removed — DBS checked at recruitment stage
                "SC-001 — Fair weekend distribution",
                "SC-003 — Max 6 consecutive days",
                "SC-005 — 12h rest target",
                "SC-006 — Class group continuity",
                "SC-007 — TAL teaching–activity buffer",
              ].map((c) => (
                <div key={c} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: B.textMuted }}>
                  <span style={{ color: "#22c55e", fontWeight: 800 }}>✓</span> {c}
                </div>
              ))}
            </div>
          </div>

          {/* Generate buttons */}
          {!readOnly && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => runSolver({ dryRun: false })} disabled={generating} style={{
                background: generating ? B.textMuted : B.red, color: "#fff", border: "none",
                borderRadius: 8, padding: "12px 28px", fontSize: 13, fontWeight: 700,
                cursor: generating ? "not-allowed" : "pointer", fontFamily: "'Raleway', sans-serif",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                {generating ? (
                  <>
                    <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                    Solving… (up to 30s)
                  </>
                ) : "⚡ Generate Rota"}
              </button>
              <button onClick={() => runSolver({ dryRun: true })} disabled={generating} style={{
                background: B.white, color: B.navy, border: `1px solid ${B.navy}`,
                borderRadius: 8, padding: "12px 20px", fontSize: 12, fontWeight: 700,
                cursor: generating ? "not-allowed" : "pointer", fontFamily: "'Raleway', sans-serif",
              }}>
                Validate only (dry run)
              </button>
            </div>
          )}

          {/* Solver result preview */}
          {solveResult && (
            <div style={{ marginTop: 20 }}>
              <SolveResultSummary result={solveResult} onReview={() => setStep(3)} />
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          STEP 3 — REVIEW & PUBLISH
      ══════════════════════════════════════════════════ */}
      {step === 3 && solveResult && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <button onClick={() => setStep(2)} style={{ background: "none", border: `1px solid ${B.border}`, borderRadius: 7, padding: "6px 12px", fontSize: 11, cursor: "pointer", color: B.textMuted }}>
              ← Re-generate
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: B.navy, fontSize: 13 }}>Review Draft Rota</div>
              <div style={{ fontSize: 11, color: B.textMuted }}>Review assignments and flags before publishing</div>
            </div>
            {!readOnly && !published && (
              <button onClick={publishRota} disabled={publishing || solveResult.hard_flags?.length > 0} style={{
                background: solveResult.hard_flags?.length > 0 ? B.textMuted : "#16a34a",
                color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px",
                fontSize: 12, fontWeight: 700,
                cursor: (publishing || solveResult.hard_flags?.length > 0) ? "not-allowed" : "pointer",
                fontFamily: "'Raleway', sans-serif",
                title: solveResult.hard_flags?.length > 0 ? "Resolve hard flags before publishing" : "",
              }}>
                {publishing ? "Publishing…" : "✓ Publish Rota"}
              </button>
            )}
            {published && (
              <div style={{ background: FLAG_OK.bg, border: `1px solid ${FLAG_OK.border}`, color: FLAG_OK.text, borderRadius: 8, padding: "10px 20px", fontSize: 12, fontWeight: 700 }}>
                ✓ Published
              </div>
            )}
          </div>

          <SolveResultSummary result={solveResult} />

          {/* Assignments table */}
          {solveResult.assignments?.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontWeight: 700, color: B.navy, fontSize: 12, marginBottom: 10, fontFamily: "'Raleway', sans-serif" }}>
                Draft assignments ({solveResult.assignments.length})
              </div>
              <div style={{ maxHeight: 480, overflowY: "auto", border: `1px solid ${B.border}`, borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: B.navy, color: "#fff" }}>
                      {["Date", "Type", "Start", "End", "Staff", "Flags"].map((h) => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, fontSize: 11, fontFamily: "'Raleway', sans-serif" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...solveResult.assignments]
                      .sort((a, b) => a.shift_date.localeCompare(b.shift_date) || a.start_time.localeCompare(b.start_time))
                      .map((a, i) => {
                        const c = SHIFT_COLOURS[a.shift_type] || { bg: "#f8fafc", text: "#334155" };
                        const flags = a.constraint_violations || [];
                        return (
                          <tr key={a.shift_id + a.staff_id} style={{ borderBottom: `1px solid ${B.borderLight}`, background: i % 2 === 0 ? B.white : "#f8fafc" }}>
                            <td style={{ padding: "6px 12px", fontWeight: 600, color: B.navy, whiteSpace: "nowrap" }}>{fmtDate(a.shift_date)}</td>
                            <td style={{ padding: "6px 12px" }}>
                              <span style={{ background: c.bg, color: c.text, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700 }}>{a.shift_type}</span>
                            </td>
                            <td style={{ padding: "6px 12px", fontFamily: "monospace" }}>{a.start_time}</td>
                            <td style={{ padding: "6px 12px", fontFamily: "monospace" }}>{a.end_time}</td>
                            <td style={{ padding: "6px 12px", fontWeight: 600, color: B.navy }}>{a.staff_name}</td>
                            <td style={{ padding: "6px 12px" }}>
                              {flags.length > 0
                                ? flags.map((f, fi) => (
                                  <span key={fi} style={{ background: FLAG_SOFT.bg, color: FLAG_SOFT.text, border: `1px solid ${FLAG_SOFT.border}`, borderRadius: 6, padding: "2px 6px", fontSize: 10, fontWeight: 700, display: "inline-block", marginRight: 4 }}>
                                    {f.constraint_id}
                                  </span>
                                ))
                                : <span style={{ color: B.textLight, fontSize: 10 }}>—</span>
                              }
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Solve result summary component ───────────────────────────────────────────
function SolveResultSummary({ result, onReview }) {
  const hardFlags = result.hard_flags || [];
  const softFlags = result.soft_flags || [];
  const statusOk = result.status === "optimal" || result.status === "feasible";

  return (
    <div>
      {/* Status banner */}
      <div style={{
        background: statusOk ? FLAG_OK.bg : FLAG_HARD.bg,
        border: `1px solid ${statusOk ? FLAG_OK.border : FLAG_HARD.border}`,
        borderRadius: 10, padding: "12px 16px", marginBottom: 12,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <span style={{ fontSize: 20 }}>{statusOk ? "✅" : "❌"}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: statusOk ? FLAG_OK.text : FLAG_HARD.text, fontFamily: "'Raleway', sans-serif" }}>
            {result.status === "optimal" && "Optimal solution found"}
            {result.status === "feasible" && "Feasible solution found (within time limit)"}
            {result.status === "infeasible" && "No solution found — hard constraints cannot be satisfied"}
            {result.status === "error" && "Solver error"}
          </div>
          {result.stats && (
            <div style={{ fontSize: 11, color: B.textMuted, marginTop: 2 }}>
              {result.stats.n_assignments} assignments · {result.stats.solve_time_ms}ms · {result.stats.n_staff} staff · {result.stats.n_shifts} shifts
            </div>
          )}
        </div>
        {onReview && statusOk && (
          <button onClick={onReview} style={{ marginLeft: "auto", background: "#16a34a", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Raleway', sans-serif" }}>
            Review →
          </button>
        )}
      </div>

      {/* Hard flags */}
      {hardFlags.length > 0 && (
        <div style={{ background: FLAG_HARD.bg, border: `1px solid ${FLAG_HARD.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: FLAG_HARD.text, marginBottom: 8, fontFamily: "'Raleway', sans-serif" }}>
            ⚠️ {hardFlags.length} hard constraint {hardFlags.length === 1 ? "flag" : "flags"} — CM action required before publish
          </div>
          {hardFlags.map((f, i) => (
            <div key={i} style={{ fontSize: 11, color: FLAG_HARD.text, marginBottom: 4, display: "flex", gap: 8 }}>
              <span style={{ background: FLAG_HARD.badge, color: "#fff", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{f.constraint_id}</span>
              <span>{f.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Soft flags */}
      {softFlags.length > 0 && (
        <div style={{ background: FLAG_SOFT.bg, border: `1px solid ${FLAG_SOFT.border}`, borderRadius: 10, padding: "12px 16px" }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: FLAG_SOFT.text, marginBottom: 8, fontFamily: "'Raleway', sans-serif" }}>
            ℹ️ {softFlags.length} soft constraint {softFlags.length === 1 ? "warning" : "warnings"} — review before publishing
          </div>
          {softFlags.slice(0, 5).map((f, i) => (
            <div key={i} style={{ fontSize: 11, color: FLAG_SOFT.text, marginBottom: 4, display: "flex", gap: 8 }}>
              <span style={{ background: FLAG_SOFT.badge, color: "#fff", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{f.constraint_id}</span>
              <span>{f.description}</span>
            </div>
          ))}
          {softFlags.length > 5 && <div style={{ fontSize: 11, color: FLAG_SOFT.text, fontStyle: "italic" }}>+{softFlags.length - 5} more warnings</div>}
        </div>
      )}
    </div>
  );
}
