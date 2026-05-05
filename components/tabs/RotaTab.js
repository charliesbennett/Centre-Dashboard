"use client";
import { useState, useMemo, useEffect } from "react";
import { SESSION_TYPES, genDates, dayKey, dayName, isWeekend, inRange, fmtDate } from "@/lib/constants";
import { useB } from "@/lib/theme";
import { EVE_ENT_NAMES } from "@/lib/rotaRules";
import { ROLE_RULES, NO_COUNT } from "@/lib/rotaRules";
import { getFortnights, getTodayFortnight } from "@/lib/fortnights";
import { StatCard, IcWand, thStyle, tdStyle, btnPrimary } from "@/components/ui";
import { buildDemand } from "@/lib/rotaDemand";
import { bindTals } from "@/lib/rotaBinding";
import { placeDayOffs } from "@/lib/rotaDayOff";
import { allocateRota } from "@/lib/rotaAllocator";
import { getAllInductionDates, getMatchedCentreName } from "@/lib/rotaInduction";
import { buildFixedGrid as buildFixedGridPure } from "@/lib/rotaFixed";

const SLOTS = ["AM", "PM", "Eve"];
const CELL_W = 88;
const CELL_H = 52;
const ACTIVITY_ROLES = new Set(["SAI", "LAL", "LAC", "EAL", "EAC", "SC", "AC", "FOOTBALL", "PA", "HP", "DRAMA", "DANCE"]);

function calcRequiredStaff(n) { return n > 0 ? Math.ceil(n / 20) : 0; }

// Which lesson slot does this group have on a given date?
function getGroupLessonSlot(group, dateStr) {
  if (!group.arr || !group.lessonSlot) return group.lessonSlot || "AM";
  const arrDate = new Date(group.arr);
  const curDate = new Date(dateStr);
  const daysSince = Math.floor((curDate - arrDate) / 86400000);
  const weekNum = Math.floor(daysSince / 7);
  return weekNum % 2 === 0 ? group.lessonSlot : (group.lessonSlot === "AM" ? "PM" : "AM");
}

const ROLE_DISPLAY = { FOOTBALL: "Football Specialist", PA: "Performing Arts Specialist", Drama: "Performing Arts Specialist", DRAMA: "Performing Arts Specialist" };

function getSessionLimit(role) {
  const rule = ROLE_RULES[(role === "Drama" || role === "DRAMA") ? "PA" : role];
  if (!rule) return 24;
  if (rule.salaried) return Infinity; // management uncapped
  return rule.target || 24;
}

// Does this cell value count as a session?
function isSession(value) {
  if (!value) return false;
  return !NO_COUNT.has(value);
}

function onSiteDateStrs(s, dates) {
  const depDs = s.dep ? String(s.dep).slice(0, 10) : null;
  return dates.map((d) => dayKey(d)).filter((ds) => inRange(ds, s.arr, s.dep) && ds !== depDs);
}

function buildFixedGrid(staff, dates, groupArrivalDate, progStart, centreName) {
  const progYear = progStart ? new Date(progStart).getFullYear() : new Date().getFullYear();
  const dateStrs = dates.map((d) => dayKey(d));
  const effectiveArrival = groupArrivalDate || progStart || null;
  return buildFixedGridPure(staff, dateStrs, effectiveArrival, progYear, centreName);
}

function canFillArrivalDefault(role) {
  return role === "TAL" || role === "FTT" || role === "5FTT" || ACTIVITY_ROLES.has(role);
}

function applyArrivalDefaults(grid, staff, groupArrivalDate) {
  if (!groupArrivalDate) return grid;
  const out = { ...grid };
  staff.filter((s) => canFillArrivalDefault(s.role)).forEach((s) => {
    const ds = groupArrivalDate;
    if (!inRange(ds, s.arr, s.dep) || ds === s.dep) return;
    const amK = `${s.id}-${ds}-AM`;
    if (!out[amK]) out[amK] = "Setup";
  });
  return out;
}

function summariseShortfalls(shortfalls) {
  if (!shortfalls?.length) return [];
  const byRole = {};
  shortfalls.forEach((sf) => {
    const key = sf.role;
    if (!byRole[key]) byRole[key] = { role: key, reasons: {}, dates: new Set() };
    byRole[key].reasons[sf.reason] = (byRole[key].reasons[sf.reason] || 0) + sf.count;
    byRole[key].dates.add(sf.date);
  });
  return Object.values(byRole).map((r) => ({
    role: r.role,
    dates: [...r.dates].sort(),
    topReason: Object.entries(r.reasons).sort((a, b) => b[1] - a[1])[0]?.[0],
    totalMissing: Object.values(r.reasons).reduce((s, v) => s + v, 0),
  }));
}

export default function RotaTab({ staff, progStart, progEnd, excDays, groups, rotaGrid, setRotaGrid, progGrid = {}, centreName = "", readOnly = false, rotaStale = false, onRotaStaleCleared }) {
  const B = useB();
  const [showRatios, setShowRatios] = useState(true);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiError, setAiError] = useState(null);
  const [staffingSuggestions, setStaffingSuggestions] = useState([]);
  const [reviewerCorrections, setReviewerCorrections] = useState(null);
  const [reviewerDismissed, setReviewerDismissed] = useState(false);
  const [allocShortfalls, setAllocShortfalls] = useState([]);
  const [clearedCells, setClearedCells] = useState(new Set());
  const setGrid = setRotaGrid;

  // Rota grid starts from induction day (before contracted staff arrival).
  const rotaStart = useMemo(() => {
    const inductionDates = getAllInductionDates(centreName);
    return inductionDates[0] || progStart;
  }, [centreName, progStart]);
  const fortnights = useMemo(() => getFortnights(rotaStart, progEnd), [rotaStart, progEnd]);
  const [fortIdx, setFortIdx] = useState(0);
  useEffect(() => {
    setFortIdx(getTodayFortnight(fortnights, dayKey(new Date())));
  }, [fortnights]);
  const selectedFortnight = fortnights[fortIdx] || { start: progStart, end: progEnd };
  const dates = useMemo(
    () => (selectedFortnight.start && selectedFortnight.end) ? genDates(selectedFortnight.start, selectedFortnight.end) : [],
    [selectedFortnight.start, selectedFortnight.end]
  );
  const fortnightStaff = useMemo(() => {
    if (!selectedFortnight.start || !selectedFortnight.end) return staff;
    return staff.filter((s) => s.arr <= selectedFortnight.end && s.dep >= selectedFortnight.start);
  }, [staff, selectedFortnight]);
  const hasRotaData = useMemo(() => Object.values(rotaGrid || {}).some(Boolean), [rotaGrid]);

  const groupArrivalDate = useMemo(() => {
    if (!groups || !groups.length) return null;
    return groups.map((g) => g.arr ? String(g.arr).slice(0, 10) : null).filter(Boolean).sort()[0] || null;
  }, [groups]);

  const allArrivalDates = useMemo(() => new Set(groups ? groups.map((g) => g.arr).filter(Boolean) : []), [groups]);

  // fixedGrid overlays structural cells (Induction/Setup/Airport/Day Off) onto the saved rota,
  // so stale Supabase data for pre-contract dates is always corrected in the display.
  const fixedGrid = useMemo(
    () => buildFixedGrid(staff, dates, groupArrivalDate, progStart, centreName),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [staff, dates, groupArrivalDate, progStart, centreName]
  );
  const grid = useMemo(() => {
    const merged = { ...rotaGrid };
    const arrivalCutoff = groupArrivalDate || progStart || null;
    // Remove stale Induction cells on programme dates where fixedGrid has no entry at all
    // (e.g. old July 6 Induction in Supabase). Don't remove where fixedGrid has Setup etc —
    // that means the user intentionally typed Induction into a pre-contract slot.
    Object.keys(merged).forEach((k) => {
      if (merged[k] === "Induction" && !fixedGrid[k]) delete merged[k];
      // Clear stale Setup on teaching days (>= group/programme arrival) saved from old runs.
      if (merged[k] === "Setup" && !fixedGrid[k] && arrivalCutoff) {
        const m = k.match(/-(\d{4}-\d{2}-\d{2})-(?:AM|PM|Eve)$/);
        if (m && m[1] >= arrivalCutoff) delete merged[k];
      }
    });
    // Apply fixedGrid: Induction always forces; Setup/Airport/DayOff only fill empty cells
    // (so user-typed values in rotaGrid are never overwritten by soft defaults)
    Object.entries(fixedGrid).forEach(([k, v]) => {
      if (clearedCells.has(k)) return;
      if (v === "Induction" || !merged[k]) merged[k] = v;
    });
    return merged;
  }, [rotaGrid, fixedGrid, clearedCells, groupArrivalDate, progStart]);

  // ── Lesson demand per slot per day ────────────────────
  const lessonDemand = useMemo(() => {
    const demand = {};
    if (!groups || !groups.length) return demand;
    dates.forEach((d) => {
      const ds = dayKey(d);
      if (isWeekend(d)) return;
      let amStudents = 0, pmStudents = 0;
      groups.forEach((g) => {
        if (!inRange(ds, g.arr, g.dep)) return;
        if (g.arr && ds === dayKey(new Date(g.arr))) return;
        if (g.dep && ds === dayKey(new Date(g.dep))) return;
        const slot = getGroupLessonSlot(g, ds);
        if (slot === "AM") amStudents += g.stu || 0;
        else pmStudents += g.stu || 0;
      });
      demand[ds] = {
        amStudents, pmStudents,
        amTeachers: Math.ceil(amStudents / 16),
        pmTeachers: Math.ceil(pmStudents / 16),
      };
    });
    return demand;
  }, [groups, dates]);

  // ── Peak teacher adequacy check ───────────────────────
  const teacherAdequacy = useMemo(() => {
    if (!staff || !groups || !dates.length) return null;
    const TEACHING = ["FTT", "TAL", "CD"];
    let peakAM = 0, peakPM = 0;
    Object.values(lessonDemand).forEach((d) => {
      peakAM = Math.max(peakAM, d.amTeachers);
      peakPM = Math.max(peakPM, d.pmTeachers);
    });
    const peakNeeded = Math.max(peakAM, peakPM);
    const teachersOnSite = staff.filter((s) => TEACHING.includes(s.role)).length;
    const typicalAvail = Math.floor(teachersOnSite * 6 / 7);
    if (peakNeeded === 0) return null;
    const shortfall = peakNeeded - typicalAvail;
    return { peakNeeded, teachersOnSite, typicalAvail, shortfall, peakAM, peakPM };
  }, [staff, groups, dates, lessonDemand]);

  // ── Auto-generate (hybrid: fixed pass → bind → day-offs → demand allocator) ──
  const autoGenerate = () => {
    const start = selectedFortnight.start || progStart;
    const end = selectedFortnight.end || progEnd;
    const dateStrs = dates.map((d) => dayKey(d));
    const fixedGrid = buildFixedGrid(staff, dates, groupArrivalDate, progStart, centreName);
    const bindings = bindTals({ staff, groups });
    const isZZ = staff.some((s) => s.role === "FTT");
    const { demand, profiles } = buildDemand({ groups, progGrid, progStart: start, progEnd: end, isZZ });
    const { dayOffGrid } = placeDayOffs({ staff, profiles, fixedGrid, progStart: start, progEnd: end });
    const merged = { ...fixedGrid, ...dayOffGrid };
    const { grid, shortfalls } = allocateRota({ staff, demand, bindings, fixedGrid: merged, dates: dateStrs, profiles });
    const finalGrid = applyArrivalDefaults(grid, staff, groupArrivalDate);
    setGrid(finalGrid);
    setAllocShortfalls(shortfalls || []);
    onRotaStaleCleared?.();
  };

  // ── AI rota generation ────────────────────────────────
  const aiGenerate = async () => {
    const hasData = Object.values(rotaGrid).some((v) => v);
    if (hasData && !window.confirm("AI generate will overwrite all existing rota entries. Continue?")) return;
    setAiGenerating(true);
    setAiProgress(1);
    setAiError(null);
    setReviewerCorrections(null);
    setReviewerDismissed(false);
    try {
      const res = await fetch("/api/generate-rota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff, groups, progGrid, progStart, progEnd, centreName, isZZ: staff.some((s) => s.role === "FTT") }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("text/event-stream")) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalData = null;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop();
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const payload = line.slice(6).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const msg = JSON.parse(payload);
                if (msg.step) setAiProgress(msg.step);
                if (msg.error) throw new Error(msg.error);
                if (msg.grid) finalData = msg;
              } catch (parseErr) {
                if (parseErr.message && parseErr.message !== "Unexpected token") throw parseErr;
              }
            }
          }
        }
        if (!finalData) throw new Error("No grid data received from generation pipeline");
        setGrid(finalData.grid);
        setStaffingSuggestions(finalData.suggestions || []);
        if (typeof finalData.corrections === "number") setReviewerCorrections(finalData.corrections);
      } else {
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || "Generation failed");
        setGrid(data.grid);
        setStaffingSuggestions(data.suggestions || []);
        if (typeof data.corrections === "number") setReviewerCorrections(data.corrections);
      }
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiGenerating(false);
      setAiProgress(0);
    }
  };

  // ── Click / double-click to edit ──────────────────────
  const startEdit = (key, val) => { setEditingCell(key); setEditValue(val || ""); };
  const commitEdit = () => {
    if (!editingCell) return;
    const k = editingCell;
    const nv = editValue.trim();
    setEditingCell(null);
    if (!nv) {
      setClearedCells((prev) => new Set([...prev, k]));
      setGrid((prev) => { const n = { ...prev }; delete n[k]; return n; });
    } else {
      setClearedCells((prev) => { const s = new Set(prev); s.delete(k); return s; });
      setGrid((prev) => ({ ...prev, [k]: nv }));
    }
  };
  const cancelEdit = () => { setEditingCell(null); setEditValue(""); };
  const clearCell = (key) => {
    setClearedCells((prev) => new Set([...prev, key]));
    setGrid((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  // ── Session + day-off stats ───────────────────────────
  // Uses NO_COUNT from rotaRules for accurate session counting
  const getStats = (sid) => {
    let sess = 0, offs = 0;
    dates.forEach((d) => {
      const ds = dayKey(d);
      let allOff = true;
      SLOTS.forEach((sl) => {
        const v = grid[sid+"-"+ds+"-"+sl];
        if (v && isSession(v)) sess++;
        if (v && v !== "Day Off") allOff = false;
      });
      // Count as a day off only if AM and PM are both Day Off
      const am = grid[sid+"-"+ds+"-AM"];
      const pm = grid[sid+"-"+ds+"-PM"];
      if (am === "Day Off" && pm === "Day Off") offs++;
    });
    return { sess, offs };
  };

  // Ratios
  const ratioData = useMemo(() => {
    if (!groups || !groups.length) return {};
    const data = {};
    dates.forEach((d) => {
      const ds = dayKey(d);
      let stu = 0, gls = 0;
      groups.forEach((g) => {
        if (!inRange(ds, g.arr, g.dep)) return;
        if (g.arr && ds === dayKey(new Date(g.arr))) return;
        if (g.dep && ds === dayKey(new Date(g.dep))) return;
        stu += g.stu || 0; gls += g.gl || 0;
      });
      if (stu > 0) data[ds] = { students: stu, gls, required: calcRequiredStaff(stu) };
    });
    return data;
  }, [groups, dates]);

  const getStaffWorking = (ds, sl) => {
    let c = 0;
    staff.forEach((s) => {
      const v = grid[s.id+"-"+ds+"-"+sl];
      if (v && v !== "Day Off" && v !== "Induction" && v !== "Setup") c++;
    });
    return c;
  };

  const ratioAlerts = useMemo(() => {
    if (!groups || !groups.length) return [];
    const a = [];
    dates.forEach((d) => {
      const ds = dayKey(d); const rd = ratioData[ds];
      if (!rd) return;
      SLOTS.forEach((sl) => {
        const sw = getStaffWorking(ds, sl);
        const tot = sw + rd.gls;
        const short = rd.required - tot;
        if (short > 0) a.push({ date: ds, slot: sl, students: rd.students, staffWorking: sw, gls: rd.gls, total: tot, required: rd.required, shortfall: short });
      });
    });
    return a;
  }, [grid, ratioData, dates, groups]);

  const cellColor = (v, slot = "AM") => {
    if (!v) return null;
    if (v === "Day Off") return "#f59e0b";
    if (SESSION_TYPES[v]) return SESSION_TYPES[v];
    const vl = v.toLowerCase();
    if (vl.includes("lesson") || vl.includes("english test") || vl.includes("testing") || vl.includes("int english") || vl.includes("int eng")) return SESSION_TYPES["Lessons"];
    if (vl.includes("eve activity") || vl.includes("evening activity") || vl.includes("eve ent") || vl.includes("disco") || vl.includes("bbq") || vl.includes("quiz") || vl.includes("karaoke") || vl.includes("film") || vl.includes("talent") || vl.includes("scav")) return SESSION_TYPES["Eve Ents"];
    if (vl.includes("excursion")) return SESSION_TYPES["Excursion"];
    if (vl.includes("act") || vl.includes("multi")) return SESSION_TYPES["Multi-Activity"];
    if (vl.includes("half exc")) return SESSION_TYPES["Half Exc"];
    if (vl === "office") return "#94a3b8";
    if (vl === "pickup" || vl === "welcome" || vl === "setup" || vl === "departure duty") return SESSION_TYPES["Setup"];
    if (vl === "football") return "#16a34a";
    if (vl === "performing arts" || vl === "pa" || vl === "drama" || vl === "dance") return "#9333ea";
    return slot === "Eve" ? SESSION_TYPES["Eve Ents"] : SESSION_TYPES["Excursion"];
  };

  const tableMinWidth = 272 + dates.length * (CELL_W * 3 + 6);
  const CHROME = 120;

  return (
    <div style={{ height: `calc(100vh - ${CHROME}px)`, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Top controls bar ─────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: "8px 16px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderBottom: `1px solid ${B.border}`, background: B.card }}>
        <StatCard label="Staff" value={staff.length} accent={B.navy} />
        <StatCard label="Days" value={dates.length} accent={B.textMuted} />
        <StatCard label="TALs" value={staff.filter((s) => s.role === "TAL").length} accent="#3b82f6" />
        <StatCard label="FTTs" value={staff.filter((s) => s.role === "FTT").length} accent="#0891b2" />
        <StatCard label="ALs" value={staff.filter((s) => s.role === "AL").length} accent="#8b5cf6" />
        <StatCard label="SAIs" value={staff.filter((s) => s.role === "SAI").length} accent="#ec4899" />
        {groupArrivalDate && <span style={{ fontSize: 9, color: B.textMuted }}>Students arrive: <strong style={{ color: B.text }}>{fmtDate(groupArrivalDate)}</strong></span>}
        {teacherAdequacy && teacherAdequacy.shortfall > 0 && (
          <span style={{ fontSize: 9, background: B.warningBg, color: B.warning, border: `1px solid #fcd34d`, borderRadius: 5, padding: "3px 8px", fontWeight: 700 }}>
            ⚠️ Need {teacherAdequacy.peakNeeded} teachers/slot (peak) — {teacherAdequacy.typicalAvail} typically available — add {teacherAdequacy.shortfall} more TAL/FTT
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={() => setShowRatios(!showRatios)} style={{ padding: "5px 12px", borderRadius: 5, fontSize: 10, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", border: "1px solid "+(showRatios ? B.navy : B.border), background: showRatios ? B.navy : B.card, color: showRatios ? B.white : B.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
            Ratios {ratioAlerts.length > 0 && <span style={{ background: B.danger, color: B.white, borderRadius: 8, padding: "1px 5px", fontSize: 8 }}>{ratioAlerts.length}</span>}
          </button>
          {!readOnly && <button onClick={() => {
            const hasData = Object.values(rotaGrid).some((v) => v);
            if (hasData && !window.confirm("Auto-generate will overwrite all existing rota entries. Continue?")) return;
            autoGenerate();
          }} style={{ ...btnPrimary, background: B.navy }}><IcWand /> {hasRotaData ? "Re-generate" : "Auto-Generate"}</button>}
          {!readOnly && <button onClick={aiGenerate} disabled={aiGenerating} style={{ ...btnPrimary, background: aiGenerating ? B.textMuted : B.red, opacity: aiGenerating ? 0.7 : 1, cursor: aiGenerating ? "not-allowed" : "pointer" }}>
            <IcWand /> AI Generate
          </button>}
        </div>
      </div>

      {/* ── AI status strip ──────────────────────────────── */}
      {(aiGenerating || aiError) && (
        <div style={{ flexShrink: 0, padding: "6px 16px", background: aiError ? B.dangerBg : B.cyanBg, borderBottom: `1px solid ${aiError ? B.danger+"44" : B.border}`, fontSize: 10, color: aiError ? B.danger : B.cyan, fontWeight: 600 }}>
          {aiGenerating && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span>Claude is generating your rota…</span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {[
                  { step: 1, label: "1/3 Planning TAL slots" },
                  { step: 2, label: "2/3 Evening entertainment" },
                  { step: 3, label: "3/3 Reviewing" },
                ].map(({ step, label }) => {
                  const done = aiProgress > step;
                  const active = aiProgress === step;
                  return (
                    <span key={step} style={{
                      padding: "2px 8px", borderRadius: 10, fontSize: 9, fontWeight: 700,
                      background: done ? B.success + "25" : active ? B.cyanBg : B.bg,
                      color: done ? B.success : active ? B.cyan : B.textMuted,
                      border: `1px solid ${done ? B.success : active ? B.cyan : B.border}`,
                    }}>
                      {done ? "✓ " : active ? "⏳ " : ""}{label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {aiError && `AI generation failed: ${aiError}`}
        </div>
      )}

      {/* ── Reviewer corrections panel ───────────────────── */}
      {reviewerCorrections !== null && !reviewerDismissed && (
        <div style={{ flexShrink: 0, padding: "6px 16px", background: B.successBg, borderBottom: `1px solid ${B.border}`, fontSize: 10, color: B.success, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          <span>{reviewerCorrections === 0 ? "Reviewer found no issues — rota looks clean." : `Reviewer auto-corrected ${reviewerCorrections} issue${reviewerCorrections === 1 ? "" : "s"} in the generated rota.`}</span>
          <button onClick={() => setReviewerDismissed(true)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#15803d", fontSize: 12, fontWeight: 800, padding: "0 4px" }}>x</button>
        </div>
      )}

      {/* ── Staffing adequacy suggestions ────────────────── */}
      {staffingSuggestions.length > 0 && (
        <div style={{ flexShrink: 0, padding: "6px 16px", background: B.warningBg, borderBottom: `1px solid ${B.border}`, fontSize: 9, color: B.warning }}>
          <strong style={{ fontSize: 10 }}>⚠️ Staffing gaps detected — consider adding staff:</strong>
          {(() => {
            const amShort = staffingSuggestions.filter((s) => s.slot === "AM").reduce((m, s) => Math.max(m, s.shortfall), 0);
            const pmShort = staffingSuggestions.filter((s) => s.slot === "PM").reduce((m, s) => Math.max(m, s.shortfall), 0);
            const maxShort = Math.max(amShort, pmShort);
            return (
              <span style={{ marginLeft: 8 }}>
                You may need <strong>{maxShort} more TAL or FTT</strong> to cover all lesson slots.
                Affected days: {[...new Set(staffingSuggestions.map((s) => s.dow + " " + fmtDate(s.ds)))].slice(0, 5).join(", ")}
                {staffingSuggestions.length > 5 ? " + more" : ""}
              </span>
            );
          })()}
        </div>
      )}

      {/* ── Induction date indicator ─────────────────────── */}
      {(() => {
        const matched = getMatchedCentreName(centreName);
        const inDates = getAllInductionDates(centreName);
        if (!matched) return <div style={{ flexShrink: 0, padding: "4px 16px", background: "#fef9c3", borderBottom: `1px solid #fbbf24`, fontSize: 9, color: "#92400e" }}>⚠ Centre not recognised for induction lookup — using staff arrival date. Centre name: &quot;{centreName}&quot;</div>;
        return <div style={{ flexShrink: 0, padding: "4px 16px", background: "#f0fdf4", borderBottom: `1px solid #bbf7d0`, fontSize: 9, color: "#166534" }}>Induction: {matched} — {inDates.join(", ")}</div>;
      })()}

      {/* ── VBT stale warning ── */}
      {rotaStale && (
        <div style={{ flexShrink: 0, padding: "7px 16px", background: "#fef3c7", borderBottom: "1px solid #fde68a", fontSize: 10, color: "#92400e", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          ⚠ Group data was updated from VBT — consider re-generating the rota to reflect the latest student numbers and dates.
          <button onClick={() => onRotaStaleCleared?.()} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#92400e", fontWeight: 700, fontFamily: "inherit", padding: 0 }}>Dismiss</button>
        </div>
      )}

      {/* ── Allocator shortfalls (from last Auto-Generate) ── */}
      {allocShortfalls.length > 0 && (
        <div style={{ flexShrink: 0, padding: "6px 16px", background: B.dangerBg, borderBottom: `1px solid ${B.border}`, fontSize: 9, color: B.danger, display: "flex", flexDirection: "column", gap: 3 }}>
          <strong style={{ fontSize: 10 }}>⚠️ Not enough staff to cover demand — last auto-generate left gaps:</strong>
          {summariseShortfalls(allocShortfalls).map((r) => (
            <span key={r.role} style={{ marginLeft: 8 }}>
              <strong>{r.role}</strong>: {r.totalMissing} missing across {r.dates.length} day{r.dates.length === 1 ? "" : "s"} ({r.topReason})
              {" — "}{r.dates.slice(0, 4).map((ds) => fmtDate(ds)).join(", ")}{r.dates.length > 4 ? ` + ${r.dates.length - 4} more` : ""}
            </span>
          ))}
        </div>
      )}

      {/* ── Inline alerts / info strip ───────────────────── */}
      {(hasRotaData || showRatios) && (
        <div style={{ flexShrink: 0, borderBottom: `1px solid ${B.border}` }}>
          {showRatios && (
            <div style={{ padding: "4px 16px" }}>
              {groups && groups.length > 0 ? (
                ratioAlerts.length > 0 ? (
                  <div style={{ background: B.dangerBg, border: "1px solid #fca5a5", borderRadius: 6, padding: "6px 12px", display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, fontSize: 10, color: B.danger, whiteSpace: "nowrap" }}>Shortfalls ({ratioAlerts.length})</span>
                    {ratioAlerts.slice(0, 5).map((a, i) => (
                      <span key={i} style={{ fontSize: 9, color: "#991b1b" }}>
                        <strong>{fmtDate(a.date)}</strong> {a.slot}: {a.total}/{a.required} (need {a.shortfall} more)
                      </span>
                    ))}
                    {ratioAlerts.length > 5 && <span style={{ fontSize: 9, color: "#991b1b" }}>+{ratioAlerts.length - 5} more</span>}
                  </div>
                ) : (
                  <div style={{ fontSize: 10, fontWeight: 700, color: B.success }}>All sessions meet safeguarding ratios</div>
                )
              ) : (
                <div style={{ fontSize: 10, color: "#0369a1" }}>Import groups in Students tab to see ratio checks</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Legend ───────────────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: "3px 16px 4px", display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center", background: B.bg, borderBottom: `1px solid ${B.border}` }}>
        {Object.entries(SESSION_TYPES).map(([n, c]) => (
          <span key={n} style={{ background: c+"20", color: c, padding: "2px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700 }}>{n}</span>
        ))}
        <span style={{ background: "#f59e0b20", color: "#f59e0b", padding: "2px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700 }}>Day Off</span>
        <span style={{ fontSize: 8, color: B.textMuted, marginLeft: 6 }}>Click = cycle · Double-click = edit</span>
      </div>

      {/* ── Fortnight selector ───────────────────────────── */}
      {fortnights.length > 1 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", padding: "6px 16px", borderBottom: `1px solid ${B.border}`, background: B.card, flexShrink: 0 }}>
          {fortnights.map((fn, i) => (
            <button
              key={fn.label}
              onClick={() => setFortIdx(i)}
              style={{
                padding: "4px 12px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                fontFamily: "inherit", cursor: "pointer",
                border: `1px solid ${i === fortIdx ? B.navy : B.border}`,
                background: i === fortIdx ? B.navy : B.card,
                color: i === fortIdx ? B.white : B.textMuted,
              }}
            >
              {fn.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Scrollable table ─────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 10, minWidth: tableMinWidth, background: B.card }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 52, position: "sticky", left: 0, zIndex: 3 }}>Role</th>
              <th style={{ ...thStyle, width: 140, position: "sticky", left: 52, zIndex: 3 }}>Name</th>
              <th style={{ ...thStyle, width: 44, textAlign: "center", position: "sticky", left: 192, zIndex: 3, fontSize: 9 }}>Sess</th>
              <th style={{ ...thStyle, width: 36, textAlign: "center", position: "sticky", left: 236, zIndex: 3, fontSize: 9 }}>Off</th>
              {dates.map((d) => {
                const we = isWeekend(d); const ds = dayKey(d); const exc = excDays && excDays[ds];
                const isArr = allArrivalDates.has(ds);
                const dem = lessonDemand[ds];
                return (
                  <th key={ds} colSpan={3} style={{ ...thStyle, textAlign: "center", borderLeft: "2px solid rgba(255,255,255,0.2)", padding: "4px 2px", minWidth: CELL_W*3+4, background: isArr ? "#166534" : exc ? "#92400e" : we ? "#7f1d1d" : B.navy }}>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>{fmtDate(d)}</div>
                    <div style={{ fontWeight: 900, fontSize: 13, color: B.white, letterSpacing: 0.5 }}>{dayName(d)}</div>
                    {exc && <div style={{ fontSize: 8, color: B.yellow, fontWeight: 800 }}>{exc === "Full" ? "Full Day Exc" : "Half Day Exc"}</div>}
                    {isArr && <div style={{ fontSize: 8, color: "#86efac", fontWeight: 800 }}>ARRIVAL</div>}
                    {dem && !we && <div style={{ fontSize: 8, color: "rgba(255,255,255,0.5)" }}>{dem.amStudents>0?"AM:"+dem.amStudents:""}{dem.amStudents>0&&dem.pmStudents>0?" · ":""}{dem.pmStudents>0?"PM:"+dem.pmStudents:""}</div>}
                  </th>
                );
              })}
            </tr>
            <tr>
              <th style={{ ...thStyle, position: "sticky", left: 0, zIndex: 3 }}></th>
              <th style={{ ...thStyle, position: "sticky", left: 52, zIndex: 3 }}></th>
              <th style={{ ...thStyle, position: "sticky", left: 192, zIndex: 3 }}></th>
              <th style={{ ...thStyle, position: "sticky", left: 236, zIndex: 3 }}></th>
              {dates.map((d) => SLOTS.map((sl) => (
                <th key={dayKey(d)+"-"+sl} style={{ ...thStyle, textAlign: "center", fontSize: 9, padding: "4px 0", borderLeft: sl === "AM" ? "2px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.1)", minWidth: CELL_W }}>{sl}</th>
              )))}
            </tr>
          </thead>
          <tbody>
            {hasRotaData && groups && groups.length > 0 && (
              <tr style={{ borderBottom: "2px solid "+B.border, background: B.successBg }}>
                <td style={{ ...tdStyle, position: "sticky", left: 0, zIndex: 1, background: B.successBg, fontSize: 9, fontWeight: 800, color: B.success }}>Ratio</td>
                <td style={{ ...tdStyle, position: "sticky", left: 52, zIndex: 1, background: B.successBg, fontSize: 10, fontWeight: 700, color: B.text }}>Staff+GL / Need</td>
                <td style={{ ...tdStyle, position: "sticky", left: 192, zIndex: 1, background: B.successBg }}></td>
                <td style={{ ...tdStyle, position: "sticky", left: 236, zIndex: 1, background: B.successBg }}></td>
                {dates.map((d) => {
                  const ds = dayKey(d); const rd = ratioData[ds];
                  return SLOTS.map((sl) => {
                    if (!rd) return <td key={ds+"-"+sl} style={{ padding: "1px", borderLeft: sl === "AM" ? "2px solid "+B.border : "1px solid "+B.borderLight, background: B.successBg }}><div style={{ height: 20 }} /></td>;
                    const sw = getStaffWorking(ds, sl);
                    const tot = sw + rd.gls;
                    const ok = tot >= rd.required;
                    return (
                      <td key={ds+"-"+sl} style={{ padding: "2px", borderLeft: sl === "AM" ? "2px solid "+B.border : "1px solid "+B.borderLight, textAlign: "center", background: ok ? B.successBg : B.dangerBg }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: ok ? B.success : B.danger, lineHeight: 1 }}>{tot}/{rd.required}</div>
                        <div style={{ fontSize: 9, color: B.textMuted }}>{rd.students}s</div>
                      </td>
                    );
                  });
                })}
              </tr>
            )}
            {fortnightStaff.length === 0 ? (
              <tr><td colSpan={4 + dates.length * 3} style={{ textAlign: "center", padding: 36, color: B.textLight }}>{staff.length === 0 ? "Add staff in Team tab, then Auto-Generate" : "No staff on site during this fortnight"}</td></tr>
            ) : (() => {
              const MGMT_ROLES = new Set(["CM", "CD", "EAM", "SWC"]);
              const regularStaff = fortnightStaff.filter((s) => !MGMT_ROLES.has(s.role));
              const mgmtStaff = fortnightStaff.filter((s) => MGMT_ROLES.has(s.role));
              const renderRow = (s) => {
                const st = getStats(s.id);
                const limit = getSessionLimit(s.role);
                const over = limit !== Infinity && limit > 0 && st.sess > limit;
                return (
                  <tr key={s.id} style={{ borderBottom: "1px solid "+B.borderLight }}>
                    <td style={{ ...tdStyle, position: "sticky", left: 0, background: B.card, zIndex: 1 }}>
                      <span style={{ background: B.cyanBg, color: B.link, padding: "3px 7px", borderRadius: 4, fontSize: 10, fontWeight: 800 }}>{ROLE_DISPLAY[s.role] || s.role}</span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: B.text, fontSize: 12, position: "sticky", left: 52, background: B.card, zIndex: 1, whiteSpace: "nowrap" }}>{s.name}</td>
                    <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800, fontSize: 12, position: "sticky", left: 192, background: B.card, zIndex: 1, color: over ? B.danger : B.text }}>
                      {st.sess}{limit !== Infinity && limit > 0 ? `/${limit}` : ""}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700, fontSize: 12, position: "sticky", left: 236, background: B.card, zIndex: 1, color: st.offs > 0 ? "#f59e0b" : B.textLight }}>{st.offs}</td>
                    {dates.map((d) => {
                      const ds = dayKey(d);
                      const on = inRange(ds, s.arr, s.dep) || SLOTS.some((sl) => fixedGrid[s.id+"-"+ds+"-"+sl]);
                      return SLOTS.map((sl) => {
                        const key = s.id+"-"+ds+"-"+sl;
                        const v = on ? grid[key] : undefined;
                        const off = v === "Day Off";
                        const col = cellColor(v, sl);
                        const isEd = editingCell === key;
                        return (
                          <td key={key}
                            onClick={() => !readOnly && on && !isEd && startEdit(key, v)}
                            onContextMenu={(e) => { if (readOnly || !v) return; e.preventDefault(); clearCell(key); }}
                            style={{
                              padding: "1px", borderLeft: sl === "AM" ? "2px solid "+B.border : "1px solid "+B.borderLight,
                              textAlign: "center", cursor: on ? "pointer" : "default",
                              minWidth: CELL_W, background: !on ? "#f5f5f5" : off ? "#f59e0b10" : "transparent",
                            }}>
                            {isEd ? (
                              <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                                onBlur={commitEdit}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                                  else if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                                }}
                                style={{ width: "100%", fontSize: 10, padding: "4px", border: "1px solid "+B.navy, borderRadius: 3, fontFamily: "inherit", height: CELL_H }} />
                            ) : col ? (
                              <div style={{ background: col+"25", color: col, borderRadius: 4, fontSize: v && v.length > 20 ? 8 : 10, fontWeight: 800, height: CELL_H, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", textAlign: "center", lineHeight: 1.2 }} title={v + " — right-click to clear"}>
                                {off ? "Day Off" : v}
                              </div>
                            ) : on ? <div style={{ height: CELL_H }} /> : <div style={{ height: CELL_H, background: "#f0f0f0", borderRadius: 3 }} />}
                          </td>
                        );
                      });
                    })}
                  </tr>
                );
              };
              return (
                <>
                  {regularStaff.map(renderRow)}
                  {mgmtStaff.length > 0 && (
                    <>
                      <tr>
                        <td colSpan={4 + dates.length * 3} style={{ background: B.navy, color: B.white, fontWeight: 800, fontSize: 11, padding: "6px 12px", letterSpacing: "0.05em", textTransform: "uppercase", position: "sticky", left: 0 }}>
                          Management Team
                        </td>
                      </tr>
                      {mgmtStaff.map(renderRow)}
                    </>
                  )}
                </>
              );
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
